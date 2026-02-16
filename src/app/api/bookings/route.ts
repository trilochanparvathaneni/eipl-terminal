import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { createBookingSchema } from '@/lib/validations'
import { generateBookingNo } from '@/lib/booking-state'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, BookingStatus } from '@prisma/client'
import { bookingScopeForUser, enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')
  const clientId = url.searchParams.get('clientId')
  const productId = url.searchParams.get('productId')
  const search = url.searchParams.get('search')
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  const scoped = bookingScopeForUser(user!)
  if (scoped.error) return scoped.error
  const where: any = { ...scoped.where }

  if (status) where.status = status
  if (clientId) {
    if (user!.role === Role.CLIENT) {
      if (clientId !== user!.clientId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      where.clientId = user!.clientId
    } else {
      where.clientId = clientId
    }
  }
  if (productId) where.productId = productId
  if (search) where.bookingNo = { contains: search, mode: 'insensitive' }
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = new Date(dateFrom)
    if (dateTo) where.date.lte = new Date(dateTo)
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        client: true,
        product: true,
        transporter: true,
        timeSlot: true,
        createdBy: { select: { name: true } },
        bayAllocations: { include: { bay: true } },
        _count: { select: { truckTrips: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ])

  return NextResponse.json({ bookings, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN)
  if (error) return error

  const body = await req.json()
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const terminalAccessError = enforceTerminalAccess(user!, data.terminalId)
  if (terminalAccessError && user!.role !== Role.CLIENT) return terminalAccessError

  // For CLIENT role, force clientId
  let clientId = data.terminalId // placeholder
  if (user!.role === Role.CLIENT) {
    if (!user!.clientId) {
      return NextResponse.json({ error: 'Client association missing' }, { status: 400 })
    }
    clientId = user!.clientId
  } else {
    // Admin creating on behalf - need clientId from body
    clientId = (body as any).clientId
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }
  }

  // Check inventory
  const inventory = await prisma.inventoryLot.findFirst({
    where: { clientId, productId: data.productId },
  })

  if (!inventory || inventory.quantityAvailable < data.quantityRequested) {
    return NextResponse.json({ error: 'Insufficient inventory' }, { status: 400 })
  }

  // Check slot capacity if slot selected
  if (data.timeSlotId) {
    const slot = await prisma.timeSlot.findUnique({
      where: { id: data.timeSlotId },
      include: { _count: { select: { bookings: true } } },
    })
    if (!slot) {
      return NextResponse.json({ error: 'Invalid time slot' }, { status: 400 })
    }
    if (slot._count.bookings >= slot.capacityTrucks) {
      return NextResponse.json({ error: 'Time slot is full' }, { status: 400 })
    }
  }

  const booking = await prisma.booking.create({
    data: {
      bookingNo: generateBookingNo(),
      terminalId: data.terminalId,
      clientId,
      productId: data.productId,
      quantityRequested: data.quantityRequested,
      date: new Date(data.date),
      timeSlotId: data.timeSlotId || null,
      transporterId: data.transporterId || null,
      status: BookingStatus.SUBMITTED,
      isBulk: data.isBulk,
      additionalRequests: data.additionalRequests || null,
      createdByUserId: user!.id,
    },
    include: {
      client: true,
      product: true,
      transporter: true,
      timeSlot: true,
    },
  })

  await createAuditLog({
    actorUserId: user!.id,
    entityType: 'Booking',
    entityId: booking.id,
    action: 'CREATE',
    after: booking,
  })

  // Notify Terminal Admin + Surveyor + Client
  await notifyByRole({
    roles: ['TERMINAL_ADMIN', 'SURVEYOR'],
    terminalId: data.terminalId,
    subject: `New Booking ${booking.bookingNo}`,
    body: `Booking ${booking.bookingNo} submitted for ${booking.product.name} - ${data.quantityRequested} ${inventory.uom}`,
  })

  if (user!.role !== Role.CLIENT) {
    const clientUsers = await prisma.user.findMany({
      where: { clientId, role: Role.CLIENT },
      select: { id: true },
    })
    for (const cu of clientUsers) {
      await sendNotification({
        userId: cu.id,
        subject: `Booking ${booking.bookingNo} Created`,
        body: `Your booking has been submitted successfully.`,
      })
    }
  }

  return NextResponse.json(booking, { status: 201 })
}
