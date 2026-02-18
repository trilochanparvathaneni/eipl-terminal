import type { ChatCompletionTool } from "openai/resources/chat/completions"
import { createAuditLog } from "@/lib/audit"
import { redactParams } from "@/lib/ai/redact"
import { logger } from "@/lib/logger"
import { searchKnowledgeTool } from "./search-knowledge"
import { getEntityTool } from "./get-entity"
import { searchEntitiesTool } from "./search-entities"
import { getRecentActivityTool } from "./get-recent-activity"
import type { ChatToolContext, ChatToolFn, ChatToolResult } from "./types"

export type { ChatToolContext, ChatToolResult }

// ── OpenAI function schemas ─────────────────────────────────────────────────

export const CHAT_TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description:
        "Search uploaded documents and knowledge base for relevant information. Use this to answer questions about specific documents, procedures, or policies.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          filters: {
            type: "object",
            properties: {
              document_type: { type: "string", description: "Filter by document type code" },
              link_type: { type: "string", enum: ["BOOKING", "TRUCK_TRIP", "PRODUCT", "CLIENT"] },
              link_id: { type: "string", description: "Filter by linked entity ID" },
            },
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_entity",
      description:
        "Get detailed information about a specific entity by its ID. Use when you know the exact entity ID.",
      parameters: {
        type: "object",
        properties: {
          entity_type: {
            type: "string",
            enum: ["booking", "truck_trip", "incident", "client", "transporter", "product", "terminal"],
          },
          id: { type: "string", description: "The entity ID" },
        },
        required: ["entity_type", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_entities",
      description:
        "Search for entities matching criteria. Use to find bookings, trips, incidents, etc. by status, date, or text query.",
      parameters: {
        type: "object",
        properties: {
          entity_type: {
            type: "string",
            enum: ["booking", "truck_trip", "incident", "client", "transporter", "product", "terminal"],
          },
          query: { type: "string", description: "Free-text search query" },
          filters: {
            type: "object",
            properties: {
              status: { type: "string", description: "Filter by status" },
              date_from: { type: "string", description: "ISO date string start" },
              date_to: { type: "string", description: "ISO date string end" },
              severity: { type: "string", enum: ["LOW", "MED", "HIGH"] },
            },
          },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
        required: ["entity_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_activity",
      description:
        "Get recent operational activity including audit logs, gate events, and incidents. Use to understand what has been happening recently.",
      parameters: {
        type: "object",
        properties: {
          date_range: {
            type: "object",
            properties: {
              from: { type: "string", description: "ISO date string start" },
              to: { type: "string", description: "ISO date string end" },
            },
          },
          filters: {
            type: "object",
            properties: {
              entity_type: { type: "string", description: "Filter by entity type" },
              action: { type: "string", description: "Filter by action type" },
            },
          },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
]

// ── Executor map ────────────────────────────────────────────────────────────

const CHAT_TOOL_EXECUTORS: Record<string, ChatToolFn> = {
  search_knowledge: searchKnowledgeTool,
  get_entity: getEntityTool,
  search_entities: searchEntitiesTool,
  get_recent_activity: getRecentActivityTool,
}

/**
 * Execute a tool by name, validate, audit log, and return result.
 */
export async function executeTool(
  name: string,
  paramsJson: string,
  ctx: ChatToolContext
): Promise<ChatToolResult> {
  const executor = CHAT_TOOL_EXECUTORS[name]
  if (!executor) {
    return { data: { error: `Unknown tool: ${name}` } }
  }

  let params: Record<string, unknown>
  try {
    params = JSON.parse(paramsJson)
  } catch {
    return { data: { error: "Invalid tool parameters" } }
  }

  try {
    const result = await executor(params, ctx)

    // Audit log the tool call with redacted params
    await createAuditLog({
      actorUserId: ctx.user.id,
      entityType: "chat_tool",
      entityId: ctx.requestId,
      action: `tool:${name}`,
      after: {
        params: redactParams(params),
        resultSummary: Array.isArray((result.data as any)?.results)
          ? `${(result.data as any).count} results`
          : "single result",
      },
    })

    return result
  } catch (error) {
    logger.error({ error, tool: name, params: redactParams(params) }, "Tool execution failed")
    return { data: { error: "Tool execution failed" } }
  }
}
