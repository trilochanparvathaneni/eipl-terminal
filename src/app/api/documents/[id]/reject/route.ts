import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/documents/:id/reject
 *
 * Mark a document as REJECTED.
 * Body: { reason }
 * Writes AuditLog + TripEvent (DOC_REJECTED) if linked to a trip.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await authorize({
    permission: P.DOCUMENT_REJECT,
    headers: request.headers,
  })
  if (error) return error

  const { id } = params

  try {
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "reason is required.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // Find the document
    const document = await prisma.documentRecord.findUnique({
      where: { id },
      include: { documentType: true },
    })

    if (!document) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Document not found.",
            requestId: ctx.requestId,
          },
        },
        { status: 404 }
      )
    }

    if (document.verificationStatus === "REJECTED") {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_REJECTED",
            message: "Document is already rejected.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    const now = new Date()

    // Update document to REJECTED
    const updated = await prisma.documentRecord.update({
      where: { id },
      data: {
        verificationStatus: "REJECTED",
        verifiedByUserId: ctx.user.id,
        verifiedAt: now,
        rejectionReason: reason,
      },
      include: {
        documentType: true,
        verifiedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        actorUserId: ctx.user.id,
        entityType: "DocumentRecord",
        entityId: id,
        action: "REJECT",
        beforeJson: {
          verificationStatus: document.verificationStatus,
        },
        afterJson: {
          verificationStatus: "REJECTED",
          rejectionReason: reason,
          verifiedByUserId: ctx.user.id,
          verifiedAt: now,
        },
      },
    })

    // Write TripEvent (DOC_REJECTED) if linked to a booking with an active trip
    if (document.linkType === "BOOKING") {
      const activeTrip = await prisma.truckTrip.findFirst({
        where: {
          bookingId: document.linkId,
          status: { notIn: ["COMPLETED", "EXITED"] },
        },
      })

      if (activeTrip) {
        await prisma.tripEvent.create({
          data: {
            truckTripId: activeTrip.id,
            bookingId: document.linkId,
            type: "DOC_REJECTED",
            stage: activeTrip.custodyStage,
            message: `Document rejected: ${document.documentType.name} (v${document.version}) - ${reason}`,
            payloadJson: { documentRecordId: id, reason },
            actorUserId: ctx.user.id,
          },
        })
      }
    }

    return NextResponse.json({
      requestId: ctx.requestId,
      document: updated,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to reject document.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
