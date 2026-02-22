import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EIPLBotMessage from "@/components/layout/EIPLBotMessage"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe("EIPLBotMessage action navigation smoke", () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  it("routes 'Report a New Incident' action to internal incident form page", () => {
    render(
      <EIPLBotMessage
        payload={{
          reply_text: "Please report this event immediately.",
          action_buttons: [
            {
              label: "Report a New Incident",
              url: "https://eipl-portal/incidents/report",
            },
          ],
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /report a new incident/i }))
    expect(pushMock).toHaveBeenCalledWith("/hse/incidents/new")
  })

  it("routes schedule and control-room actions to working internal pages", () => {
    render(
      <EIPLBotMessage
        payload={{
          reply_text: "Use these actions",
          action_buttons: [
            { label: "View Schedule", url: "/schedule" },
            { label: "Contact HSE Control Room", url: "/contacts/control-room" },
          ],
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /view schedule/i }))
    fireEvent.click(screen.getByRole("button", { name: /contact hse control room/i }))

    expect(pushMock).toHaveBeenNthCalledWith(1, "/schedule")
    expect(pushMock).toHaveBeenNthCalledWith(2, "/contacts/control-room")
  })
})
