import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/controller/state
 *
 * Returns the full controller console state:
 * - bays: all bays with gantry, products, lock, and active schedule blocks
 * - readyQueue: IN_TERMINAL truck trips with booking→product→client
 * - recentRecommendations: last 20 AI recommendation records
 */
export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.CONTROLLER_CONSOLE,
    headers: request.headers,
  })
  if (error) return error

  try {
    const [bays, readyQueue, recentRecommendations] = await Promise.all([
      // All bays with relations the console needs
      prisma.bay.findMany({
        include: {
          gantry: { select: { id: true, name: true } },
          currentProduct: { select: { id: true, name: true } },
          lastProduct: { select: { id: true, name: true } },
          lockedByTrip: { select: { id: true, truckNumber: true } },
          scheduleBlocks: {
            where: { status: { in: ["ACTIVE", "PLANNED"] } },
            select: {
              id: true,
              status: true,
              startPlannedAt: true,
              endPlannedAt: true,
              truckTrip: { select: { truckNumber: true } },
            },
            orderBy: { startPlannedAt: "asc" },
          },
        },
        orderBy: [{ gantry: { name: "asc" } }, { name: "asc" }],
      }),

      // All IN_TERMINAL trips (the ready queue)
      prisma.truckTrip.findMany({
        where: { status: "IN_TERMINAL" },
        select: {
          id: true,
          truckNumber: true,
          status: true,
          priorityClass: true,
          etaMinutes: true,
          etaSource: true,
          etaUpdatedAt: true,
          appointmentStart: true,
          appointmentEnd: true,
          readyForBayAt: true,
          queuePosition: true,
          predictedStartTime: true,
          riskFlags: true,
          lateToleranceMinutes: true,
          booking: {
            select: {
              id: true,
              bookingNo: true,
              product: { select: { id: true, name: true, category: true } },
              client: { select: { name: true } },
            },
          },
        },
        orderBy: [{ queuePosition: "asc" }, { readyForBayAt: "asc" }],
      }),

      // Recent AI recommendations
      prisma.aIRecommendation.findMany({
        select: {
          id: true,
          type: true,
          createdAt: true,
          confidence: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ])

    return NextResponse.json({
      requestId: ctx.requestId,
      bays,
      readyQueue,
      recentRecommendations,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to fetch controller state.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
