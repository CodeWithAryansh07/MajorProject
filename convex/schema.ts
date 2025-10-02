import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        userId: v.string(), // clerkId
        email: v.string(),
        name: v.string(),
        isPro: v.boolean(),
        proSince: v.optional(v.number()),
        lemonSqueezyCustomerId: v.optional(v.string()),
        lemonSqueezyOrderId: v.optional(v.string()),
    }).index("by_user_id", ["userId"]),

    codeExecutions: defineTable({
        userId: v.string(),
        language: v.string(),
        code: v.string(),
        output: v.optional(v.string()),
        error: v.optional(v.string()),
    }).index("by_user_id", ["userId"]),

    snippets: defineTable({
        userId: v.string(),
        title: v.string(),
        language: v.string(),
        code: v.string(),
        userName: v.string(), // store user's name for easy access
    }).index("by_user_id", ["userId"]),

    snippetComments: defineTable({
        snippetId: v.id("snippets"),
        userId: v.string(),
        userName: v.string(),
        content: v.string(), // This will store HTML content
    }).index("by_snippet_id", ["snippetId"]),

    stars: defineTable({
        userId: v.string(),
        snippetId: v.id("snippets"),
    })
        .index("by_user_id", ["userId"])
        .index("by_snippet_id", ["snippetId"])
        .index("by_user_id_and_snippet_id", ["userId", "snippetId"]),

    // File System Tables
    folders: defineTable({
        userId: v.string(),
        name: v.string(),
        parentFolderId: v.optional(v.id("folders")),
        isShared: v.boolean(),
        createdAt: v.number(),
        path: v.string(), // full path like "/DSA Practice/Arrays"
    })
        .index("by_user_id", ["userId"])
        .index("by_parent_folder", ["parentFolderId"]),

    practiceFiles: defineTable({
        userId: v.string(),
        folderId: v.optional(v.id("folders")),
        name: v.string(),
        language: v.string(),
        code: v.string(),
        description: v.optional(v.string()),
        isShared: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
        path: v.string(), // full file path
    })
        .index("by_user_id", ["userId"])
        .index("by_folder_id", ["folderId"])
        .index("by_user_and_folder", ["userId", "folderId"]),

    // Collaboration Tables
    collaborativeSessions: defineTable({
        name: v.string(),
        creatorId: v.string(),
        sessionKey: v.string(), // URL-friendly unique identifier
        language: v.string(),
        code: v.string(),
        description: v.optional(v.string()), // Session description
        isPublic: v.boolean(),
        isActive: v.boolean(),
        activeUsers: v.array(v.string()),
        maxUsers: v.number(),
        createdAt: v.number(),
        lastActivity: v.number(),
        status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("scheduled_for_deletion"))),
        expiresAt: v.optional(v.number()),
        originalSavedSessionId: v.optional(v.id("savedSessions")), // Reference to saved session if loaded from one
        // Additional session settings
        sessionSettings: v.optional(v.object({
            allowGuests: v.optional(v.boolean()),
            autoSave: v.optional(v.boolean()),
            theme: v.optional(v.string()),
        })),
    })
        .index("by_creator_id", ["creatorId"])
        .index("by_is_public", ["isPublic"])
        .index("by_is_active", ["isActive"])
        .index("by_status", ["status"])
        .index("by_expires_at", ["expiresAt"])
        .index("by_session_key", ["sessionKey"])
        .index("by_original_saved_session", ["originalSavedSessionId"]),

    sessionParticipants: defineTable({
        sessionId: v.id("collaborativeSessions"),
        userId: v.string(),
        userName: v.string(),
        permission: v.union(v.literal("read"), v.literal("write")),
        joinedAt: v.number(),
        lastActive: v.number(),
        isActive: v.boolean(),
        lastSeen: v.optional(v.number()), // Make this optional too for existing records
    })
        .index("by_session_id", ["sessionId"])
        .index("by_user_id", ["userId"])
        .index("by_session_and_user", ["sessionId", "userId"])
        .index("by_last_active", ["lastActive"])
        .index("by_is_active", ["isActive"]),

    // Real-time code operations for collaboration
    codeOperations: defineTable({
        sessionId: v.id("collaborativeSessions"),
        userId: v.string(),
        operation: v.object({
            type: v.string(), // "insert", "delete", "replace"
            position: v.number(),
            content: v.string(),
            length: v.optional(v.number()),
        }),
        timestamp: v.number(),
    }).index("by_session_id", ["sessionId"]),

    // Session chat messages
    sessionMessages: defineTable({
        sessionId: v.id("collaborativeSessions"),
        userId: v.string(),
        userName: v.string(),
        message: v.string(),
        timestamp: v.number(),
    }).index("by_session_id", ["sessionId"]),

    // Saved sessions - persistent user sessions
    savedSessions: defineTable({
        userId: v.string(),
        originalSessionId: v.optional(v.id("collaborativeSessions")), // Track original session
        name: v.string(),
        language: v.string(),
        code: v.string(),
        description: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
        tags: v.optional(v.array(v.string())),
        isPrivate: v.boolean(),
        // Session metadata to preserve when loading
        maxUsers: v.optional(v.number()), // Maximum users allowed in the session
        sessionSettings: v.optional(v.object({
            allowGuests: v.optional(v.boolean()),
            autoSave: v.optional(v.boolean()),
            theme: v.optional(v.string()),
        })),
    }).index("by_user_id", ["userId"])
      .index("by_created_at", ["createdAt"])
      .index("by_updated_at", ["updatedAt"])
      .index("by_user_and_original_session", ["userId", "originalSessionId"]),
});