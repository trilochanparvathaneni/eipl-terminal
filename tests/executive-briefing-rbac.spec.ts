import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserMock = vi.fn()
const incidentCountMock = vi.fn()
const truckTripCountMock = vi.fn()
const bookingCountMock = vi.fn()
const inventoryAggregateMock = vi.fn()
const complianceCountMock = vi.fn()
const incidentFindFirstMock = vi.fn()

vi.mock("@/lib/auth-utils", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    incident: {
      count: incidentCountMock,
      findFirst: incidentFindFirstMock,
    },
    truckTrip: {
      count: truckTripCountMock,
    },
    booking: {
      count: bookingCountMock,
    },
    inventoryLot: {
      aggregate: inventoryAggregateMock,
    },
    complianceGateResult: {
      count: complianceCountMock,
    },
  },
}))

describe("GET /api/intelligence/executive-briefing RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns client-safe summary for CLIENT role", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u-client",
      role: "CLIENT",
      terminalId: "t1",
      clientId: "c1",
    })
    truckTripCountMock
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
    bookingCountMock.mockResolvedValueOnce(1)

    const { GET } = await import("@/app/api/intelligence/executive-briefing/route")
    const response = await GET()
    const body = await response.json()
    const text = `${body.headline} ${body.key_metrics?.join(" ")} ${body.primary_action?.label}`.toLowerCase()

    expect(response.status).toBe(200)
    expect(text.includes("incident")).toBe(false)
    expect(text.includes("inventory")).toBe(false)
    expect(text.includes("gantry")).toBe(false)
    expect(body.primary_action.action_url).toBe("/bookings")
  })

  it("returns internal briefing for TERMINAL_ADMIN role", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u-ops",
      role: "TERMINAL_ADMIN",
      terminalId: "t1",
      clientId: null,
    })
    incidentCountMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    truckTripCountMock.mockResolvedValueOnce(8).mockResolvedValueOnce(0)
    inventoryAggregateMock.mockResolvedValue({ _sum: { quantityAvailable: 9500 } })
    complianceCountMock.mockResolvedValueOnce(3)
    incidentFindFirstMock.mockResolvedValue({
      id: "cmlowm7hq08t2cj3txgsgr75u",
      description: "Open incident",
    })

    const { GET } = await import("@/app/api/intelligence/executive-briefing/route")
    const response = await GET()
    const body = await response.json()
    const text = `${body.headline} ${body.key_metrics?.join(" ")} ${body.primary_action?.label}`.toLowerCase()

    expect(response.status).toBe(200)
    expect(text.includes("incident")).toBe(true)
    expect(body.primary_action.action_url).toContain("/hse/incidents/")
  })
})
