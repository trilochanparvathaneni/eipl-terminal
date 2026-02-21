import { describe, expect, it } from "vitest"
import { formatRelativeTime } from "@/lib/time/relative"

describe("formatRelativeTime", () => {
  const now = new Date("2026-02-21T12:00:00.000Z")

  it("formats minutes and hours", () => {
    expect(formatRelativeTime("2026-02-21T11:45:00.000Z", now)).toBe("15m ago")
    expect(formatRelativeTime("2026-02-21T07:00:00.000Z", now)).toBe("5h ago")
  })

  it("formats days instead of very large hours", () => {
    expect(formatRelativeTime("2026-02-16T12:00:00.000Z", now)).toBe("5d ago")
  })
})
