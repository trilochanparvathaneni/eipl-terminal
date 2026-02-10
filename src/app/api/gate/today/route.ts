import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(Role.SECURITY, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN)
  if (error) return error

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const trips = await prisma.truckTrip.findMany({
    where: {
      booking: {
        date: { gte: today, lt: tomorrow },
        status: {
          in: ['QR_ISSUED', 'ARRIVED_GATE', 'IN_TERMINAL', 'LOADED', 'EXITED', 'CLOSED'],
        },
      },
    },
    include: {
      booking: {
        include: {
          client: true,
          product: true,
          timeSlot: true,
          terminal: true,
          bayAllocations: { include: { bay: { include: { gantry: true } } } },
          stopWorkOrders: { where: { active: true } },
        },
      },
      gateEvents: {
        include: { security: { select: { name: true } } },
        orderBy: { timestamp: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(trips)
}
