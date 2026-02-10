import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { gateCheckOutSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, BookingStatus, TruckTripStatus, GateEventType } from '@prisma/client'

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(Role.SECURITY)
  if (error) return error

  const body = await req.json()
  const parsed = gateCheckOutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  const trip = await prisma.truckTrip.findUnique({
    where: { id: data.truckTripId },
    include: {
      booking: { include: { client: true } },
    },
  })

  if (!trip) {
    return NextResponse.json({ error: 'Truck trip not found' }, { status: 404 })
  }

  // Verify trip is in terminal or loaded
  if (trip.status !== TruckTripStatus.IN_TERMINAL && trip.status !== TruckTripStatus.LOADED) {
    return NextResponse.json(
      { error: `Check-out not allowed in trip status: ${trip.status}` },
      { status: 400 }
    )
  }

  // Create gate event
  const gateEvent = await prisma.gateEvent.create({
    data: {
      truckTripId: trip.id,
      type: GateEventType.CHECK_OUT,
      securityUserId: user!.id,
      weighmentGross: data.weighmentGross,
      netQuantity: data.netQuantity,
      photoTruckUrl: data.photoTruckUrl,
      photoDriverUrl: data.photoDriverUrl,
      payloadJson: { checkedOutAt: new Date().toISOString() },
    },
  })

  // Update trip status
  await prisma.truckTrip.update({
    where: { id: trip.id },
    data: { status: TruckTripStatus.COMPLETED },
  })

  // Update booking status to EXITED then CLOSED
  // Check if all trips for this booking are completed
  const pendingTrips = await prisma.truckTrip.count({
    where: {
      bookingId: trip.bookingId,
      status: { notIn: [TruckTripStatus.COMPLETED, TruckTripStatus.EXITED] },
    },
  })

  if (pendingTrips === 0) {
    await prisma.booking.update({
      where: { id: trip.bookingId },
      data: { status: BookingStatus.CLOSED },
    })
  } else {
    await prisma.booking.update({
      where: { id: trip.bookingId },
      data: { status: BookingStatus.EXITED },
    })
  }

  // Deduct inventory
  if (data.netQuantity) {
    await prisma.inventoryLot.updateMany({
      where: {
        clientId: trip.booking.clientId,
        productId: trip.booking.productId,
      },
      data: {
        quantityAvailable: { decrement: data.netQuantity },
      },
    })
  }

  await createAuditLog({
    actorUserId: user!.id,
    entityType: 'GateEvent',
    entityId: gateEvent.id,
    action: 'CHECK_OUT',
    after: gateEvent,
  })

  await notifyByRole({
    roles: ['TERMINAL_ADMIN', 'SURVEYOR'],
    terminalId: trip.booking.terminalId,
    subject: `Truck Exited - ${trip.truckNumber}`,
    body: `Truck ${trip.truckNumber} checked out. Net quantity: ${data.netQuantity || 'N/A'}`,
  })

  // Notify client
  const clientUsers = await prisma.user.findMany({
    where: { clientId: trip.booking.clientId, role: Role.CLIENT },
    select: { id: true },
  })
  for (const cu of clientUsers) {
    await sendNotification({
      userId: cu.id,
      subject: `Truck Exited - ${trip.booking.bookingNo}`,
      body: `Truck ${trip.truckNumber} has exited the terminal.`,
    })
  }

  return NextResponse.json({ gateEvent, message: 'Check-out successful' })
}
