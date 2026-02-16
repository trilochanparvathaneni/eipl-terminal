import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role, GateEventType } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.SURVEYOR,
    Role.AUDITOR,
    Role.HSE_OFFICER,
    Role.SECURITY
  )
  if (error) return error

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const tripStatus = url.searchParams.get('tripStatus')
    const truckNumber = url.searchParams.get('truckNumber')
    const transporterId = url.searchParams.get('transporterId')
    const clientId = url.searchParams.get('clientId')
    const productId = url.searchParams.get('productId')
    const bookingNo = url.searchParams.get('bookingNo')

    const where: any = {}
    if (user!.role !== Role.SUPER_ADMIN) {
      const terminalAccessError = enforceTerminalAccess(user!, user!.terminalId)
      if (terminalAccessError) return terminalAccessError
      where.booking = { terminalId: user!.terminalId }
    }

    if (dateFrom || dateTo) {
      where.gateEvents = {
        some: {
          timestamp: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        },
      }
    }
    if (tripStatus) where.status = tripStatus
    if (truckNumber) where.truckNumber = { contains: truckNumber, mode: 'insensitive' }

    if (transporterId || clientId || productId || bookingNo) {
      where.booking = {
        ...(where.booking ?? {}),
        ...(transporterId ? { transporterId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(productId ? { productId } : {}),
        ...(bookingNo ? { bookingNo: { contains: bookingNo, mode: 'insensitive' } } : {}),
      }
    }

    const [truckTrips, total] = await Promise.all([
      prisma.truckTrip.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingNo: true,
              status: true,
              clientId: true,
              productId: true,
              client: { select: { id: true, name: true } },
              product: { select: { id: true, name: true } },
            },
          },
          gateEvents: {
            orderBy: { timestamp: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.truckTrip.count({ where }),
    ])

    const movements = truckTrips.map((trip) => {
      const checkIn = trip.gateEvents.find(
        (e) => e.type === GateEventType.CHECK_IN
      )
      const checkOut = trip.gateEvents.find(
        (e) => e.type === GateEventType.CHECK_OUT
      )

      let turnaroundTimeMinutes: number | null = null
      if (checkIn && checkOut) {
        turnaroundTimeMinutes = Math.round(
          (checkOut.timestamp.getTime() - checkIn.timestamp.getTime()) / 60000
        )
      }

      return {
        truckTripId: trip.id,
        truckNumber: trip.truckNumber,
        driverName: trip.driverName,
        status: trip.status,
        booking: trip.booking,
        checkInTime: checkIn?.timestamp ?? null,
        checkOutTime: checkOut?.timestamp ?? null,
        turnaroundTimeMinutes,
        gateEvents: trip.gateEvents,
      }
    })

    return NextResponse.json({ movements, total, page, limit })
  } catch (err) {
    console.error('Failed to fetch movements report:', err)
    return NextResponse.json(
      { error: 'Failed to fetch movements report' },
      { status: 500 }
    )
  }
}
