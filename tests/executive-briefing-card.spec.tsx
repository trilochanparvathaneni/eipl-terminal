import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExecutiveBriefingCard } from "@/components/intelligence/ExecutiveBriefingCard"

describe("ExecutiveBriefingCard", () => {
  it("renders AI risk analysis headline and action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "CRITICAL",
            headline: "Gantry stalled due to open incident.",
            key_metrics: ["Queue rising at yard", "Compliance blocks observed"],
            primary_action: { label: "Resolve Bay Incident", action_url: "/hse/incidents/cmlowm7hq08t2cj3txgsgr75u" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    )

    render(<ExecutiveBriefingCard />)

    await waitFor(() => {
      expect(screen.getByText(/Gantry stalled due to open incident/i)).toBeTruthy()
    })
    expect(screen.getByRole("button", { name: /Resolve Bay Incident/i })).toBeTruthy()
  })
})
