import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, BookingStatus } from '@prisma/client'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth(Role.HSE_OFFICER, Role.SUPER_ADMIN)
  if (error) return error

  const { id } = params

  try {
    // Find the stop work order
    const stopWorkOrder = await prisma.stopWorkOrder.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            client: true,
            product: true,
            terminal: true,
          },
        },
      },
    })

    if (!stopWorkOrder) {
      return NextResponse.json(
        { error: 'Stop work order not found' },
        { status: 404 }
      )
    }

    if (!stopWorkOrder.active) {
      return NextResponse.json(
        { error: 'Stop work order is already resolved' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Resolve the stop work order and restore booking status in a transaction
    const [resolved] = await prisma.$transaction([
      prisma.stopWorkOrder.update({
        where: { id },
        data: {
          active: false,
          resolvedAt: now,
        },
        include: {
          booking: {
            include: {
              client: true,
              product: true,
              terminal: true,
            },
          },
          issuedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.booking.update({
        where: { id: stopWorkOrder.bookingId },
        data: { status: BookingStatus.OPS_SCHEDULED },
      }),
    ])

    await createAuditLog({
      actorUserId: user!.id,
      entityType: 'StopWorkOrder',
      entityId: id,
      action: 'RESOLVE',
      before: { active: true, bookingStatus: BookingStatus.STOP_WORK },
      after: { active: false, resolvedAt: now, bookingStatus: BookingStatus.OPS_SCHEDULED },
    })

    const booking = stopWorkOrder.booking

    // Notify TERMINAL_ADMIN, SECURITY, and CLIENT users
    await notifyByRole({
      roles: ['TERMINAL_ADMIN', 'SECURITY'],
      terminalId: booking.terminalId,
      subject: `Stop Work Order Resolved - Booking ${booking.bookingNo}`,
      body: `The stop work order for booking ${booking.bookingNo} has been resolved. Booking status restored to OPS_SCHEDULED.`,
    })

    // Notify client users
    const clientUsers = await prisma.user.findMany({
      where: { clientId: booking.clientId, role: Role.CLIENT, isActive: true },
      select: { id: true },
    })

    for (const clientUser of clientUsers) {
      await sendNotification({
        userId: clientUser.id,
        subject: `Stop Work Order Resolved - Booking ${booking.bookingNo}`,
        body: `The stop work order for your booking ${booking.bookingNo} has been resolved. Operations may resume.`,
      })
    }

    return NextResponse.json(resolved)
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to resolve stop work order' },
      { status: 500 }
    )
  }
}
