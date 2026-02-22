import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserMock = vi.fn()
const hasPermissionMock = vi.fn()
const applyProactiveReasoningMock = vi.fn()
const buildAssistContractMock = vi.fn()

vi.mock("@/lib/auth-utils", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("@/lib/rbac", () => ({
  hasPermission: hasPermissionMock,
}))

vi.mock("@/lib/copilot/proactive-reasoning", () => ({
  applyProactiveReasoning: applyProactiveReasoningMock,
}))

vi.mock("@/lib/copilot/assist-contract", () => ({
  buildAssistContract: buildAssistContractMock,
}))

vi.mock("@/lib/copilot/tool-registry", () => ({
  TOOL_REGISTRY: {
    get_tool: {
      id: "get_tool",
      endpoint: "/api/dummy",
      method: "GET",
      requiredPermission: "booking:read",
      integrated: true,
      description: "dummy get",
      formatResponse: () => ({
        answer: "GET tool response",
        source: "Dummy GET",
      }),
    },
    post_tool: {
      id: "post_tool",
      endpoint: "/api/dummy-post",
      method: "POST",
      requiredPermission: "incident:create",
      integrated: true,
      description: "dummy post",
      formatResponse: () => ({
        answer: "POST tool response",
        source: "Dummy POST",
      }),
    },
  },
}))

function makeRequest(body: unknown): any {
  return {
    json: async () => body,
    headers: new Headers(),
    nextUrl: new URL("http://localhost/api/chat/ops"),
  }
}

describe("POST /api/chat/ops integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasPermissionMock.mockReturnValue(true)
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      name: "Ops User",
      email: "ops@example.com",
      role: "TERMINAL_ADMIN",
      clientId: null,
      transporterId: null,
      terminalId: "t1",
    })
    applyProactiveReasoningMock.mockResolvedValue(null)
    buildAssistContractMock.mockReturnValue({
      kind: "ops_availability",
      intent: "availability_allotment",
      role: "internal_ops",
      headline: "Contract Headline",
      summary: "Contract Summary",
      status: { label: "Operational Insight", severity: "info" },
      metrics: [],
      actions: [],
    })
  })

  it("includes assistResponse for integrated GET tool", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ any: "payload" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    const { POST } = await import("@/app/api/chat/ops/route")
    const response = await POST(makeRequest({ toolId: "get_tool", extractedParams: {} }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.assistResponse).toBeDefined()
    expect(buildAssistContractMock).toHaveBeenCalledTimes(1)
  })

  it("includes assistResponse for integrated POST tool", async () => {
    const { POST } = await import("@/app/api/chat/ops/route")
    const response = await POST(makeRequest({ toolId: "post_tool", extractedParams: {} }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.assistResponse).toBeDefined()
    expect(buildAssistContractMock).toHaveBeenCalledTimes(1)
  })
})
