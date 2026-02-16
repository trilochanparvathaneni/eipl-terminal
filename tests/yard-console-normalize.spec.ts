import { describe, expect, it } from "vitest"
import { normalizeArmsPayload, normalizeTripsPayload } from "@/lib/yard-console"

describe("yard console payload normalization", () => {
  it("normalizes arms from direct array", () => {
    const input = [{ id: "a1" }]
    expect(normalizeArmsPayload<{ id: string }>(input)).toEqual(input)
  })

  it("normalizes arms from loadingArms alias", () => {
    const input = { loadingArms: [{ id: "a2" }] }
    expect(normalizeArmsPayload<{ id: string }>(input)).toEqual(input.loadingArms)
  })

  it("normalizes arms from arms key", () => {
    const input = { arms: [{ id: "a3" }] }
    expect(normalizeArmsPayload<{ id: string }>(input)).toEqual(input.arms)
  })

  it("returns empty arms for invalid payload", () => {
    expect(normalizeArmsPayload<{ id: string }>({ foo: "bar" })).toEqual([])
    expect(normalizeArmsPayload<{ id: string }>(null)).toEqual([])
  })

  it("normalizes trips from trips key", () => {
    const input = { trips: [{ id: "t1" }] }
    expect(normalizeTripsPayload<{ id: string }>(input)).toEqual(input.trips)
  })

  it("normalizes trips from truckTrips key", () => {
    const input = { truckTrips: [{ id: "t2" }] }
    expect(normalizeTripsPayload<{ id: string }>(input)).toEqual(input.truckTrips)
  })
})
