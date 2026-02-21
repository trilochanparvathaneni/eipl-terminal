import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ConversationSidebar } from "@/components/comms/conversation-sidebar"

describe("communications sidebar empty state", () => {
  it("shows a visible Start one button when no conversations exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/comms/conversations/unread-counts")) {
          return Promise.resolve(
            new Response(JSON.stringify({ unreadCounts: {} }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ conversations: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      })
    )

    render(<ConversationSidebar activeId={null} onSelect={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start one/i })).toBeTruthy()
    })
  })
})
