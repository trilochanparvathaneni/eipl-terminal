import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { stopWorkOrderSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, BookingStatus } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    Role.HSE_OFFICER,
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.SECURITY,
    Role.AUDITOR,
    Role.SURVEYOR
  )
  if (error) return error

  const url = new URL(req.url)
  const bookingId = url.searchParams.get('bookingId')
  const active = url.searchParams.get('active')
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  const where: any = {}
  if (user!.role !== Role.SUPER_ADMIN) {
    const terminalAccessError = enforceTerminalAccess(user!, user!.terminalId)
    if (terminalAccessError) return terminalAccessError
    where.booking = { terminalId: user!.terminalId }
  }

  if (bookingId) where.bookingId = bookingId
  if (active !== null && active !== undefined) {
    where.active = active === 'true'
  }

  try {
    const [orders, total] = await Promise.all([
      prisma.stopWorkOrder.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stopWorkOrder.count({ where }),
    ])

    return NextResponse.json({ orders, total, page, limit })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch stop work orders' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(Role.HSE_OFFICER, Role.SUPER_ADMIN)
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = stopWorkOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  try {
    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { client: true, product: true, terminal: true },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const terminalAccessError = enforceTerminalAccess(user!, booking.terminalId)
    if (terminalAccessError) return terminalAccessError

    const previousStatus = booking.status

    // Create stop work order and update booking status in a transaction
    const [stopWorkOrder] = await prisma.$transaction([
      prisma.stopWorkOrder.create({
        data: {
          bookingId: data.bookingId,
          issuedByHseId: user!.id,
          reason: data.reason,
          active: true,
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
        where: { id: data.bookingId },
        data: { status: BookingStatus.STOP_WORK },
      }),
    ])

    await createAuditLog({
      actorUserId: user!.id,
      entityType: 'StopWorkOrder',
      entityId: stopWorkOrder.id,
      action: 'CREATE',
      before: { bookingStatus: previousStatus },
      after: { ...stopWorkOrder, bookingStatus: BookingStatus.STOP_WORK },
    })

    // Notify TERMINAL_ADMIN, SECURITY, and CLIENT users
    await notifyByRole({
      roles: ['TERMINAL_ADMIN', 'SECURITY'],
      terminalId: booking.terminalId,
      subject: `STOP WORK ORDER - Booking ${booking.bookingNo}`,
      body: `A stop work order has been issued for booking ${booking.bookingNo}. Reason: ${data.reason}`,
    })

    // Notify client users associated with this booking's client
    const clientUsers = await prisma.user.findMany({
      where: { clientId: booking.clientId, role: Role.CLIENT, isActive: true },
      select: { id: true },
    })

    for (const clientUser of clientUsers) {
      await sendNotification({
        userId: clientUser.id,
        subject: `STOP WORK ORDER - Booking ${booking.bookingNo}`,
        body: `A stop work order has been issued for your booking ${booking.bookingNo}. Reason: ${data.reason}`,
      })
    }

    return NextResponse.json(stopWorkOrder, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create stop work order' },
      { status: 500 }
    )
  }
}
