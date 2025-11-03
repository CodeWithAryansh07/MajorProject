// DOCUMENTED BY SCRIPT - Phase 2
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get folder tree for a specific session
export const getSessionFolderTree = query({
  args: {
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Get all folders for this session
    const folders = await ctx.db
      .query("sessionFolders")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Get all files for this session
    const files = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Build nested structure
    const buildFolderTree = (parentId?: string): any[] => {
      const childFolders = folders
        .filter((folder) => folder.parentFolderId === parentId)
        .map((folder) => ({
          ...folder,
          children: buildFolderTree(folder._id),
          files: files.filter((file) => file.folderId === folder._id),
        }));
      return childFolders;
    };

    return {
      folders: buildFolderTree(),
      files: files.filter((file) => !file.folderId), // Root files
    };
  },
});

// Create a new folder
export const createFolder = mutation({
  args: {
    sessionId: v.id("collaborativeSessions"),
    name: v.string(),
    parentFolderId: v.optional(v.id("sessionFolders")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Check if session exists and user has access
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Build path
    let path = "";
    if (args.parentFolderId) {
      const parentFolder = await ctx.db.get(args.parentFolderId);
      if (parentFolder) {
        path = `${parentFolder.path}/${args.name}`;
      } else {
        path = `/${args.name}`;
      }
    } else {
      path = `/${args.name}`;
    }

    // Check for duplicate names in the same parent
    const existingFolder = await ctx.db
      .query("sessionFolders")
      .withIndex("by_session_and_parent", (q) => 
        q.eq("sessionId", args.sessionId).eq("parentFolderId", args.parentFolderId)
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existingFolder) {
      throw new Error(`Folder "${args.name}" already exists`);
    }

    return await ctx.db.insert("sessionFolders", {
      sessionId: args.sessionId,
      userId: args.userId,
      name: args.name,
      parentFolderId: args.parentFolderId,
      createdAt: Date.now(),
      path,
    });
  },
});

// Delete a folder and all its contents
export const deleteFolder = mutation({
  args: {
    folderId: v.id("sessionFolders"),
    sessionId: v.id("collaborativeSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Check if folder exists and belongs to session
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.sessionId !== args.sessionId) {
      throw new Error("Folder not found");
    }

    // Recursively delete all subfolders and files
    const deleteRecursively = async (folderId: string) => {
      // Get all child folders
      const childFolders = await ctx.db
        .query("sessionFolders")
        .withIndex("by_parent_folder", (q) => q.eq("parentFolderId", folderId as any))
        .collect();

      // Recursively delete child folders
      for (const childFolder of childFolders) {
        await deleteRecursively(childFolder._id);
      }

      // Delete all files in this folder
      const files = await ctx.db
        .query("sessionFiles")
        .withIndex("by_folder_id", (q) => q.eq("folderId", folderId as any))
        .collect();

      for (const file of files) {
        await ctx.db.delete(file._id);
      }

      // Delete the folder itself
      await ctx.db.delete(folderId as any);
    };

    await deleteRecursively(args.folderId);
  },
});