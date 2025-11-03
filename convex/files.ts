// DOCUMENTED BY SCRIPT - Phase 2
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new file
export const createFile = mutation({
  args: {
    name: v.string(),
    language: v.string(),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { name, language, code, description, folderId, userId } = args;
    
    // Calculate the path
    let path = "";
    if (folderId) {
      const folder = await ctx.db.get(folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.userId !== userId) {
        throw new Error("Permission denied");
      }
      path = `${folder.path}/${name}`;
    } else {
      path = `/${name}`;
    }

    // Check if file with same name exists in same location
    const existingFile = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_and_folder", (q) => 
        q.eq("userId", userId).eq("folderId", folderId)
      )
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (existingFile) {
      throw new Error("File with this name already exists in this location");
    }

    const now = Date.now();
    const fileId = await ctx.db.insert("practiceFiles", {
      userId,
      folderId,
      name,
      language,
      code: code || getDefaultCodeForLanguage(language),
      description,
      isShared: false,
      createdAt: now,
      updatedAt: now,
      path,
    });

    return fileId;
  },
});

// Get user's files
export const getUserFiles = query({
  args: {
    userId: v.string(),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_and_folder", (q) => 
        q.eq("userId", args.userId).eq("folderId", args.folderId)
      )
      .collect();

    return files.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Get file by ID
export const getFile = query({
  args: {
    fileId: v.id("practiceFiles"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    
    if (!file) {
      throw new Error("File not found");
    }

    if (file.userId !== args.userId && !file.isShared) {
      throw new Error("Permission denied");
    }

    return file;
  },
});

// Update file content
export const updateFile = mutation({
  args: {
    fileId: v.id("practiceFiles"),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { fileId, code, description, userId } = args;

    const file = await ctx.db.get(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    if (file.userId !== userId) {
      throw new Error("Permission denied");
    }

    const updateData: {
      updatedAt: number;
      code?: string;
      description?: string;
    } = {
      updatedAt: Date.now(),
    };

    if (code !== undefined) {
      updateData.code = code;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    await ctx.db.patch(fileId, updateData);

    return { success: true };
  },
});

// Rename file
export const renameFile = mutation({
  args: {
    fileId: v.id("practiceFiles"),
    newName: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { fileId, newName, userId } = args;

    const file = await ctx.db.get(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    if (file.userId !== userId) {
      throw new Error("Permission denied");
    }

    // Check if file with same name exists in same location
    const existingFile = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_and_folder", (q) => 
        q.eq("userId", userId).eq("folderId", file.folderId)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("name"), newName),
          q.neq(q.field("_id"), fileId)
        )
      )
      .first();

    if (existingFile) {
      throw new Error("File with this name already exists in this location");
    }

    // Update path
    const pathParts = file.path.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    await ctx.db.patch(fileId, {
      name: newName,
      path: newPath,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Delete file
export const deleteFile = mutation({
  args: {
    fileId: v.id("practiceFiles"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { fileId, userId } = args;

    const file = await ctx.db.get(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    if (file.userId !== userId) {
      throw new Error("Permission denied");
    }

    await ctx.db.delete(fileId);

    return { success: true };
  },
});

// Move file to different folder
export const moveFile = mutation({
  args: {
    fileId: v.id("practiceFiles"),
    targetFolderId: v.optional(v.id("folders")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { fileId, targetFolderId, userId } = args;

    const file = await ctx.db.get(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    if (file.userId !== userId) {
      throw new Error("Permission denied");
    }

    // Validate target folder
    if (targetFolderId) {
      const targetFolder = await ctx.db.get(targetFolderId);
      if (!targetFolder) {
        throw new Error("Target folder not found");
      }
      if (targetFolder.userId !== userId) {
        throw new Error("Permission denied");
      }
    }

    // Check if file with same name exists in target location
    const existingFile = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_and_folder", (q) => 
        q.eq("userId", userId).eq("folderId", targetFolderId)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("name"), file.name),
          q.neq(q.field("_id"), fileId)
        )
      )
      .first();

    if (existingFile) {
      throw new Error("File with this name already exists in target location");
    }

    // Calculate new path
    let newPath = "";
    if (targetFolderId) {
      const targetFolder = await ctx.db.get(targetFolderId);
      newPath = `${targetFolder!.path}/${file.name}`;
    } else {
      newPath = `/${file.name}`;
    }

    await ctx.db.patch(fileId, {
      folderId: targetFolderId,
      path: newPath,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Search files
export const searchFiles = query({
  args: {
    userId: v.string(),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, searchTerm } = args;

    const files = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    // Filter files that match search term in name, description, or code
    const filteredFiles = files.filter(file => 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (file.description && file.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      file.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filteredFiles.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Get recent files
export const getRecentFiles = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, limit = 10 } = args;

    const files = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    return files
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  },
});

// Get file statistics
export const getFileStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("practiceFiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((acc, file) => acc + file.code.length, 0),
      languageBreakdown: {} as Record<string, number>,
      recentActivity: files.filter(file => 
        Date.now() - file.updatedAt < 7 * 24 * 60 * 60 * 1000 // Last 7 days
      ).length,
    };

    // Calculate language breakdown
    files.forEach(file => {
      stats.languageBreakdown[file.language] = 
        (stats.languageBreakdown[file.language] || 0) + 1;
    });

    return stats;
  },
});

// Batch operations
export const batchDeleteFiles = mutation({
  args: {
    fileIds: v.array(v.id("practiceFiles")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { fileIds, userId } = args;
    const results = [];

    for (const fileId of fileIds) {
      try {
        const file = await ctx.db.get(fileId);
        if (!file) {
          results.push({ fileId, success: false, error: "File not found" });
          continue;
        }

        if (file.userId !== userId) {
          results.push({ fileId, success: false, error: "Permission denied" });
          continue;
        }

        await ctx.db.delete(fileId);
        results.push({ fileId, success: true });
      } catch (error) {
        results.push({ 
          fileId, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    return results;
  },
});

// Helper function to get default code for language
function getDefaultCodeForLanguage(language: string): string {
  const defaults: Record<string, string> = {
    javascript: `// Welcome to your new JavaScript file!\nconsole.log("Hello, World!");`,
    python: `# Welcome to your new Python file!\nprint("Hello, World!")`,
    java: `// Welcome to your new Java file!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    cpp: `// Welcome to your new C++ file!\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
    c: `// Welcome to your new C file!\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`,
    go: `// Welcome to your new Go file!\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
    rust: `// Welcome to your new Rust file!\nfn main() {\n    println!("Hello, World!");\n}`,
    typescript: `// Welcome to your new TypeScript file!\nconsole.log("Hello, World!");`,
    html: `<!-- Welcome to your new HTML file! -->\n<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>`,
    css: `/* Welcome to your new CSS file! */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}`,
  };

  return defaults[language] || `// Welcome to your new ${language} file!\n`;
}