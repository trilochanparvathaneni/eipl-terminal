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

describe("POST /api/chat role-aware bay availability", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOpsSnapshotMock.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      terminalId: "t1",
      activeBays: {
        total: 6,
        active: 4,
        maintenance: 1,
        blocked: 1,
        idle: 2,
        lpgActive: 2,
        polOrChemicalActive: 2,
      },
      queue: {
        total: 8,
        yard: 2,
        queue: 4,
        weighbridge: 1,
        gantry: 1,
      },
      bookingsToday: {
        total: 12,
        lpg: 6,
        polOrChemical: 6,
      },
      safety: {
        openIncidentCount: 3,
        blockingIncidentCount: 1,
        activeStopWorkCount: 0,
        blockedComplianceCount: 1,
        terminalHalt: false,
      },
      dataGaps: [],
    })
  })

  it("returns redacted response for CLIENT role", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u-client",
      role: "CLIENT",
      terminalId: "t1",
      clientId: "c1",
    })

    const { POST } = await import("@/app/api/chat/route")
    const response = await POST(makeRequest("Do we have bays available?"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.metrics.some((m: { key: string }) => m.key.includes("active_bays"))).toBe(false)
    expect(body.metrics.some((m: { key: string }) => m.key.includes("open_incidents"))).toBe(false)
    expect(Array.isArray(body.blockers)).toBe(true)
    expect(body.blockers.length).toBe(0)
  })

  it("returns internal metrics for TERMINAL_ADMIN role", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u-ops",
      role: "TERMINAL_ADMIN",
      terminalId: "t1",
      clientId: null,
    })

    const { POST } = await import("@/app/api/chat/route")
    const response = await POST(makeRequest("Do we have bays available?"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.metrics.some((m: { key: string }) => m.key === "active_bays")).toBe(true)
    expect(body.metrics.some((m: { key: string }) => m.key === "open_incidents")).toBe(true)
    expect(body.blockers.length).toBeGreaterThan(0)
    expect(body.action_buttons.some((a: { url: string }) => a.url === "/terminal/bays")).toBe(true)
  })
})
