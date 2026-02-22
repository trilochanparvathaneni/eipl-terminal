import { Role } from "@prisma/client"

type MovementLinkInput = {
  bookingId?: string | null
  truckId?: string | null
}

function safeId(id?: string | null): string | null {
  if (!id || typeof id !== "string") return null
  const value = id.trim()
  if (!value) return null
  return value
}

export function buildMovementRowHref(role: Role | string, input: MovementLinkInput): string {
  const bookingId = safeId(input.bookingId)
  const truckId = safeId(input.truckId)

  if (role === Role.TRANSPORTER && truckId) {
    return `/transporter/trips/${encodeURIComponent(truckId)}/qr`
  }

  if (bookingId) {
    return `/bookings/${encodeURIComponent(bookingId)}`
  }

  return "/dashboard"
}
