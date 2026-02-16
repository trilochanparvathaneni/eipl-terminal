import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role, BookingStatus } from '@prisma/client'
import { bookingScopeForUser } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.SURVEYOR,
    Role.AUDITOR,
    Role.HSE_OFFICER
  )
  if (error) return error

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const status = url.searchParams.get('status')
    const clientId = url.searchParams.get('clientId')
    const productId = url.searchParams.get('productId')
    const bookingNo = url.searchParams.get('bookingNo')

    const scoped = bookingScopeForUser(user!)
    if (scoped.error) return scoped.error
    const where: any = { ...scoped.where }

    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (productId) where.productId = productId
    if (bookingNo) where.bookingNo = { contains: bookingNo, mode: 'insensitive' }
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    const [bookings, total, statusDistribution] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, category: true } },
          transporter: { select: { id: true, name: true } },
          timeSlot: true,
          createdBy: { select: { name: true } },
          _count: { select: { truckTrips: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
      prisma.booking.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    for (const item of statusDistribution) {
      statusCounts[item.status] = item._count.status
    }

    return NextResponse.json({
      bookings,
      total,
      page,
      limit,
      statusDistribution: statusCounts,
    })
  } catch (err) {
    console.error('Failed to fetch bookings report:', err)
    return NextResponse.json(
      { error: 'Failed to fetch bookings report' },
      { status: 500 }
    )
  }
}
