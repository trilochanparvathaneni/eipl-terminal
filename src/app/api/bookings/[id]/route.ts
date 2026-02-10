import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { updateBookingSchema } from '@/lib/validations'
import { canTransition, isModifiable, isCancellable } from '@/lib/booking-state'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, BookingStatus } from '@prisma/client'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth()
  if (error) return error

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      product: true,
      transporter: true,
      timeSlot: true,
      terminal: true,
      createdBy: { select: { name: true, email: true } },
      bayAllocations: { include: { bay: { include: { gantry: true } }, allocatedBy: { select: { name: true } } } },
      truckTrips: { include: { gateEvents: { include: { security: { select: { name: true } } } } } },
      safetyChecklists: { include: { createdBy: { select: { name: true } } } },
      stopWorkOrders: { include: { issuedBy: { select: { name: true } } } },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Role-based access check
  if (user!.role === Role.CLIENT && booking.clientId !== user!.clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (user!.role === Role.TRANSPORTER && booking.transporterId !== user!.transporterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(booking)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth(
    Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN
  )
  if (error) return error

  const booking = await prisma.booking.findUnique({ where: { id: params.id } })
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  // Status transition
  if (data.status) {
    const newStatus = data.status as BookingStatus
    if (!canTransition(booking.status, newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${booking.status} to ${newStatus}` },
        { status: 400 }
      )
    }
  }

  // Client can only modify if in modifiable states
  if (user!.role === Role.CLIENT) {
    if (booking.clientId !== user!.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (data.status !== BookingStatus.CANCELLED && !isModifiable(booking.status)) {
      return NextResponse.json({ error: 'Booking cannot be modified in current status' }, { status: 400 })
    }
  }

  // Build update data
  const updateData: any = {}
  if (data.quantityRequested !== undefined) updateData.quantityRequested = data.quantityRequested
  if (data.timeSlotId !== undefined) updateData.timeSlotId = data.timeSlotId
  if (data.transporterId !== undefined) updateData.transporterId = data.transporterId
  if (data.additionalRequests !== undefined) updateData.additionalRequests = data.additionalRequests
  if (data.status) updateData.status = data.status

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: updateData,
    include: { client: true, product: true, transporter: true, timeSlot: true },
  })

  await createAuditLog({
    actorUserId: user!.id,
    entityType: 'Booking',
    entityId: booking.id,
    action: data.status === BookingStatus.CANCELLED ? 'CANCEL' : 'UPDATE',
    before: booking,
    after: updated,
  })

  // Notifications
  const subject = data.status === BookingStatus.CANCELLED
    ? `Booking ${booking.bookingNo} Cancelled`
    : `Booking ${booking.bookingNo} Updated`
  const bodyText = data.status === BookingStatus.CANCELLED
    ? `Booking has been cancelled.`
    : `Booking has been updated. New status: ${updated.status}`

  await notifyByRole({
    roles: ['TERMINAL_ADMIN', 'SURVEYOR'],
    terminalId: booking.terminalId,
    subject,
    body: bodyText,
  })

  return NextResponse.json(updated)
}
