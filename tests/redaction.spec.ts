import { describe, expect, it } from "vitest"
import { redactAssistantResponse, redactBriefingForClient, sanitizeForClient } from "@/lib/security/redaction"

describe("security redaction", () => {
  it("builds client-safe executive briefing payload", () => {
    const payload = redactBriefingForClient({
      myTrucksToday: 5,
      inProgress: 2,
      completed: 3,
      terminalState: "LIMITED",
      etaRange: "40-90 mins",
    })

    const joined = `${payload.headline} ${payload.key_metrics.join(" ")} ${payload.primary_action.label}`.toLowerCase()
    expect(joined.includes("incident")).toBe(false)
    expect(joined.includes("inventory")).toBe(false)
    expect(joined.includes("gantry")).toBe(false)
    expect(payload.primary_action.action_url).toBe("/bookings")
  })

  it("sanitizes assistant text and client actions", () => {
    const redacted = redactAssistantResponse("CLIENT", {
      reply_text: "Validate HSE checklist and escalate blocked truck movement at gantry.",
      urgency: "high",
      action_buttons: [
        { label: "Resolve Bay Incident", url: "/hse/incidents/cmlowm7hq08t2cj3txgsgr75u" },
        { label: "View my bookings", url: "/bookings" },
      ],
    })

    expect(sanitizeForClient(redacted.reply_text).toLowerCase().includes("hse")).toBe(false)
    expect(redacted.action_buttons.every((button) => !button.url.startsWith("/hse"))).toBe(true)
    expect(redacted.action_buttons.some((button) => button.url === "/bookings")).toBe(true)
  })
})
