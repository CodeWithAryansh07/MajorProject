import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Constants for session management
const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes - consider user inactive
const EXPIRY_DELAY = 60 * 60 * 1000; // 1 hour - time to wait before deleting inactive session

// Update user's activity in a session (heartbeat)
export const updateUserActivity = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Find the participant
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", args.userId)
      )
      .first();

    if (participant) {
      // Update participant's activity
      await ctx.db.patch(participant._id, {
        lastSeen: now,
        lastActive: now,
        isActive: true,
      });

      // Update session's last activity
      await ctx.db.patch(args.sessionId, {
        lastActivity: now,
      });

      // If session was scheduled for deletion, reactivate it
      const session = await ctx.db.get(args.sessionId);
      if (session && (session.status === "scheduled_for_deletion" || session.status === "inactive")) {
        await ctx.db.patch(args.sessionId, {
          status: "active",
          isActive: true,
          expiresAt: undefined,
        });
      } else if (session && !session.status) {
        // Add status field to existing sessions without it
        await ctx.db.patch(args.sessionId, {
          status: "active",
        });
      }
    }

    return { success: true };
  },
});

// Check for inactive users and manage session status
export const checkSessionActivity = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get all participants for this session
    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Count active participants
    let activeParticipants = 0;
    const activeUserIds: string[] = [];

    for (const participant of participants) {
      const isActiveNow = participant.lastSeen 
        ? now - participant.lastSeen <= INACTIVE_THRESHOLD
        : now - participant.lastActive <= INACTIVE_THRESHOLD;
      
      if (participant.isActive !== isActiveNow) {
        // Update participant status if it changed
        await ctx.db.patch(participant._id, {
          isActive: isActiveNow,
          lastActive: isActiveNow ? participant.lastActive : now,
        });
      }

      if (isActiveNow) {
        activeParticipants++;
        activeUserIds.push(participant.userId);
      }
    }

    // Get current session
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { success: false, error: "Session not found" };

    // Update session based on active participants
    if (activeParticipants === 0) {
      // No active users - schedule session for deletion
      if (!session.status || session.status !== "scheduled_for_deletion") {
        await ctx.db.patch(args.sessionId, {
          status: "scheduled_for_deletion",
          isActive: false,
          activeUsers: [],
          expiresAt: now + EXPIRY_DELAY,
          lastActivity: now,
        });
      }
    } else {
      // Has active users - ensure session is active
      if (!session.status || session.status !== "active") {
        await ctx.db.patch(args.sessionId, {
          status: "active",
          isActive: true,
          expiresAt: undefined,
        });
      }
      
      // Update active users list
      await ctx.db.patch(args.sessionId, {
        activeUsers: activeUserIds,
        lastActivity: now,
      });
    }

    return { 
      success: true, 
      activeParticipants,
      sessionStatus: activeParticipants > 0 ? "active" : "scheduled_for_deletion"
    };
  },
});

// Get sessions that are scheduled for deletion and past their expiry time
export const getExpiredSessions = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const allSessions = await ctx.db.query("collaborativeSessions").collect();
    
    const expiredSessions = allSessions.filter(session => 
      session.status === "scheduled_for_deletion" &&
      session.expiresAt && 
      session.expiresAt < now
    );

    return expiredSessions;
  },
});

// Internal function to cleanup expired sessions (called by cron job)
export const cleanupExpiredSessions = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find sessions that should be deleted
    const allSessions = await ctx.db.query("collaborativeSessions").collect();
    
    const expiredSessions = allSessions.filter(session => 
      session.status === "scheduled_for_deletion" &&
      session.expiresAt && 
      session.expiresAt < now
    );

    let cleanedCount = 0;

    for (const session of expiredSessions) {
      try {
        // Delete all participants
        const participants = await ctx.db
          .query("sessionParticipants")
          .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
          .collect();
        
        for (const participant of participants) {
          await ctx.db.delete(participant._id);
        }

        // Delete all code operations
        const operations = await ctx.db
          .query("codeOperations")
          .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
          .collect();
        
        for (const operation of operations) {
          await ctx.db.delete(operation._id);
        }

        // Delete all chat messages
        const messages = await ctx.db
          .query("sessionMessages")
          .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
          .collect();
        
        for (const message of messages) {
          await ctx.db.delete(message._id);
        }
        
        // Finally, delete the session
        await ctx.db.delete(session._id);
        cleanedCount++;
        
      } catch (error) {
        console.error(`Failed to delete session ${session._id}:`, error);
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} expired collaboration sessions`);
    return { cleanedCount };
  },
});

// Check and update activity for all active sessions (called by cron job)
export const checkAllSessionsActivity = internalMutation({
  handler: async (ctx) => {
    const activeSessions = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    let processedCount = 0;
    
    for (const session of activeSessions) {
      try {
        const now = Date.now();
        
        // Get all participants for this session
        const participants = await ctx.db
          .query("sessionParticipants")
          .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
          .collect();

        // Count active participants
        let activeParticipants = 0;
        const activeUserIds: string[] = [];

        for (const participant of participants) {
          const isActiveNow = participant.lastSeen 
            ? now - participant.lastSeen <= INACTIVE_THRESHOLD
            : now - participant.lastActive <= INACTIVE_THRESHOLD;
          
          if (participant.isActive !== isActiveNow) {
            await ctx.db.patch(participant._id, {
              isActive: isActiveNow,
              lastActive: isActiveNow ? participant.lastActive : now,
            });
          }

          if (isActiveNow) {
            activeParticipants++;
            activeUserIds.push(participant.userId);
          }
        }

        // Update session based on active participants
        if (activeParticipants === 0) {
          // No active users - schedule session for deletion
          await ctx.db.patch(session._id, {
            status: "scheduled_for_deletion",
            isActive: false,
            activeUsers: [],
            expiresAt: now + EXPIRY_DELAY,
            lastActivity: now,
          });
        } else {
          // Update active users list
          await ctx.db.patch(session._id, {
            activeUsers: activeUserIds,
            lastActivity: now,
          });
        }
        
        processedCount++;
      } catch (error) {
        console.error(`Failed to process session ${session._id}:`, error);
      }
    }
    
    console.log(`Processed activity for ${processedCount} sessions`);
    return { processedCount };
  },
});

// Get session activity statistics (for monitoring)
export const getSessionActivityStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const allSessions = await ctx.db.query("collaborativeSessions").collect();
    
    const stats = {
      total: allSessions.length,
      active: 0,
      inactive: 0,
      scheduledForDeletion: 0,
      expired: 0,
    };

    for (const session of allSessions) {
      if (!session.status) {
        // Handle sessions without status field (legacy sessions)
        if (session.isActive) {
          stats.active++;
        } else {
          stats.inactive++;
        }
      } else {
        switch (session.status) {
          case "active":
            stats.active++;
            break;
          case "inactive":
            stats.inactive++;
            break;
          case "scheduled_for_deletion":
            stats.scheduledForDeletion++;
            if (session.expiresAt && session.expiresAt < now) {
              stats.expired++;
            }
            break;
        }
      }
    }

    return stats;
  },
});