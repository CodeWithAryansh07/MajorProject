// DOCUMENTED BY SCRIPT - Phase 2
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate a unique session key for URL routing
function generateSessionKey(): string {
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 8);
  const random2 = Math.random().toString(36).substring(2, 6);
  return `${timestamp}${random1}${random2}`.toLowerCase();
}

// Create a collaborative session
export const createSession = mutation({
  args: {
    name: v.string(),
    creatorId: v.string(),
    language: v.string(),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    maxUsers: v.optional(v.number()),
    sessionSettings: v.optional(v.object({
      allowGuests: v.optional(v.boolean()),
      autoSave: v.optional(v.boolean()),
      theme: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { 
      name, 
      creatorId, 
      language, 
      code, 
      description,
      isPublic, 
      maxUsers = 5,
      sessionSettings
    } = args;
    
    // Check session limit before creating (max 2 total sessions per user)
    const totalSessions = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", creatorId))
      .collect();
    
    if (totalSessions.length >= 2) {
      throw new Error("You can only have 2 sessions maximum. Please delete an existing session first.");
    }
    
    const now = Date.now();
    const sessionKey = generateSessionKey();

    const sessionId = await ctx.db.insert("collaborativeSessions", {
      name,
      creatorId,
      sessionKey,
      language,
      code: code || getDefaultCodeForLanguage(language),
      description,
      isPublic,
      isActive: true,
      activeUsers: [creatorId],
      maxUsers,
      createdAt: now,
      lastActivity: now,
      status: "active",
      sessionSettings: sessionSettings || {
        allowGuests: false,
        autoSave: true,
        theme: "dark",
      },
    });

    // Add creator as participant
    await ctx.db.insert("sessionParticipants", {
      sessionId,
      userId: creatorId,
      userName: await getUserName(ctx, creatorId),
      permission: "write",
      joinedAt: now,
      lastActive: now,
      lastSeen: now,
      isActive: true,
    });

    return { sessionId, sessionKey };
  },
});

// Join a collaborative session
export const joinSession = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, userId } = args;

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Allow joining inactive sessions - they will be reactivated
    if (session.status === "scheduled_for_deletion" || !session.isActive) {
      // Reactivate the session
      await ctx.db.patch(sessionId, {
        status: "active",
        isActive: true,
        expiresAt: undefined,
        lastActivity: Date.now(),
      });
    }

    if (session.activeUsers.length >= session.maxUsers && !session.activeUsers.includes(userId)) {
      throw new Error("Session is full");
    }

    // Check if user is already in session
    const existingParticipant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) => 
        q.eq("sessionId", sessionId).eq("userId", userId)
      )
      .first();

    if (existingParticipant) {
      // Reactivate existing participant
      await ctx.db.patch(existingParticipant._id, {
        isActive: true,
        lastActive: Date.now(),
        lastSeen: Date.now(),
      });
    } else {
      // Add new participant
      await ctx.db.insert("sessionParticipants", {
        sessionId,
        userId,
        userName: await getUserName(ctx, userId),
        permission: "write", // Default permission
        joinedAt: Date.now(),
        lastActive: Date.now(),
        lastSeen: Date.now(),
        isActive: true,
      });
    }

    // Update session active users
    const updatedActiveUsers = [...new Set([...session.activeUsers, userId])];
    await ctx.db.patch(sessionId, {
      activeUsers: updatedActiveUsers,
      lastActivity: Date.now(),
    });

    return { success: true };
  },
});

