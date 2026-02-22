import { describe, expect, it } from "vitest"
import { buildAssistContract } from "@/lib/copilot/assist-contract"

const baseUser = {
  id: "u1",
  name: "Ops User",
  email: "ops@example.com",
  role: "TERMINAL_ADMIN",
  clientId: null,
  transporterId: null,
  terminalId: "t1",
} as any

describe("assist contract builder", () => {
  it("builds deterministic danger contract for yard-without-trips scenario", () => {
    const result = buildAssistContract({
      toolId: "dashboard_stats",
      data: { inTerminal: 4, todayTrips: 0, totalBookings: 8, openIncidents: 2 },
      formatted: {
        answer: "4 trucks in yard and 0 trips scheduled.",
        source: "Dashboard Stats",
        breakdown: ["[STATUS] Movement blocked by open incident stream."],
        actions: [{ id: "open-incidents", label: "Open Incident Log", href: "/hse" }],
      },
      user: baseUser,
    })

    expect(result.status).toEqual({
      label: "Allotment Blocked",
      severity: "danger",
      icon: "alert-triangle",
    })
    expect(result.metrics.find((m) => m.label === "Trips Scheduled")?.severity).toBe("danger")
    expect(result.blockers?.items.length).toBeGreaterThan(0)
    expect(result.actions[0].visibility).toEqual(["internal_ops"])
  })

  it("returns success incident status when no open incidents exist", () => {
    const result = buildAssistContract({
      toolId: "incidents_list",
      data: { incidents: [{ status: "CLOSED" }], total: 1 },
      formatted: {
        answer: "No open incidents.",
        source: "Incidents",
      },
      user: baseUser,
    })

    expect(result.status.severity).toBe("success")
    expect(result.status.icon).toBe("shield-check")
    expect(result.metrics.find((m) => m.label === "Open Incidents")?.severity).toBe("success")
  })

  it("flags controller saturation when queue exists and no bay is idle", () => {
    const result = buildAssistContract({
      toolId: "controller_state",
      data: {
        readyQueue: [{ id: "q1" }, { id: "q2" }],
        bays: [{ status: "BUSY" }, { status: "BUSY" }],
      },
      formatted: {
        answer: "2 trucks in queue.",
        source: "Controller State",
      },
      user: baseUser,
    })

    expect(result.status).toEqual({
      label: "Bay Saturation",
      severity: "danger",
      icon: "factory",
    })
    expect(result.metrics.find((m) => m.label === "Idle Bays")?.severity).toBe("danger")
  })
})
