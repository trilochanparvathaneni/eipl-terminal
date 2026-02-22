import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { TOOL_REGISTRY } from "@/lib/copilot/tool-registry"
import { buildErrorResponse, buildOpsResponse, type CopilotMessage } from "@/lib/copilot/response-builder"
import { applyProactiveReasoning } from "@/lib/copilot/proactive-reasoning"
import { buildAssistContract } from "@/lib/copilot/assist-contract"

interface ChatOpsBody {
  toolId?: string
  extractedParams?: Record<string, string>
  rawQuery?: string
}

function withParams(endpoint: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return endpoint
  const qp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim()) qp.set(k, v)
  }
  const query = qp.toString()
  if (!query) return endpoint
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query}`
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(buildErrorResponse("Unauthorized"), { status: 401 })
  }

  let body: ChatOpsBody = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(buildErrorResponse("Invalid request payload"), { status: 400 })
  }

  const toolId = body.toolId?.trim()
  if (!toolId) {
    return NextResponse.json(buildErrorResponse("Missing tool id"), { status: 400 })
  }

  const tool = TOOL_REGISTRY[toolId]
  if (!tool || !tool.integrated) {
    return NextResponse.json(buildErrorResponse("Requested assistant capability is not available yet"), { status: 404 })
  }

  if (!hasPermission(user.role, tool.requiredPermission)) {
    return NextResponse.json(
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender: "bot",
        text: "You don't have access to this data. Contact your administrator if you believe this is an error.",
        error: `Permission denied for ${toolId}`,
      } satisfies CopilotMessage,
      { status: 403 }
    )
  }

  try {
    const fetchInternalJson = async (endpoint: string): Promise<any | null> => {
      const response = await fetch(new URL(endpoint, request.nextUrl.origin), {
        method: "GET",
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      })
      if (!response.ok) return null
      return response.json()
    }

    // Keep calls internal and authenticated by forwarding cookies.
    if (tool.method === "POST") {
      const formatted = tool.formatResponse({})
      formatted.assistResponse = buildAssistContract({
        toolId: tool.id,
        data: {},
        formatted,
        user,
      })
      return NextResponse.json(buildOpsResponse(formatted))
    }

    const params = { ...(body.extractedParams ?? {}) }
    if (body.rawQuery) {
      params.rawQuery = body.rawQuery
    }
    const endpoint = withParams(tool.endpoint, params)
    const upstream = await fetch(new URL(endpoint, request.nextUrl.origin), {
      method: "GET",
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    })

    if (!upstream.ok) {
      return NextResponse.json(buildErrorResponse("Assistant could not fetch the requested data"), { status: upstream.status })
    }

    const data = await upstream.json()
    const formatted = tool.formatResponse(data)
    const proactive = await applyProactiveReasoning({
      toolId: tool.id,
      primaryData: data,
      fetchedAt: new Date(),
      rawQuery: body.rawQuery,
      fetchInternalJson,
    })

    if (proactive) {
      formatted.breakdown = [...(formatted.breakdown ?? []), ...(proactive.breakdown ?? [])]
      formatted.recommendedActions = [...(formatted.recommendedActions ?? []), ...(proactive.recommendedActions ?? [])]
      formatted.actions = [...(formatted.actions ?? []), ...(proactive.actions ?? [])]
    }
    formatted.assistResponse = buildAssistContract({
      toolId: tool.id,
      data,
      formatted,
      user,
    })
    return NextResponse.json(buildOpsResponse(formatted))
  } catch {
    return NextResponse.json(buildErrorResponse("Assistant is temporarily unavailable. Please try again."), { status: 500 })
  }
}
