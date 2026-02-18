import type { SessionUser } from "@/lib/auth-utils"

export interface ChatToolContext {
  user: SessionUser
  requestId: string
}

export interface ChatToolResult {
  data: unknown
  citations?: { documentId: string; snippet: string }[]
  recordIds?: { type: string; id: string }[]
}

export type ChatToolFn = (
  params: Record<string, unknown>,
  ctx: ChatToolContext
) => Promise<ChatToolResult>