// Leave a collaborative session
export const leaveSession = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, userId } = args;

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Find and deactivate participant
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) => 
        q.eq("sessionId", sessionId).eq("userId", userId)
      )
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, {
        isActive: false,
        lastActive: Date.now(),
        lastSeen: Date.now(),
      });
    }

    // Update session active users
    const updatedActiveUsers = session.activeUsers.filter(id => id !== userId);
    await ctx.db.patch(sessionId, {
      activeUsers: updatedActiveUsers,
      lastActivity: Date.now(),
    });

    // Check if any users are still active and update session status accordingly
    const now = Date.now();
    const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    const allParticipants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .collect();
    
    const activeParticipants = allParticipants.filter(
      p => p.isActive && (p.lastSeen ? now - p.lastSeen <= INACTIVE_THRESHOLD : now - p.lastActive <= INACTIVE_THRESHOLD)
    );

    // If no active users left, schedule session for deletion
    if (activeParticipants.length === 0) {
      await ctx.db.patch(sessionId, {
        status: "scheduled_for_deletion",
        isActive: false,
        expiresAt: now + (60 * 60 * 1000), // 1 hour from now
      });
    }

    return { success: true };
  },
});

// Update session code
export const updateSessionCode = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
    code: v.string(),
    operation: v.optional(v.object({
      type: v.string(),
      position: v.number(),
      content: v.string(),
      length: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const { sessionId, userId, code, operation } = args;

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Check if user has write permission
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) => 
        q.eq("sessionId", sessionId).eq("userId", userId)
      )
      .first();

    if (!participant || participant.permission !== "write") {
      throw new Error("Permission denied");
    }

    // Only update if the code has actually changed to prevent unnecessary updates
    if (session.code !== code) {
      // Update session code
      await ctx.db.patch(sessionId, {
        code,
        lastActivity: Date.now(),
      });

      // Log the operation for potential conflict resolution
      if (operation) {
        await ctx.db.insert("codeOperations", {
          sessionId,
          userId,
          operation,
          timestamp: Date.now(),
        });
      }
    }

    // Update participant last active (but less frequently to reduce writes)
    const now = Date.now();
    if (now - participant.lastActive > 5000) { // Only update every 5 seconds
      await ctx.db.patch(participant._id, {
        lastActive: now,
      });
    }

    return { success: true };
  },
});

// Get session by sessionKey (for URL routing)
export const getSessionByKey = query({
  args: {
    sessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_session_key", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (!session) {
      return null;
    }

    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return {
      ...session,
      participants,
    };
  },
});

// Get session details
export const getSession = query({
  args: {
    sessionId: v.id("collaborativeSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return {
      ...session,
      participants,
    };
  },
});

// Get user's sessions
export const getUserSessions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get sessions created by user
    const createdSessions = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", args.userId))
      .collect();

    // Get sessions user has joined
    const participantSessions = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    const joinedSessionIds = participantSessions.map(p => p.sessionId);
    const joinedSessions = await Promise.all(
      joinedSessionIds.map(id => ctx.db.get(id))
    );

    const allSessions = [
      ...createdSessions,
      ...joinedSessions.filter(Boolean).filter(s => s!.creatorId !== args.userId)
    ].filter(Boolean);

    // Add participant counts to all sessions (same as getPublicSessions)
    const sessionsWithParticipants = await Promise.all(
      allSessions.map(async (session) => {
        const participants = await ctx.db
          .query("sessionParticipants")
          .withIndex("by_session_id", (q) => q.eq("sessionId", session!._id))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        return {
          ...session!,
          participantCount: participants.length,
        };
      })
    );

    return sessionsWithParticipants.sort((a, b) => b.lastActivity - a.lastActivity);
  },
});

// Get public sessions
export const getPublicSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { limit = 20 } = args;

    const publicSessions = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_is_public", (q) => q.eq("isPublic", true))
      .filter((q) => q.neq(q.field("status"), "scheduled_for_deletion"))
      .collect();

    const sessionsWithParticipants = await Promise.all(
      publicSessions.map(async (session) => {
        const participants = await ctx.db
          .query("sessionParticipants")
          .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        return {
          ...session,
          participantCount: participants.length,
        };
      })
    );

    // Show sessions that are either active or have participants (not yet expired)
    const visibleSessions = sessionsWithParticipants.filter(session => 
      session.isActive || session.participantCount > 0
    );

    return visibleSessions
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, limit);
  },
});

