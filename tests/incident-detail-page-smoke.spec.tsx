import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserMock = vi.fn()
const findUniqueMock = vi.fn()
const enforceTerminalAccessMock = vi.fn()

vi.mock("@/lib/auth-utils", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    incident: {
      findUnique: findUniqueMock,
    },
  },
}))

vi.mock("@/lib/auth/scope", () => ({
  enforceTerminalAccess: enforceTerminalAccessMock,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

describe("incident detail page smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceTerminalAccessMock.mockReturnValue(null)
  })

  it("renders incident detail for internal user", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "TERMINAL_ADMIN",
      terminalId: "t1",
    })
    findUniqueMock.mockResolvedValue({
      id: "cmlowm7hq08t2cj3txgsgr75u",
      status: "OPEN",
      severity: "HIGH",
      description: "Gas leak observed at gantry lane 2.",
      terminalId: "t1",
      bookingId: null,
      createdAt: new Date("2026-02-21T12:00:00.000Z"),
      terminal: { name: "Vizag", location: "Gantry Lane 2" },
      booking: null,
      reportedBy: { name: "Shift HSE" },
    })

    const mod = await import("@/app/hse/incidents/[id]/page")
    const view = await mod.default({ params: { id: "cmlowm7hq08t2cj3txgsgr75u" } })
    render(view as any)

    expect(screen.getByText(/Incident #cmlowm7hq08t2cj3txgsgr75u/i)).toBeTruthy()
    expect(screen.getByText(/Gas leak observed/i)).toBeTruthy()
  })

  it("shows not authorized copy for client role", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u2",
      role: "CLIENT",
      terminalId: "t1",
    })

    const mod = await import("@/app/hse/incidents/[id]/page")
    const view = await mod.default({ params: { id: "cmlowm7hq08t2cj3txgsgr75u" } })
    render(view as any)

    expect(screen.getByText(/don't have access/i)).toBeTruthy()
  })
})
