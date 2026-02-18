import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { TOOL_REGISTRY } from "@/lib/copilot/tool-registry"
import { buildOpsResponse, buildErrorResponse } from "@/lib/copilot/response-builder"
import { handleMissingIntegration } from "@/lib/copilot/missing-integration"

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: { toolId: string; extractedParams?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(buildErrorResponse("Invalid request body"), { status: 400 })
  }

  const { toolId, extractedParams = {} } = body

  if (!toolId) {
    return NextResponse.json(buildErrorResponse("Missing toolId"), { status: 400 })
  }

  const tool = TOOL_REGISTRY[toolId]
  if (!tool) {
    return NextResponse.json(buildErrorResponse(`Unknown tool: ${toolId}`), { status: 400 })
  }

  // Check if tool is integrated
  if (!tool.integrated) {
    return NextResponse.json(handleMissingIntegration(toolId))
  }

  // Permission check
  if (!hasPermission(user!.role, tool.requiredPermission)) {
    return NextResponse.json(
      buildErrorResponse("You don't have access to this data. Contact your administrator if you believe this is an error."),
      { status: 403 }
    )
  }

  try {
    // Build the internal API URL
    const origin = req.nextUrl.origin
    let url = `${origin}${tool.endpoint}`

    // Append query params for GET requests
    if (tool.method === "GET" && Object.keys(extractedParams).length > 0) {
      const searchParams = new URLSearchParams(extractedParams)
      url += `?${searchParams.toString()}`
    }

    // Forward the request to the internal API with cookie forwarding
    const cookie = req.headers.get("cookie") ?? ""
    const internalResponse = await fetch(url, {
      method: tool.method,
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      ...(tool.method === "POST" ? { body: JSON.stringify(extractedParams) } : {}),
    })

    if (!internalResponse.ok) {
      const errorText = await internalResponse.text().catch(() => "Unknown error")
      return NextResponse.json(
        buildErrorResponse(`Failed to fetch data (${internalResponse.status}). Please try again.`),
        { status: 502 }
      )
    }

    const data = await internalResponse.json()
    const formatted = tool.formatResponse(data)
    return NextResponse.json(buildOpsResponse(formatted))
  } catch (err) {
    console.error(`[chat/ops] Error fetching ${toolId}:`, err)
    return NextResponse.json(
      buildErrorResponse("Something went wrong while fetching data. Please try again later."),
      { status: 500 }
    )
  }
}