// Get session participant counts (for real-time updates)
export const getSessionParticipantCounts = query({
  args: {
    sessionIds: v.array(v.id("collaborativeSessions")),
  },
  handler: async (ctx, args) => {
    const counts = await Promise.all(
      args.sessionIds.map(async (sessionId) => {
        const participants = await ctx.db
          .query("sessionParticipants")
          .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        return {
          sessionId,
          participantCount: participants.length,
        };
      })
    );

    return counts;
  },
});

// Send chat message
export const sendChatMessage = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, userId, message } = args;

    // Verify user is in session
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) => 
        q.eq("sessionId", sessionId).eq("userId", userId)
      )
      .first();

    if (!participant || !participant.isActive) {
      throw new Error("Permission denied");
    }

    await ctx.db.insert("sessionMessages", {
      sessionId,
      userId,
      userName: participant.userName,
      message: message.trim(),
      timestamp: Date.now(),
    });

    // Update session last activity
    await ctx.db.patch(sessionId, {
      lastActivity: Date.now(),
    });

    return { success: true };
  },
});

// Get chat messages
export const getChatMessages = query({
  args: {
    sessionId: v.id("collaborativeSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { sessionId, limit = 50 } = args;

    const messages = await ctx.db
      .query("sessionMessages")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .collect();

    return messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  },
});

// Update user permission in session
export const updateUserPermission = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    targetUserId: v.string(),
    newPermission: v.union(v.literal("read"), v.literal("write")),
    requesterId: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, targetUserId, newPermission, requesterId } = args;

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Only session creator can change permissions
    if (session.creatorId !== requesterId) {
      throw new Error("Only session creator can change permissions");
    }

    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) => 
        q.eq("sessionId", sessionId).eq("userId", targetUserId)
      )
      .first();

    if (!participant) {
      throw new Error("User not found in session");
    }

    await ctx.db.patch(participant._id, {
      permission: newPermission,
    });

    return { success: true };
  },
});

// Heartbeat to keep participant active
export const participantHeartbeat = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, userId } = args;
    const now = Date.now();

    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) => 
        q.eq("sessionId", sessionId).eq("userId", userId)
      )
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, {
        lastActive: now,
        lastSeen: now,
        isActive: true,
      });

      // Update session activity
      await ctx.db.patch(sessionId, {
        lastActivity: now,
      });

      // If session was scheduled for deletion, reactivate it
      const session = await ctx.db.get(sessionId);
      if (session && session.status === "scheduled_for_deletion") {
        await ctx.db.patch(sessionId, {
          status: "active",
          isActive: true,
          expiresAt: undefined,
        });
      }
    }

    return { success: true };
  },
});

// Helper functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserName(ctx: { db: any }, userId: string): Promise<string> {
  const user = await ctx.db
    .query("users")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .first();
  
  return user?.name || "Unknown User";
}

function getDefaultCodeForLanguage(language: string): string {
  const defaults: Record<string, string> = {
    javascript: `// Welcome to collaborative coding!\nconsole.log("Hello, World!");`,
    python: `# Welcome to collaborative coding!\nprint("Hello, World!")`,
    java: `// Welcome to collaborative coding!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    cpp: `// Welcome to collaborative coding!\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
    typescript: `// Welcome to collaborative coding!\nconsole.log("Hello, World!");`,
  };

  return defaults[language] || `// Welcome to collaborative coding!\n// Start coding together!`;
}

// Check how many active sessions a user has created
export const getUserActiveSessionCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", args.userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.neq(q.field("status"), "scheduled_for_deletion")
        )
      )
      .collect();
    
    return sessions.length;
  },
});

// Get user's total session count (for 2-session limit enforcement)
export const getUserTotalSessionCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", args.userId))
      .collect();
    
    return sessions.length;
  },
});

// Get user's sessions (all sessions, not just active)
export const getUserActiveSessions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", args.userId))
      .collect();
  },
});

