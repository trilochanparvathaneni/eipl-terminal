import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/controller/apply-assignment
 *
 * Atomically assigns a truck trip to a bay:
 * - Sets bay status to OCCUPIED, currentProductId, lockedByTripId
 * - Creates a BayScheduleBlock (ACTIVE, CONTROLLER_CONFIRMED)
 * - Clears the trip's queuePosition
 * - Marks AIRecommendation as applied (if provided)
 */
export async function POST(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.CONTROLLER_ASSIGN_BAY,
    headers: request.headers,
  })
  if (error) return error

  try {
    const body = await request.json()
    const { truckTripId, bayId, aiRecommendationId } = body

    if (!truckTripId || !bayId) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "truckTripId and bayId are required.", requestId: ctx.requestId } },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch trip with booking to get product
      const trip = await tx.truckTrip.findUnique({
        where: { id: truckTripId },
        include: { booking: { select: { productId: true } } },
      })
      if (!trip) throw new Error("Truck trip not found")

      const bay = await tx.bay.findUnique({ where: { id: bayId } })
      if (!bay) throw new Error("Bay not found")

      const now = new Date()

      // Update bay: OCCUPIED, set product, lock to trip
      const updatedBay = await tx.bay.update({
        where: { id: bayId },
        data: {
          status: "OCCUPIED",
          currentProductId: trip.booking.productId,
          lockedByTripId: truckTripId,
        },
      })

      // Create schedule block
      await tx.bayScheduleBlock.create({
        data: {
          bayId,
          truckTripId,
          startPlannedAt: now,
          endPlannedAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // default 2h window
          startActualAt: now,
          status: "ACTIVE",
          source: "CONTROLLER_CONFIRMED",
        },
      })

      // Clear trip queue position
      await tx.truckTrip.update({
        where: { id: truckTripId },
        data: { queuePosition: null },
      })

      // Mark AI recommendation as applied (if provided)
      if (aiRecommendationId) {
        await tx.aIRecommendation.update({
          where: { id: aiRecommendationId },
          data: {
            appliedAt: now,
            appliedByAction: `CONTROLLER_ASSIGN:${ctx.user.id}`,
          },
        }).catch(() => {
          // Recommendation may not exist — non-critical
        })
      }

      return { bay: updatedBay, trip }
    })

    await createAuditLog({
      actorUserId: ctx.user.id,
      entityType: "Bay",
      entityId: bayId,
      action: "ASSIGN_BAY",
      after: { truckTripId, bayId, aiRecommendationId },
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      success: true,
      bayId,
      truckTripId,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err.message || "Assignment failed.", requestId: ctx.requestId } },
      { status: 500 }
    )
  }
}
