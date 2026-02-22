import { describe, expect, it } from "vitest"
import { applyProactiveReasoning } from "@/lib/copilot/proactive-reasoning"

describe("proactive reasoning", () => {
  it("detects blocker chain for trucks-in-yard with zero trips", async () => {
    const res = await applyProactiveReasoning({
      toolId: "dashboard_stats",
      primaryData: { inTerminal: 3, todayTrips: 0 },
      fetchedAt: new Date("2026-02-21T10:00:00.000Z"),
      fetchInternalJson: async (endpoint) => {
        if (endpoint.includes("/api/incidents")) return { incidents: [{ id: "INC-402", status: "OPEN" }] }
        if (endpoint.includes("/api/reports/safety")) return { stopWorkOrders: { active: 0 }, checklists: {} }
        if (endpoint.includes("/api/ai/plan")) return { alerts: [] }
        return null
      },
    })

    expect(res).not.toBeNull()
    expect(res?.breakdown?.some((l) => l.includes("[STATUS]"))).toBe(true)
    expect(res?.breakdown?.some((l) => l.includes("Contradiction detected"))).toBe(true)
    expect(res?.actions?.some((a) => a.href === "/hse")).toBe(true)
  })

  it("raises long-wait bottleneck and unit-level insight", async () => {
    const res = await applyProactiveReasoning({
      toolId: "controller_state",
      primaryData: {
        readyQueue: [
          { truckNumber: "TRK-1001", readyForBayAt: "2026-02-21T08:30:00.000Z", riskFlags: ["EARTHING_PENDING"] },
          { truckNumber: "TRK-1002", readyForBayAt: "2026-02-21T09:20:00.000Z", riskFlags: [] },
        ],
      },
      rawQuery: "show 2 trucks status",
      fetchedAt: new Date("2026-02-21T10:00:00.000Z"),
      fetchInternalJson: async () => null,
    })

    expect(res).not.toBeNull()
    expect(res?.breakdown?.some((l) => l.includes("Bottleneck alert"))).toBe(true)
    expect(res?.breakdown?.some((l) => l.includes("Unit-level status requested"))).toBe(true)
    expect(res?.actions?.some((a) => a.href === "/controller/console")).toBe(true)
  })
})
