import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { createTruckTripSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, BookingStatus, TruckTripStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const url = new URL(req.url)
  const bookingId = url.searchParams.get('bookingId')
  const date = url.searchParams.get('date')

  const where: any = {}

  if (user!.role === Role.TRANSPORTER && user!.transporterId) {
    where.booking = { transporterId: user!.transporterId }
  }

  if (bookingId) where.bookingId = bookingId

  if (date) {
    where.booking = {
      ...where.booking,
      date: new Date(date),
    }
  }

  const trips = await prisma.truckTrip.findMany({
    where,
    include: {
      booking: {
        include: {
          client: true,
          product: true,
          terminal: true,
          timeSlot: true,
          bayAllocations: { include: { bay: { include: { gantry: true } } } },
        },
      },
      gateEvents: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(trips)
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(Role.TRANSPORTER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN)
  if (error) return error

  const body = await req.json()
  const parsed = createTruckTripSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: { product: true },
  })

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Transporter can only add trips to their own bookings
  if (user!.role === Role.TRANSPORTER && booking.transporterId !== user!.transporterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Booking must be in appropriate status
  const allowedStatuses: string[] = [
    BookingStatus.OPS_SCHEDULED,
    BookingStatus.TRUCK_DETAILS_PENDING,
    BookingStatus.QR_ISSUED,
  ]
  if (!allowedStatuses.includes(booking.status)) {
    return NextResponse.json(
      { error: `Cannot add truck trips in status ${booking.status}` },
      { status: 400 }
    )
  }

  // Generate QR token
  const qrToken = randomUUID()

  const trip = await prisma.truckTrip.create({
    data: {
      bookingId: data.bookingId,
      truckNumber: data.truckNumber.toUpperCase(),
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      qrToken,
      status: TruckTripStatus.QR_ISSUED,
    },
    include: {
      booking: { include: { client: true, product: true, terminal: true } },
    },
  })

  // Update booking status to QR_ISSUED if not already
  if (booking.status === BookingStatus.OPS_SCHEDULED || booking.status === BookingStatus.TRUCK_DETAILS_PENDING) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.QR_ISSUED },
    })
  }

  await createAuditLog({
    actorUserId: user!.id,
    entityType: 'TruckTrip',
    entityId: trip.id,
    action: 'CREATE',
    after: trip,
  })

  // Notify Security + Terminal Admin + Client
  await notifyByRole({
    roles: ['SECURITY', 'TERMINAL_ADMIN'],
    terminalId: booking.terminalId,
    subject: `QR Issued - ${booking.bookingNo}`,
    body: `Truck ${data.truckNumber} / Driver ${data.driverName} - QR token issued.`,
  })

  const clientUsers = await prisma.user.findMany({
    where: { clientId: booking.clientId, role: Role.CLIENT },
    select: { id: true },
  })
  for (const cu of clientUsers) {
    await sendNotification({
      userId: cu.id,
      subject: `Truck Details Added - ${booking.bookingNo}`,
      body: `Truck ${data.truckNumber} has been assigned to your booking.`,
    })
  }

  return NextResponse.json(trip, { status: 201 })
}
