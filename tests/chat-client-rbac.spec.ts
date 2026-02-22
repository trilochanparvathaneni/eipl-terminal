import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserMock = vi.fn()
const getOpsSnapshotMock = vi.fn()

vi.mock("@/lib/auth-utils", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("@/lib/assist/snapshot", () => ({
  getOpsSnapshot: getOpsSnapshotMock,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
}))

function makeRequest(message: string): any {
  return {
    json: async () => ({ message }),
  }
}

describe("POST /api/chat client fallback redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUserMock.mockResolvedValue({
      id: "u-client",
      role: "CLIENT",
      terminalId: "t1",
      clientId: "c1",
    })
    getOpsSnapshotMock.mockRejectedValue(new Error("snapshot unavailable"))
  })

  it("never returns internal contingency language for client", async () => {
    const { POST } = await import("@/app/api/chat/route")
    const response = await POST(makeRequest("Do we have bays available?"))
    const body = await response.json()
    const text = `${body.reply_text} ${body.action_buttons?.map((a: any) => a.label).join(" ")}`.toLowerCase()

    expect(response.status).toBe(200)
    expect(text.includes("hse")).toBe(false)
    expect(text.includes("checklist")).toBe(false)
    expect(text.includes("gate-in")).toBe(false)
    expect(text.includes("escalate")).toBe(false)
    expect(text.includes("control room escalation")).toBe(false)
  })
})
