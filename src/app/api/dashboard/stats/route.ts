import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role, BookingStatus, IncidentStatus, TruckTripStatus } from '@prisma/client'
import { bookingScopeForUser } from '@/lib/auth/scope'

export async function GET() {
  const { user, error } = await requireAuth()
  if (error) return error

  const scoped = bookingScopeForUser(user!)
  if (scoped.error) return scoped.error
  const where: any = { ...scoped.where }
  const incidentWhere: any = { status: IncidentStatus.OPEN }
  if (user!.role !== Role.SUPER_ADMIN && user!.terminalId) {
    incidentWhere.terminalId = user!.terminalId
  }
  const canReadIncidentSummary =
    user!.role !== Role.CLIENT && user!.role !== Role.TRANSPORTER

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
    canReadIncidentSummary ? prisma.incident.count({ where: incidentWhere }) : Promise.resolve(0),
  ])

  return NextResponse.json({ totalBookings, todayTrips, inTerminal, openIncidents })
}
