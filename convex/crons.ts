import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every 10 minutes to check session activity and cleanup expired sessions
crons.interval(
  "session-activity-check",
  { minutes: 10 },
  internal.sessionActivity.checkAllSessionsActivity
);

// Run every 30 minutes to cleanup expired sessions
crons.interval(
  "cleanup-expired-sessions", 
  { minutes: 30 },
  internal.sessionActivity.cleanupExpiredSessions
);

export default crons;