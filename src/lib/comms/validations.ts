import { z } from "zod"

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
  audience: z.enum(["INTERNAL_ONLY", "MIXED"]).default("INTERNAL_ONLY"),
  memberUserIds: z.array(z.string().cuid()).min(0).default([]),
})

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(10000),
  mentions: z
    .array(
      z.object({
        userId: z.string().cuid(),
        mentionType: z.enum(["INTERNAL", "EXTERNAL"]),
      })
    )
    .default([]),
})

export const addMemberSchema = z.object({
  userId: z.string().cuid(),
  memberRole: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
})

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().cuid().optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  visibility: z.enum(["INTERNAL_ONLY", "SHARED_WITH_CLIENT"]).default("INTERNAL_ONLY"),
  conversationId: z.string().cuid().optional(),
  messageId: z.string().cuid().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  visibility: z.enum(["INTERNAL_ONLY", "SHARED_WITH_CLIENT"]).optional(),
})
