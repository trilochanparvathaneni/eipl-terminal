import { BookingStatus } from '@prisma/client'

// State machine: valid transitions
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: [BookingStatus.SUBMITTED, BookingStatus.CANCELLED],
  SUBMITTED: [BookingStatus.CLIENT_APPROVED, BookingStatus.REJECTED, BookingStatus.CANCELLED],
  CLIENT_APPROVED: [BookingStatus.OPS_SCHEDULED, BookingStatus.CANCELLED],
  OPS_SCHEDULED: [BookingStatus.TRUCK_DETAILS_PENDING, BookingStatus.CANCELLED, BookingStatus.STOP_WORK],
  TRUCK_DETAILS_PENDING: [BookingStatus.QR_ISSUED, BookingStatus.CANCELLED, BookingStatus.STOP_WORK],
  QR_ISSUED: [BookingStatus.ARRIVED_GATE, BookingStatus.CANCELLED, BookingStatus.STOP_WORK],
  ARRIVED_GATE: [BookingStatus.IN_TERMINAL, BookingStatus.STOP_WORK],
  IN_TERMINAL: [BookingStatus.LOADED, BookingStatus.STOP_WORK],
  LOADED: [BookingStatus.EXITED, BookingStatus.STOP_WORK],
  EXITED: [BookingStatus.CLOSED],
  CLOSED: [],
  REJECTED: [],
  CANCELLED: [],
  STOP_WORK: [BookingStatus.OPS_SCHEDULED, BookingStatus.CANCELLED],
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function getNextStatuses(current: BookingStatus): BookingStatus[] {
  return TRANSITIONS[current] || []
}

export function isModifiable(status: BookingStatus): boolean {
  return [BookingStatus.SUBMITTED, BookingStatus.CLIENT_APPROVED].includes(status)
}

export function isCancellable(status: BookingStatus): boolean {
  return [
    BookingStatus.DRAFT,
    BookingStatus.SUBMITTED,
    BookingStatus.CLIENT_APPROVED,
    BookingStatus.OPS_SCHEDULED,
    BookingStatus.TRUCK_DETAILS_PENDING,
    BookingStatus.QR_ISSUED,
  ].includes(status)
}

export function generateBookingNo(): string {
  const date = new Date()
  const prefix = 'BK'
  const y = date.getFullYear().toString().slice(-2)
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${prefix}${y}${m}${d}${rand}`
}
