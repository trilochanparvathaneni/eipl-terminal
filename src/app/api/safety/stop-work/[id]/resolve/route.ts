import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, BookingStatus } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

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
    const terminalAccessError = enforceTerminalAccess(user!, stopWorkOrder.booking.terminalId)
    if (terminalAccessError) return terminalAccessError

    const now = new Date()

    // Check if this is the last active stop work order for this booking
    const remainingActiveOrders = await prisma.stopWorkOrder.count({
      where: {
        bookingId: stopWorkOrder.bookingId,
        active: true,
        id: { not: id }, // exclude the one we're about to resolve
      },
    })
    const isLastActiveOrder = remainingActiveOrders === 0

    // Resolve the stop work order; only restore booking status if no other active orders remain
    const ops: Parameters<typeof prisma.$transaction>[0] = [
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
    ]

    if (isLastActiveOrder) {
      ops.push(
        prisma.booking.update({
          where: { id: stopWorkOrder.bookingId },
          data: { status: BookingStatus.OPS_SCHEDULED },
        })
      )
    }

    const [resolved] = await prisma.$transaction(ops)

    await createAuditLog({
      actorUserId: user!.id,
      terminalId: stopWorkOrder.booking.terminalId,
      entityType: 'StopWorkOrder',
      entityId: id,
      action: 'RESOLVE',
      before: { active: true, bookingStatus: BookingStatus.STOP_WORK },
      after: {
        active: false,
        resolvedAt: now,
        bookingStatus: isLastActiveOrder ? BookingStatus.OPS_SCHEDULED : BookingStatus.STOP_WORK,
        remainingActiveOrders,
      },
    })

    const booking = stopWorkOrder.booking

    const notifyBody = isLastActiveOrder
      ? `The stop work order for booking ${booking.bookingNo} has been resolved. Booking status restored to OPS_SCHEDULED.`
      : `A stop work order for booking ${booking.bookingNo} has been resolved, but ${remainingActiveOrders} active order(s) remain. Operations are still halted.`

    // Notify TERMINAL_ADMIN, SECURITY, and CLIENT users
    await notifyByRole({
      roles: ['TERMINAL_ADMIN', 'SECURITY'],
      terminalId: booking.terminalId,
      subject: `Stop Work Order Resolved - Booking ${booking.bookingNo}`,
      body: notifyBody,
    })

    // Notify client users
    const clientUsers = await prisma.user.findMany({
      where: { clientId: booking.clientId, role: Role.CLIENT, isActive: true },
      select: { id: true },
    })

    const clientNotifyBody = isLastActiveOrder
      ? `The stop work order for your booking ${booking.bookingNo} has been resolved. Operations may resume.`
      : `A stop work order for your booking ${booking.bookingNo} has been resolved, but ${remainingActiveOrders} order(s) remain active. Operations are still halted.`

    for (const clientUser of clientUsers) {
      await sendNotification({
        userId: clientUser.id,
        subject: `Stop Work Order Resolved - Booking ${booking.bookingNo}`,
        body: clientNotifyBody,
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
