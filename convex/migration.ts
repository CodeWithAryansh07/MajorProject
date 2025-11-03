// DOCUMENTED BY SCRIPT - Phase 2
import { internalMutation } from "./_generated/server";

// Migration script to update existing sessions with new fields
export const migrateExistingSessions = internalMutation({
  handler: async (ctx) => {
    const sessions = await ctx.db.query("collaborativeSessions").collect();
    let updatedCount = 0;

    for (const session of sessions) {
      const updates: Record<string, unknown> = {};
      
      // Add status field if missing
      if (!session.status) {
        updates.status = session.isActive ? "active" : "inactive";
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(session._id, updates);
        updatedCount++;
      }
    }

    // Update participants with lastSeen field
    const participants = await ctx.db.query("sessionParticipants").collect();
    let participantUpdatedCount = 0;

    for (const participant of participants) {
      if (!participant.lastSeen) {
        await ctx.db.patch(participant._id, {
          lastSeen: participant.lastActive,
        });
        participantUpdatedCount++;
      }
    }

    console.log(`Migration completed: Updated ${updatedCount} sessions and ${participantUpdatedCount} participants`);
    return { 
      updatedSessions: updatedCount, 
      updatedParticipants: participantUpdatedCount 
    };
  },
});