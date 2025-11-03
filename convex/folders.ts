// DOCUMENTED BY SCRIPT - Phase 2
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new folder
export const createFolder = mutation({
  args: {
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { name, parentFolderId, userId } = args;
    
    // Calculate the path
    let path = "";
    if (parentFolderId) {
      const parentFolder = await ctx.db.get(parentFolderId);
      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }
      if (parentFolder.userId !== userId) {
        throw new Error("Permission denied");
      }
      path = `${parentFolder.path}/${name}`;
    } else {
      path = `/${name}`;
    }

    // Check if folder with same name exists in same location
    const existingFolder = await ctx.db
      .query("folders")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("name"), name),
          parentFolderId 
            ? q.eq(q.field("parentFolderId"), parentFolderId)
            : q.eq(q.field("parentFolderId"), undefined)
        )
      )
      .first();

    if (existingFolder) {
      throw new Error("Folder with this name already exists");
    }

    const folderId = await ctx.db.insert("folders", {
      userId,
      name,
      parentFolderId,
      isShared: false,
      createdAt: Date.now(),
      path,
    });

    return folderId;
  },
});

// Get user's folders
export const getUserFolders = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    return folders;
  },
});

// Get folders by parent
export const getFoldersByParent = query({
  args: {
    userId: v.string(),
    parentFolderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_parent_folder", (q) => 
        args.parentFolderId 
          ? q.eq("parentFolderId", args.parentFolderId)
          : q.eq("parentFolderId", undefined)
      )
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    return folders;
  },
});

// Rename folder
export const renameFolder = mutation({
  args: {
    folderId: v.id("folders"),
    newName: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { folderId, newName, userId } = args;

    const folder = await ctx.db.get(folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (folder.userId !== userId) {
      throw new Error("Permission denied");
    }

    // Update path
    const oldPath = folder.path;
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    await ctx.db.patch(folderId, {
      name: newName,
      path: newPath,
    });

    // Update all subfolders and files paths
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    const allFiles = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    // Update subfolder paths
    for (const subfolder of allFolders) {
      if (subfolder.path.startsWith(oldPath + '/')) {
        const newSubfolderPath = subfolder.path.replace(oldPath, newPath);
        await ctx.db.patch(subfolder._id, {
          path: newSubfolderPath,
        });
      }
    }

    // Update file paths
    for (const file of allFiles) {
      if (file.path.startsWith(oldPath + '/')) {
        const newFilePath = file.path.replace(oldPath, newPath);
        await ctx.db.patch(file._id, {
          path: newFilePath,
        });
      }
    }

    return { success: true };
  },
});

// Delete folder and all its contents
export const deleteFolder = mutation({
  args: {
    folderId: v.id("folders"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { folderId, userId } = args;

    const folder = await ctx.db.get(folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (folder.userId !== userId) {
      throw new Error("Permission denied");
    }

    // Get all subfolders
    const subfolders = await ctx.db
      .query("folders")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("path"), folder.path + '/'))
      .filter((q) => q.lt(q.field("path"), folder.path + '0'))
      .collect();

    // Get all files in this folder and subfolders
    const files = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("path"), folder.path + '/'))
      .filter((q) => q.lt(q.field("path"), folder.path + '0'))
      .collect();

    // Also get files directly in this folder
    const directFiles = await ctx.db
      .query("practiceFiles")
      .withIndex("by_folder_id", (q) => q.eq("folderId", folderId))
      .collect();

    // Delete all files
    for (const file of [...files, ...directFiles]) {
      await ctx.db.delete(file._id);
    }

    // Delete all subfolders
    for (const subfolder of subfolders) {
      await ctx.db.delete(subfolder._id);
    }

    // Delete the folder itself
    await ctx.db.delete(folderId);

    return { success: true };
  },
});

// Get folder tree structure
export const getFolderTree = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    const files = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    // Build tree structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildTree = (parentId: string | undefined): any[] => {
      const children = folders
        .filter(f => f.parentFolderId === parentId)
        .map(folder => ({
          ...folder,
          type: 'folder' as const,
          children: buildTree(folder._id),
          files: files.filter(f => f.folderId === folder._id),
        }));

      return children;
    };

    // Get root folders and files
    const rootFolders = buildTree(undefined);
    const rootFiles = files.filter(f => !f.folderId);

    return {
      folders: rootFolders,
      files: rootFiles,
    };
  },
});