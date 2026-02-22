import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MovementsBoard } from "@/components/live/MovementsBoard"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

const rows = [
  {
    id: "tt1",
    updatedAt: new Date().toISOString(),
    vehicleNo: "AP39AB1234",
    clientName: "Acme Logistics",
    product: "LPG",
    stage: "Loading",
    statusFlag: "blocked" as const,
    note: "HSE hold",
    bookingId: "bk1",
    truckId: "tt1",
  },
]

describe("MovementsBoard role behavior", () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  it("shows internal columns for internal roles", () => {
    render(<MovementsBoard role={"TERMINAL_ADMIN" as any} rows={rows} alerts={rows} updatedAtLabel="10:00:00" />)
    expect(screen.getByText("Client")).toBeTruthy()
    expect(screen.getByText("Note")).toBeTruthy()
    expect(screen.getByText("HSE hold")).toBeTruthy()
  })

  it("hides internal columns for client role", () => {
    render(<MovementsBoard role={"CLIENT" as any} rows={rows} alerts={rows} updatedAtLabel="10:00:00" />)
    expect(screen.queryByText("Client")).toBeNull()
    expect(screen.queryByText("Note")).toBeNull()
    expect(screen.getByText("ETA / Note")).toBeTruthy()
  })

  it("row click navigates to a working route", () => {
    render(<MovementsBoard role={"TERMINAL_ADMIN" as any} rows={rows} alerts={rows} updatedAtLabel="10:00:00" />)
    fireEvent.click(screen.getByText("AP39AB1234"))
    expect(pushMock).toHaveBeenCalledWith("/bookings/bk1")
  })
})
