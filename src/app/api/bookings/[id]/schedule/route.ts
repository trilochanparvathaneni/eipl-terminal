import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { canTransition } from '@/lib/booking-state'
import { Role, BookingStatus } from '@prisma/client'

// Terminal Admin schedules a booking: allocate slot + bay, move to OPS_SCHEDULED
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth(Role.TERMINAL_ADMIN, Role.SUPER_ADMIN)
  if (error) return error

  const body = await req.json()
  const { timeSlotId, bayId } = body

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { product: true },
  })
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Validate bay/product mapping
  if (bayId) {
    const mapping = await prisma.productBayMap.findFirst({
      where: { productId: booking.productId, bayId, isActive: true },
    })
    if (!mapping) {
      return NextResponse.json({ error: 'Bay is not mapped to this product' }, { status: 400 })
    }
  }

  // Determine target status
  const targetStatus = BookingStatus.OPS_SCHEDULED
  if (!canTransition(booking.status, targetStatus) &&
      booking.status !== BookingStatus.SUBMITTED) {
    // Allow scheduling from SUBMITTED or CLIENT_APPROVED
    if (booking.status !== BookingStatus.CLIENT_APPROVED) {
      return NextResponse.json(
        { error: `Cannot schedule from status ${booking.status}` },
        { status: 400 }
      )
    }
  }

  const updateData: any = { status: targetStatus }
  if (timeSlotId) updateData.timeSlotId = timeSlotId

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: updateData,
    include: { client: true, product: true, transporter: true, timeSlot: true },
  })

  // Create bay allocation if provided
  if (bayId) {
    await prisma.bookingBayAllocation.create({
      data: {
        bookingId: params.id,
        bayId,
        allocatedByUserId: user!.id,
      },
    })
  }

  await createAuditLog({
    actorUserId: user!.id,
    entityType: 'Booking',
    entityId: booking.id,
    action: 'SCHEDULE',
    before: booking,
    after: updated,
  })

  // Notify transporter + client
  if (booking.transporterId) {
    const transporterUsers = await prisma.user.findMany({
      where: { transporterId: booking.transporterId, role: Role.TRANSPORTER },
      select: { id: true },
    })
    for (const tu of transporterUsers) {
      await sendNotification({
        userId: tu.id,
        subject: `Booking ${booking.bookingNo} Scheduled`,
        body: `Booking has been scheduled. Please add truck details.`,
      })
    }
  }

  const clientUsers = await prisma.user.findMany({
    where: { clientId: booking.clientId, role: Role.CLIENT },
    select: { id: true },
  })
  for (const cu of clientUsers) {
    await sendNotification({
      userId: cu.id,
      subject: `Booking ${booking.bookingNo} Scheduled`,
      body: `Your booking has been scheduled by terminal operations.`,
    })
  }

  return NextResponse.json(updated)
}
