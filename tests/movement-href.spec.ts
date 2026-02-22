import { describe, expect, it } from "vitest"
import { buildMovementRowHref } from "@/lib/routes/movements"

describe("buildMovementRowHref", () => {
  it("uses booking route when booking id exists", () => {
    expect(buildMovementRowHref("TERMINAL_ADMIN", { bookingId: "bk_123", truckId: "tt_1" })).toBe("/bookings/bk_123")
  })

  it("uses transporter trip route for transporter role", () => {
    expect(buildMovementRowHref("TRANSPORTER", { truckId: "tt_42" })).toBe("/transporter/trips/tt_42/qr")
  })

  it("falls back to dashboard when identifiers are missing", () => {
    expect(buildMovementRowHref("CLIENT", {})).toBe("/dashboard")
  })
})
