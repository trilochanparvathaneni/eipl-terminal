import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role, BookingStatus, IncidentStatus, TruckTripStatus } from '@prisma/client'

export async function GET() {
  const { user, error } = await requireAuth()
  if (error) return error

  const where: any = {}
  if (user!.role === Role.CLIENT && user!.clientId) where.clientId = user!.clientId
  if (user!.role === Role.TRANSPORTER && user!.transporterId) where.transporterId = user!.transporterId

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [totalBookings, todayTrips, inTerminal, openIncidents] = await Promise.all([
    prisma.booking.count({
      where: {
        ...where,
        status: { notIn: [BookingStatus.CLOSED, BookingStatus.CANCELLED, BookingStatus.REJECTED] },
      },
    }),
    prisma.truckTrip.count({
      where: {
        booking: { ...where, date: { gte: today, lt: tomorrow } },
      },
    }),
    prisma.truckTrip.count({
      where: {
        status: TruckTripStatus.IN_TERMINAL,
        ...(Object.keys(where).length > 0 ? { booking: where } : {}),
      },
    }),
    prisma.incident.count({
      where: { status: IncidentStatus.OPEN },
    }),
  ])

  return NextResponse.json({ totalBookings, todayTrips, inTerminal, openIncidents })
}