// Update session name and description
export const updateSession = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    maxUsers: v.optional(v.number()),
    sessionSettings: v.optional(v.object({
      allowGuests: v.optional(v.boolean()),
      autoSave: v.optional(v.boolean()),
      theme: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    if (session.creatorId !== args.userId) {
      throw new Error("Only the session creator can update the session");
    }
    
    // Prepare update object with only provided fields
    const updateData: Partial<{
      name: string;
      description: string;
      isPublic: boolean;
      maxUsers: number;
      sessionSettings: { allowGuests?: boolean; autoSave?: boolean; theme?: string };
      lastActivity: number;
    }> = {
      lastActivity: Date.now(),
    };
    
    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.isPublic !== undefined) updateData.isPublic = args.isPublic;
    if (args.maxUsers !== undefined) updateData.maxUsers = args.maxUsers;
    if (args.sessionSettings !== undefined) updateData.sessionSettings = args.sessionSettings;
    
    await ctx.db.patch(args.sessionId, updateData);
    
    return { success: true };
  },
});

// Delete a session (hard delete)
export const deleteSession = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    if (session.creatorId !== args.userId) {
      throw new Error("Only the session creator can delete the session");
    }
    
    // Delete all participants first
    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    
    for (const participant of participants) {
      await ctx.db.delete(participant._id);
    }
    
    // Delete all session messages
    const messages = await ctx.db
      .query("sessionMessages")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    // Delete all code operations
    const operations = await ctx.db
      .query("codeOperations")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    
    for (const operation of operations) {
      await ctx.db.delete(operation._id);
    }
    
    // Finally delete the session itself
    await ctx.db.delete(args.sessionId);
    
    return { success: true };
  },
});

// Save session to user's permanent collection
export const saveSessionToCollection = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.log("saveSessionToCollection called with args:", args);
    
    const session = await ctx.db.get(args.sessionId);
    console.log("Found session:", session ? session.name : "null");
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Only creator or participants can save the session
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) => 
        q.eq("sessionId", args.sessionId).eq("userId", args.userId)
      )
      .first();
    
    console.log("User is creator:", session.creatorId === args.userId);
    console.log("User is participant:", !!participant);
    
    if (session.creatorId !== args.userId && !participant) {
      throw new Error("You must be a participant to save this session");
    }
    
    // Check if this session was loaded from a saved session (smart re-save)
    if (session.originalSavedSessionId) {
      console.log("Smart re-save detected for original saved session:", session.originalSavedSessionId);
      
      // Check if user owns the original saved session
      const originalSavedSession = await ctx.db.get(session.originalSavedSessionId);
      if (originalSavedSession && originalSavedSession.userId === args.userId) {
        console.log("Updating original saved session instead of creating new one");
        
        // Update the original saved session with new data
        await ctx.db.patch(session.originalSavedSessionId, {
          name: args.name || session.name,
          code: session.code,
          description: args.description || `Updated from loaded session: ${session.name}`,
          updatedAt: Date.now(),
          tags: args.tags || [],
          isPrivate: args.isPrivate ?? !session.isPublic,
        });
        
        return { 
          savedSessionId: session.originalSavedSessionId, 
          success: true,
          isUpdate: true,
          message: "Original saved session updated with new changes"
        };
      }
    }
    
    // Check saved session limit (max 10 saved sessions per user)
    const savedCount = await ctx.db
      .query("savedSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();
    
    console.log("User's saved session count:", savedCount.length);
    
    if (savedCount.length >= 10) {
      throw new Error("SAVE_LIMIT_EXCEEDED: You can only save up to 10 sessions. Please delete some saved sessions first.");
    }
    
    // Check if user has already saved this specific session
    const existingSave = await ctx.db
      .query("savedSessions")
      .withIndex("by_user_and_original_session", (q) => 
        q.eq("userId", args.userId).eq("originalSessionId", args.sessionId)
      )
      .first();
    
    console.log("Existing save found:", !!existingSave);
    
    if (existingSave) {
      throw new Error("DUPLICATE_SAVE: This session has already been saved to your collection");
    }
    
    const now = Date.now();
    console.log("About to insert savedSession with data:", {
      userId: args.userId,
      originalSessionId: args.sessionId,
      name: args.name || session.name,
      language: session.language,
      code: session.code.substring(0, 50) + "...", // Truncate for logging
      description: args.description || `Saved from collaborative session: ${session.name}`,
      createdAt: now,
      updatedAt: now,
      tags: args.tags || [],
      isPrivate: args.isPrivate ?? !session.isPublic, // Preserve original session's public status
      originalSessionIsPublic: session.isPublic, // For debugging
    });
    
    const savedSessionId = await ctx.db.insert("savedSessions", {
      userId: args.userId,
      originalSessionId: args.sessionId,
      name: args.name || session.name,
      language: session.language,
      code: session.code,
      description: args.description || session.description || `Saved from collaborative session: ${session.name}`,
      createdAt: now,
      updatedAt: now,
      tags: args.tags || [],
      isPrivate: args.isPrivate ?? !session.isPublic, // Preserve original session's public status
      maxUsers: session.maxUsers, // Preserve session settings
      sessionSettings: session.sessionSettings, // Preserve session settings
    });
    
    console.log("Successfully inserted savedSession with ID:", savedSessionId);
    
    return { 
      savedSessionId, 
      success: true,
      isUpdate: false,
      message: "Session saved to your collection"
    };
  },
});

