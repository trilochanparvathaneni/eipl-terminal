import { describe, expect, it } from "vitest"
import { buildBayAvailabilityResponse } from "@/lib/assist/ops-response"
import type { OpsSnapshot } from "@/lib/assist/snapshot"

const snapshot: OpsSnapshot = {
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
    blockedComplianceCount: 2,
    terminalHalt: false,
  },
  dataGaps: [],
}

describe("ops response role redaction", () => {
  it("hides internal metrics and incidents for client role", () => {
    const response = buildBayAvailabilityResponse({
      snapshot,
      role: "CLIENT",
      message: "Do we have bays available?",
    })

    expect(response.metrics.some((metric) => metric.key.includes("bay"))).toBe(false)
    expect(response.metrics.some((metric) => metric.key.includes("incident"))).toBe(false)
    expect(response.blockers.length).toBe(0)
    expect(response.replyText.toLowerCase()).toContain("terminal")
  })

  it("keeps internal metrics for ops role", () => {
    const response = buildBayAvailabilityResponse({
      snapshot,
      role: "OPS",
      message: "Do we have bays available?",
    })

    expect(response.metrics.some((metric) => metric.key.includes("active_bays"))).toBe(true)
    expect(response.metrics.some((metric) => metric.key.includes("open_incidents"))).toBe(true)
    expect(response.blockers.length).toBeGreaterThan(0)
  })
})
