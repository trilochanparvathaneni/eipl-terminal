import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { gateCheckInSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole } from '@/lib/notifications'
import { Role, BookingStatus, TruckTripStatus, GateEventType } from '@prisma/client'

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(Role.SECURITY)
  if (error) return error

  const body = await req.json()
  const parsed = gateCheckInSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  // Find truck trip
  let trip
  if (data.qrToken) {
    trip = await prisma.truckTrip.findFirst({
      where: { qrToken: data.qrToken },
      include: {
        booking: {
          include: { timeSlot: true, stopWorkOrders: { where: { active: true } } },
        },
      },
    })
  } else {
    trip = await prisma.truckTrip.findUnique({
      where: { id: data.truckTripId },
      include: {
        booking: {
          include: { timeSlot: true, stopWorkOrders: { where: { active: true } } },
        },
      },
    })
  }

  if (!trip) {
    return NextResponse.json({ error: 'Truck trip not found' }, { status: 404 })
  }

  // Check for active stop work orders
  if (trip.booking.stopWorkOrders.length > 0) {
    return NextResponse.json(
      { error: 'Active Stop Work Order exists. Check-in blocked.' },
      { status: 400 }
    )
  }

  // Verify booking status allows check-in
  if (trip.booking.status !== BookingStatus.QR_ISSUED &&
      trip.booking.status !== BookingStatus.ARRIVED_GATE) {
    return NextResponse.json(
      { error: `Check-in not allowed in booking status: ${trip.booking.status}` },
      { status: 400 }
    )
  }

  // Verify trip not already checked in
  if (trip.status !== TruckTripStatus.QR_ISSUED) {
    return NextResponse.json(
      { error: `Trip already in status: ${trip.status}` },
      { status: 400 }
    )
  }

  // Create gate event
  const gateEvent = await prisma.gateEvent.create({
    data: {
      truckTripId: trip.id,
      type: GateEventType.CHECK_IN,
      securityUserId: user!.id,
      weighmentTare: data.weighmentTare,
      photoTruckUrl: data.photoTruckUrl,
      photoDriverUrl: data.photoDriverUrl,
      payloadJson: { checkedInAt: new Date().toISOString() },
    },
  })

  // Update trip status
  await prisma.truckTrip.update({
    where: { id: trip.id },
    data: { status: TruckTripStatus.IN_TERMINAL },
  })

  // Update booking status
  await prisma.booking.update({
    where: { id: trip.bookingId },
    data: { status: BookingStatus.IN_TERMINAL },
  })

  await createAuditLog({
    actorUserId: user!.id,
    entityType: 'GateEvent',
    entityId: gateEvent.id,
    action: 'CHECK_IN',
    after: gateEvent,
  })

  await notifyByRole({
    roles: ['TERMINAL_ADMIN'],
    terminalId: trip.booking.terminalId,
    subject: `Truck Arrived - ${trip.truckNumber}`,
    body: `Truck ${trip.truckNumber} checked in at gate for booking ${trip.booking.bookingNo}.`,
  })

  return NextResponse.json({ gateEvent, message: 'Check-in successful' })
}