// Get user's saved sessions
export const getUserSavedSessions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("savedSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Update saved session
export const updateSavedSession = mutation({
  args: {
    savedSessionId: v.id("savedSessions"),
    userId: v.string(),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const savedSession = await ctx.db.get(args.savedSessionId);
    
    if (!savedSession) {
      throw new Error("Saved session not found");
    }
    
    if (savedSession.userId !== args.userId) {
      throw new Error("You can only update your own saved sessions");
    }
    
    const updateData: Partial<{
      name: string;
      code: string;
      description: string;
      tags: string[];
      isPrivate: boolean;
      updatedAt: number;
    }> = { updatedAt: Date.now() };
    
    if (args.name !== undefined) updateData.name = args.name;
    if (args.code !== undefined) updateData.code = args.code;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.tags !== undefined) updateData.tags = args.tags;
    if (args.isPrivate !== undefined) updateData.isPrivate = args.isPrivate;
    
    await ctx.db.patch(args.savedSessionId, updateData);
    
    return { success: true };
  },
});

// Delete saved session
export const deleteSavedSession = mutation({
  args: {
    savedSessionId: v.id("savedSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const savedSession = await ctx.db.get(args.savedSessionId);
    
    if (!savedSession) {
      throw new Error("Saved session not found");
    }
    
    if (savedSession.userId !== args.userId) {
      throw new Error("You can only delete your own saved sessions");
    }
    
    await ctx.db.delete(args.savedSessionId);
    
    return { success: true };
  },
});

// Validate session creation limit (max 2 total sessions per user)
export const validateSessionCreationLimit = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const totalCount = await getUserTotalSessionCount(ctx, { userId: args.userId });
    return {
      canCreate: totalCount < 2,
      totalCount,
      limit: 2,
      message: totalCount >= 2 ? 'You can only have 2 sessions total at a time. Please delete an existing session first.' : 'You can create a new session.',
    };
  },
});

// Check which sessions are already saved by the user
export const getSessionSaveStatus = query({
  args: { 
    userId: v.string(),
    sessionIds: v.array(v.id("collaborativeSessions"))
  },
  handler: async (ctx, args) => {
    const savedSessions = await ctx.db
      .query("savedSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("originalSessionId"), null))
      .collect();
    
    const savedSessionIds = new Set(
      savedSessions
        .map(s => s.originalSessionId)
        .filter(Boolean)
    );
    
    return args.sessionIds.map(sessionId => ({
      sessionId,
      isSaved: savedSessionIds.has(sessionId)
    }));
  },
});

// Get saved session count and limit info
export const getSavedSessionInfo = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const savedSessions = await ctx.db
      .query("savedSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();
    
    return {
      count: savedSessions.length,
      limit: 10,
      canSave: savedSessions.length < 10,
      message: savedSessions.length >= 10 
        ? 'You have reached the maximum of 10 saved sessions. Please delete some to save new ones.'
        : `You can save ${10 - savedSessions.length} more sessions.`
    };
  },
});

