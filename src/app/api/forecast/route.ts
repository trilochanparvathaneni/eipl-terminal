/**
 * GET /api/forecast
 *
 * Returns the raw inputs needed for the forecast engine:
 *   - scheduledTrucks: today's booked trucks with slot timings
 *   - currentState: live bay occupancy + yard queue counts
 *
 * The forecast computation itself runs client-side so simulation-mode
 * parameter changes are instant without a round-trip.
 *
 * Permission: forecast:read  (TRAFFIC_CONTROLLER, TERMINAL_ADMIN, SUPER_ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/auth/authorize'
import { P } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import type { ScheduledTruck } from '@/lib/forecast/types'

export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.FORECAST_READ,
    headers: request.headers,
  })
  if (error) return error

  try {
    const now = new Date()

    // ── Today's date window ─────────────────────────────────────────────────
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    // ── Parallel DB queries ─────────────────────────────────────────────────
    const [bays, tripsToday, tripsInTerminal] = await Promise.all([
      // Current bay occupancy
      prisma.bay.findMany({
        select: { status: true },
      }),

      // Today's booked trips with their slot windows
      prisma.truckTrip.findMany({
        where: {
          booking: {
            date: { gte: todayStart, lte: todayEnd },
            status: {
              in: [
                'OPS_SCHEDULED',
                'TRUCK_DETAILS_PENDING',
                'QR_ISSUED',
                'ARRIVED_GATE',
                'IN_TERMINAL',
                'LOADED',
              ],
            },
          },
        },
        select: {
          id: true,
          status: true,
          custodyStage: true,
          appointmentStart: true,
          appointmentEnd: true,
          booking: {
            select: {
              id: true,
              timeSlot: {
                select: { startTime: true, endTime: true, date: true },
              },
              product: { select: { category: true } },
            },
          },
        },
      }),

      // Trucks currently inside the terminal (for current state)
      prisma.truckTrip.findMany({
        where: { status: 'IN_TERMINAL' },
        select: {
          id: true,
          custodyStage: true,
          booking: { select: { status: true } },
        },
      }),
    ])

    // ── Derive current state ────────────────────────────────────────────────

    const currentBayOccupancy = bays.filter((b) => b.status === 'OCCUPIED').length

    // "Inside yard" = IN_TERMINAL but NOT yet at loading stage
    const loadingStages = new Set([
      'LOADING_STARTED',
      'LOADING_COMPLETED',
      'WEIGH_OUT',
      'SEALED',
      'CUSTODY_TRANSFERRED',
    ])
    const currentInsideYard = tripsInTerminal.filter(
      (t) => !loadingStages.has(t.custodyStage),
    ).length

    // "Outside queue" = arrived at gate, not yet IN_TERMINAL
    const currentOutsideQueue = tripsToday.filter(
      (t) => t.status === 'ARRIVED' || t.status === 'QR_ISSUED',
    ).length

    // ── Build scheduled truck list ──────────────────────────────────────────

    const scheduledTrucks: ScheduledTruck[] = tripsToday.map((trip) => {
      const isAlreadyInTerminal =
        trip.status === 'IN_TERMINAL' ||
        trip.status === 'LOADED' ||
        trip.status === 'EXITED' ||
        trip.status === 'COMPLETED'

      // Prefer appointment times; fall back to timeslot; fall back to now
      let slotStart: Date
      let slotEnd: Date

      if (trip.appointmentStart && trip.appointmentEnd) {
        slotStart = trip.appointmentStart
        slotEnd = trip.appointmentEnd
      } else if (trip.booking.timeSlot) {
        const ts = trip.booking.timeSlot
        const base = ts.date ?? todayStart
        slotStart = parseSlotTime(base, ts.startTime)
        slotEnd   = parseSlotTime(base, ts.endTime)
      } else {
        // No slot assigned — assume current time window
        slotStart = now
        slotEnd   = new Date(now.getTime() + 30 * 60_000)
      }

      const category = trip.booking.product?.category ?? 'CHEMICAL'

      return {
        bookingId: trip.booking.id,
        slotStartMinutesFromNow: (slotStart.getTime() - now.getTime()) / 60_000,
        slotEndMinutesFromNow:   (slotEnd.getTime()   - now.getTime()) / 60_000,
        isAlreadyInTerminal,
        productCategory:
          category === 'LPG'     ? 'LPG'
          : category === 'POL'   ? 'POL'
          : 'CHEMICAL',
      } satisfies ScheduledTruck
    })

    // ── Historical turnaround stats (last 30 completed trips) ───────────────
    const recentGateEvents = await prisma.gateEvent.findMany({
      where: {
        type: 'CHECK_OUT',
        timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
      },
      select: {
        timestamp: true,
        truckTripId: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 60,
    })

    // Pair with check-in events to compute turnaround
    const checkIns = await prisma.gateEvent.findMany({
      where: {
        type: 'CHECK_IN',
        truckTripId: { in: recentGateEvents.map((e) => e.truckTripId) },
      },
      select: { timestamp: true, truckTripId: true },
    })

    const checkInMap = new Map(checkIns.map((e) => [e.truckTripId, e.timestamp]))
    const turnarounds = recentGateEvents
      .map((co) => {
        const ci = checkInMap.get(co.truckTripId)
        if (!ci) return null
        return (co.timestamp.getTime() - ci.getTime()) / 60_000
      })
      .filter((t): t is number => t !== null && t > 0 && t < 300)

    const avgHistoricalTurnaroundMin =
      turnarounds.length > 0
        ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
        : null

    return NextResponse.json({
      requestId: ctx.requestId,
      generatedAt: now.toISOString(),
      currentState: {
        currentBayOccupancy,
        currentInsideYard,
        currentOutsideQueue,
        totalBays: bays.length,
      },
      scheduledTrucks,
      historicalStats: {
        avgTurnaroundMin: avgHistoricalTurnaroundMin,
        sampleSize: turnarounds.length,
      },
    })
  } catch (err) {
    console.error('[forecast] Error:', err)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL',
          message: 'Failed to fetch forecast data.',
          requestId: ctx?.requestId,
        },
      },
      { status: 500 },
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "HH:MM" slot time string into a Date on the given base date. */
function parseSlotTime(base: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h ?? 8, m ?? 0, 0, 0)
  return d
}
