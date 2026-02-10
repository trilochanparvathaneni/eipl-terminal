import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const url = new URL(req.url)
    const date = url.searchParams.get('date')
    const terminalId = url.searchParams.get('terminalId')

    if (!date || !terminalId) {
      return NextResponse.json(
        { error: 'date and terminalId query params are required' },
        { status: 400 }
      )
    }

    const timeSlots = await prisma.timeSlot.findMany({
      where: {
        terminalId,
        date: new Date(date),
      },
      include: {
        _count: { select: { bookings: true } },
      },
      orderBy: { startTime: 'asc' },
    })

    const slots = timeSlots.map((slot) => ({
      id: slot.id,
      terminalId: slot.terminalId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacityTrucks: slot.capacityTrucks,
      currentBookings: slot._count.bookings,
      availableCapacity: slot.capacityTrucks - slot._count.bookings,
    }))

    return NextResponse.json({ timeSlots: slots })
  } catch (err) {
    console.error('Failed to fetch time slots:', err)
    return NextResponse.json(
      { error: 'Failed to fetch time slots' },
      { status: 500 }
    )
  }
}
