import { describe, expect, it } from "vitest"
import { buildIncidentHref } from "@/lib/routes/incident"

describe("buildIncidentHref", () => {
  it("builds an internal incident detail href for valid ids", () => {
    expect(buildIncidentHref("cmlowm7hq08t2cj3txgsgr75u")).toBe("/hse/incidents/cmlowm7hq08t2cj3txgsgr75u")
  })

  it("falls back to incident list for missing or invalid ids", () => {
    expect(buildIncidentHref("")).toBe("/hse/incidents")
    expect(buildIncidentHref(undefined)).toBe("/hse/incidents")
    expect(buildIncidentHref("bad")).toBe("/hse/incidents")
  })
})
