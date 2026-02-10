import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

// Lookup a truck trip by QR token
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(Role.SECURITY, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN)
  if (error) return error

  const { qrToken } = await req.json()
  if (!qrToken) {
    return NextResponse.json({ error: 'QR token is required' }, { status: 400 })
  }

  const trip = await prisma.truckTrip.findFirst({
    where: { qrToken },
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
  })

  if (!trip) {
    return NextResponse.json({ error: 'Invalid QR code - trip not found' }, { status: 404 })
  }

  return NextResponse.json(trip)
}
