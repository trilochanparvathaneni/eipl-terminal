import { describe, expect, it } from "vitest"
import { guardAssistAction } from "@/lib/assist/action-route-guard"

describe("assist action route guard", () => {
  it("maps legacy eipl-portal incident report url to internal incident form route", () => {
    const action = guardAssistAction({
      label: "Report a New Incident",
      url: "https://eipl-portal/incidents/report",
    })

    expect(action.href).toBe("/hse/incidents/new")
    expect(action.replaced).toBe(false)
  })

  it("maps known safety and control-room actions to stable internal pages", () => {
    const gas = guardAssistAction({
      label: "Gas Leak Safety Protocol",
      url: "https://anything.invalid/gas-leak-sop",
    })
    const control = guardAssistAction({
      label: "Contact HSE Control Room",
      url: "https://unknown.invalid/helpdesk",
    })
    const methanol = guardAssistAction({
      label: "Check Methanol Inventory",
      url: "/inventory/methanol",
    })

    expect(gas.href).toBe("/hse/protocols/gas-leak")
    expect(control.href).toBe("/contacts/control-room")
    expect(methanol.href).toBe("/inventory/methanol")
  })

  it("redirects unknown route targets to dashboard fallback", () => {
    const unknown = guardAssistAction({
      label: "Open Mystery Tool",
      url: "/non-existent/path",
    })

    expect(unknown.href).toBe("/dashboard")
    expect(unknown.label).toBe("Open Dashboard")
    expect(unknown.replaced).toBe(true)
  })
})
