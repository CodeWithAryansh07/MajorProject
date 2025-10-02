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
    isPublic: v.boolean(),
    maxUsers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { name, creatorId, language, code, isPublic, maxUsers = 5 } = args;
    const now = Date.now();
    const sessionKey = generateSessionKey();

    const sessionId = await ctx.db.insert("collaborativeSessions", {
      name,
      creatorId,
      sessionKey,
      language,
      code: code || getDefaultCodeForLanguage(language),
      isPublic,
      isActive: true,
      activeUsers: [creatorId],
      maxUsers,
      createdAt: now,
      lastActivity: now,
      status: "active",
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