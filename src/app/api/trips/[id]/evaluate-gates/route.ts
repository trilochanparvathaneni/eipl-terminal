import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/trips/:id/evaluate-gates
 *
 * Evaluate compliance gates (SAFETY, DOCUMENTS, STOP_WORK) for a trip.
 * If ALL pass: set trip to READY_FOR_BAY. If ANY fail: set BLOCKED.
 * Returns the gate results.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await authorize({
    permission: P.COMPLIANCE_EVALUATE,
    headers: request.headers,
  })
  if (error) return error

  const { id } = params

  try {
    // Find the trip with booking
    const trip = await prisma.truckTrip.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            product: true,
          },
        },
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

    const bookingId = trip.bookingId
    const now = new Date()

    // ── SAFETY gate ──────────────────────────────────────────────────────
    // Check if latest SafetyChecklist for the booking has status=PASSED
    const latestSafety = await prisma.safetyChecklist.findFirst({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
    })

    const safetyPassed = latestSafety?.status === "PASSED"
    const safetyReason = !latestSafety
      ? "No safety checklist found for this booking."
      : latestSafety.status !== "PASSED"
      ? `Safety checklist status is ${latestSafety.status}.`
      : null

    // ── DOCUMENTS gate ───────────────────────────────────────────────────
    // Check that ALL mandatory DocumentTypes with allowedLinkTypes containing
    // BOOKING have a VERIFIED DocumentRecord for this booking
    const mandatoryDocTypes = await prisma.documentType.findMany({
      where: {
        isMandatory: true,
        allowedLinkTypes: { has: "BOOKING" },
      },
    })

    const missingDocs: string[] = []

    for (const docType of mandatoryDocTypes) {
      const verifiedDoc = await prisma.documentRecord.findFirst({
        where: {
          documentTypeId: docType.id,
          linkType: "BOOKING",
          linkId: bookingId,
          verificationStatus: "VERIFIED",
        },
      })

      if (!verifiedDoc) {
        missingDocs.push(docType.name)
      }
    }

    const documentsPassed = missingDocs.length === 0
    const documentsReason =
      missingDocs.length > 0
        ? `Missing verified documents: ${missingDocs.join(", ")}.`
        : null

    // ── STOP_WORK gate ───────────────────────────────────────────────────
    // Check that no active StopWorkOrder exists for the booking
    const activeStopWork = await prisma.stopWorkOrder.findFirst({
      where: {
        bookingId,
        active: true,
      },
    })

    const stopWorkPassed = !activeStopWork
    const stopWorkReason = activeStopWork
      ? `Active stop work order exists: ${activeStopWork.reason}`
      : null

    // ── Create ComplianceGateResults ─────────────────────────────────────
    const gateResults = await prisma.$transaction([
      prisma.complianceGateResult.create({
        data: {
          truckTripId: id,
          bookingId,
          gateType: "SAFETY",
          status: safetyPassed ? "PASS" : "FAIL",
          reason: safetyReason,
          detailsJson: latestSafety
            ? { checklistId: latestSafety.id, status: latestSafety.status }
            : undefined,
          evaluatedByUserId: ctx.user.id,
          evaluatedAt: now,
        },
      }),
      prisma.complianceGateResult.create({
        data: {
          truckTripId: id,
          bookingId,
          gateType: "DOCUMENTS",
          status: documentsPassed ? "PASS" : "FAIL",
          reason: documentsReason,
          detailsJson: {
            mandatoryDocTypes: mandatoryDocTypes.map((d) => d.name),
            missingDocs,
          },
          evaluatedByUserId: ctx.user.id,
          evaluatedAt: now,
        },
      }),
      prisma.complianceGateResult.create({
        data: {
          truckTripId: id,
          bookingId,
          gateType: "STOP_WORK",
          status: stopWorkPassed ? "PASS" : "FAIL",
          reason: stopWorkReason,
          detailsJson: activeStopWork
            ? { stopWorkOrderId: activeStopWork.id }
            : undefined,
          evaluatedByUserId: ctx.user.id,
          evaluatedAt: now,
        },
      }),
    ])

    // ── Determine overall result and update trip ─────────────────────────
    const allPassed = safetyPassed && documentsPassed && stopWorkPassed

    if (allPassed) {
      await prisma.truckTrip.update({
        where: { id },
        data: {
          custodyStage: "READY_FOR_BAY",
          readyForBayAt: now,
          // priorityClass stays or becomes FCFS
          priorityClass:
            trip.priorityClass === "BLOCKED" ? "FCFS" : trip.priorityClass,
        },
      })

      await prisma.tripEvent.create({
        data: {
          truckTripId: id,
          bookingId,
          type: "COMPLIANCE_CLEARED",
          stage: "READY_FOR_BAY",
          message: "All compliance gates passed. Trip is ready for bay.",
          payloadJson: {
            gates: gateResults.map((g) => ({
              gateType: g.gateType,
              status: g.status,
            })),
          },
          actorUserId: ctx.user.id,
        },
      })
    } else {
      const failReasons: string[] = []
      if (!safetyPassed && safetyReason) failReasons.push(safetyReason)
      if (!documentsPassed && documentsReason) failReasons.push(documentsReason)
      if (!stopWorkPassed && stopWorkReason) failReasons.push(stopWorkReason)

      await prisma.truckTrip.update({
        where: { id },
        data: {
          priorityClass: "BLOCKED",
        },
      })

      await prisma.tripEvent.create({
        data: {
          truckTripId: id,
          bookingId,
          type: "COMPLIANCE_BLOCKED",
          stage: trip.custodyStage,
          message: `Compliance blocked: ${failReasons.join(" | ")}`,
          payloadJson: {
            gates: gateResults.map((g) => ({
              gateType: g.gateType,
              status: g.status,
              reason: g.reason,
            })),
            failReasons,
          },
          actorUserId: ctx.user.id,
        },
      })
    }

    return NextResponse.json({
      requestId: ctx.requestId,
      allPassed,
      gates: gateResults.map((g) => ({
        id: g.id,
        gateType: g.gateType,
        status: g.status,
        reason: g.reason,
        detailsJson: g.detailsJson,
        evaluatedAt: g.evaluatedAt,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to evaluate compliance gates.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
