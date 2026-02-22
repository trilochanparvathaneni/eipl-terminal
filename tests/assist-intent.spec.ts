import { describe, expect, it } from "vitest"
import { detectAssistIntent } from "@/lib/assist/intent"

describe("assist intent detection", () => {
  it("detects bay availability intent from natural phrasing", () => {
    const intent = detectAssistIntent("do we have the bays available?")
    expect(intent).toBe("bay_availability")
  })
})