// Check if a session is already saved by the user
export const isSessionAlreadySaved = query({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return false;
    
    const existingSave = await ctx.db
      .query("savedSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("name"), session.name),
          q.eq(q.field("code"), session.code),
          q.eq(q.field("language"), session.language)
        )
      )
      .first();
    
    return !!existingSave;
  },
});

// Toggle saved session privacy (for testing/admin purposes)
export const toggleSavedSessionPrivacy = mutation({
  args: {
    savedSessionId: v.id("savedSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const savedSession = await ctx.db.get(args.savedSessionId);
    
    if (!savedSession) {
      throw new Error("Saved session not found");
    }
    
    if (savedSession.userId !== args.userId) {
      throw new Error("You can only modify your own saved sessions");
    }
    
    await ctx.db.patch(args.savedSessionId, {
      isPrivate: !savedSession.isPrivate,
      updatedAt: Date.now(),
    });
    
    return { 
      success: true, 
      newPrivacyStatus: !savedSession.isPrivate ? "private" : "public"
    };
  },
});

// Load saved session into a new collaborative session
export const loadSavedSession = mutation({
  args: {
    savedSessionId: v.id("savedSessions"),
    userId: v.string(),
    sessionName: v.optional(v.string()),
    makePublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const savedSession = await ctx.db.get(args.savedSessionId);
    
    if (!savedSession) {
      throw new Error("Saved session not found");
    }
    
    // Check if user can load this session (owner or if it's not private)
    if (savedSession.userId !== args.userId && savedSession.isPrivate) {
      throw new Error("You don't have permission to load this session");
    }
    
    // Check session creation limit for the user (total sessions, not just active)
    const totalCount = await getUserTotalSessionCount(ctx, { userId: args.userId });
    if (totalCount >= 2) {
      throw new Error("SESSION_LIMIT_EXCEEDED: You can only have 2 sessions total at a time. Please delete an existing session first.");
    }
    
    // Generate unique session key
    const sessionKey = generateSessionKey();
    
    // Create new collaborative session from saved session
    const sessionId = await ctx.db.insert("collaborativeSessions", {
      name: args.sessionName || `${savedSession.name} (Loaded)`,
      language: savedSession.language,
      code: savedSession.code,
      description: savedSession.description,
      creatorId: args.userId,
      sessionKey,
      isPublic: args.makePublic ?? !savedSession.isPrivate, // Use saved session's original public status by default
      isActive: true,
      status: "active",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      maxUsers: savedSession.maxUsers || 5, // Use saved session's maxUsers or default to 5
      activeUsers: [args.userId],
      originalSavedSessionId: args.savedSessionId, // Track which saved session this was loaded from
      sessionSettings: savedSession.sessionSettings, // Preserve session settings
    });
    
    // Add creator as participant with write permission
    await ctx.db.insert("sessionParticipants", {
      sessionId,
      userId: args.userId,
      userName: "User", // Will be updated when user data is available
      permission: "write",
      joinedAt: Date.now(),
      lastActive: Date.now(),
      isActive: true,
    });
    
    return { sessionId, sessionKey, success: true };
  },
});

// Get public saved sessions (for public gallery)
export const getPublicSavedSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { limit = 20 } = args;
    
    return await ctx.db
      .query("savedSessions")
      .filter((q) => q.eq(q.field("isPrivate"), false))
      .order("desc")
      .take(limit);
  },
});

// Get saved session by ID (for viewing)
export const getSavedSession = query({
  args: {
    savedSessionId: v.id("savedSessions"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const savedSession = await ctx.db.get(args.savedSessionId);
    
    if (!savedSession) {
      return null;
    }
    
    // Check if user can view this session
    if (savedSession.isPrivate && savedSession.userId !== args.userId) {
      throw new Error("You don't have permission to view this session");
    }
    
    return savedSession;
  },
});