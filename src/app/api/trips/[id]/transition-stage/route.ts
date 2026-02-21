import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { CustodyStage } from "@prisma/client"
import { reconcileBayStatuses } from "@/lib/bay-reconcile"

/**
 * POST /api/trips/:id/transition-stage
 *
 * Transition a trip's custody stage.
 * Body: { targetStage }
 * Validates allowed stage transitions.
 */

// Allowed stage transitions map
const ALLOWED_TRANSITIONS: Record<CustodyStage, CustodyStage[]> = {
  GATE_CHECKIN: [CustodyStage.SAFETY_APPROVED, CustodyStage.DOCUMENTS_VERIFIED],
  SAFETY_APPROVED: [CustodyStage.DOCUMENTS_VERIFIED, CustodyStage.READY_FOR_BAY],
  DOCUMENTS_VERIFIED: [CustodyStage.READY_FOR_BAY],
  WEIGH_IN: [],
  READY_FOR_BAY: [CustodyStage.LOADING_STARTED],
  LOADING_STARTED: [CustodyStage.LOADING_COMPLETED],
  LOADING_COMPLETED: [CustodyStage.WEIGH_OUT],
  WEIGH_OUT: [CustodyStage.SEALED],
  SEALED: [CustodyStage.CUSTODY_TRANSFERRED],
  CUSTODY_TRANSFERRED: [CustodyStage.EXITED],
  EXITED: [],
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await authorize({
    permission: P.CUSTODY_TRANSITION,
    headers: request.headers,
  })
  if (error) return error

  const { id } = params

  try {
    const body = await request.json()
    const { targetStage } = body

    if (!targetStage) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "targetStage is required.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // Validate targetStage is a valid CustodyStage enum value
    if (!Object.values(CustodyStage).includes(targetStage as CustodyStage)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: `Invalid targetStage: ${targetStage}. Must be one of: ${Object.values(CustodyStage).join(", ")}`,
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // Find the trip
    const trip = await prisma.truckTrip.findUnique({
      where: { id },
      include: {
        booking: true,
      },
    })

    if (!trip) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Trip not found.",
            requestId: ctx.requestId,
          },
        },
        { status: 404 }
      )
    }

    // Validate the transition is allowed
    const currentStage = trip.custodyStage
    const allowedTargets = ALLOWED_TRANSITIONS[currentStage] || []

    if (!allowedTargets.includes(targetStage as CustodyStage)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from ${currentStage} to ${targetStage}. Allowed targets: ${allowedTargets.length > 0 ? allowedTargets.join(", ") : "none (terminal stage)"}`,
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // Update the trip stage
    const updated = await prisma.truckTrip.update({
      where: { id },
      data: {
        custodyStage: targetStage as CustodyStage,
      },
      include: {
        booking: {
          include: {
            client: true,
            product: true,
          },
        },
      },
    })

    // Write TripEvent STAGE_CHANGE
    await prisma.tripEvent.create({
      data: {
        truckTripId: id,
        bookingId: trip.bookingId,
        type: "STAGE_CHANGE",
        stage: targetStage as CustodyStage,
        message: `Stage transitioned from ${currentStage} to ${targetStage}.`,
        payloadJson: {
          fromStage: currentStage,
          toStage: targetStage,
        },
        actorUserId: ctx.user.id,
      },
    })

    // Reconcile bay statuses after any custody stage change that could
    // affect occupancy (LOADING_STARTED, EXITED, CUSTODY_TRANSFERRED, etc.)
    const occupancyAffectingStages = new Set([
      CustodyStage.LOADING_STARTED,
      CustodyStage.LOADING_COMPLETED,
      CustodyStage.WEIGH_OUT,
      CustodyStage.SEALED,
      CustodyStage.CUSTODY_TRANSFERRED,
      CustodyStage.EXITED,
    ])
    if (occupancyAffectingStages.has(targetStage as CustodyStage)) {
      // Fire-and-forget; do not fail the request if reconciliation errors
      reconcileBayStatuses().catch(() => undefined)
    }

    return NextResponse.json({
      requestId: ctx.requestId,
      trip: updated,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to transition stage.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
