// DOCUMENTED BY SCRIPT - Phase 2
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get a specific session file
export const getSessionFile = query({
  args: {
    fileId: v.id("sessionFiles"),
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file || file.sessionId !== args.sessionId) {
      throw new Error("File not found");
    }

    return file;
  },
});

// Create a new session file
export const createFile = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    name: v.string(),
    language: v.string(),
    folderId: v.optional(v.id("sessionFolders")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Check if session exists
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Build path
    let path = "";
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (folder) {
        path = `${folder.path}/${args.name}`;
      } else {
        path = `/${args.name}`;
      }
    } else {
      path = `/${args.name}`;
    }

    // Check for duplicate names in the same folder
    const existingFile = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session_and_folder", (q) => 
        q.eq("sessionId", args.sessionId).eq("folderId", args.folderId)
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existingFile) {
      throw new Error(`File "${args.name}" already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("sessionFiles", {
      sessionId: args.sessionId,
      userId: args.userId,
      folderId: args.folderId,
      name: args.name,
      language: args.language,
      code: `// ${args.name}\n// Created in session: ${session.name}\n\n`,
      createdAt: now,
      updatedAt: now,
      path,
    });
  },
});

// Update session file content
export const updateFile = mutation({
  args: {
    fileId: v.id("sessionFiles"),
    sessionId: v.id("collaborativeSessions"),
    code: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file || file.sessionId !== args.sessionId) {
      throw new Error("File not found");
    }

    await ctx.db.patch(args.fileId, {
      code: args.code,
      updatedAt: Date.now(),
    });
  },
});

// Delete a session file
export const deleteFile = mutation({
  args: {
    fileId: v.id("sessionFiles"),
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file || file.sessionId !== args.sessionId) {
      throw new Error("File not found");
    }

    await ctx.db.delete(args.fileId);
  },
});