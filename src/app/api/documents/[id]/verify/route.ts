import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/documents/:id/verify
 *
 * Mark a document as VERIFIED.
 * Updates verificationStatus, verifiedByUserId, verifiedAt.
 * Writes AuditLog + TripEvent (DOC_VERIFIED) if linked to a trip.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await authorize({
    permission: P.DOCUMENT_VERIFY,
    headers: request.headers,
  })
  if (error) return error

  const { id } = params

  try {
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

    if (document.verificationStatus === "VERIFIED") {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_VERIFIED",
            message: "Document is already verified.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    const now = new Date()

    // Update document to VERIFIED
    const updated = await prisma.documentRecord.update({
      where: { id },
      data: {
        verificationStatus: "VERIFIED",
        verifiedByUserId: ctx.user.id,
        verifiedAt: now,
        rejectionReason: null,
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
        action: "VERIFY",
        beforeJson: {
          verificationStatus: document.verificationStatus,
        },
        afterJson: {
          verificationStatus: "VERIFIED",
          verifiedByUserId: ctx.user.id,
          verifiedAt: now,
        },
      },
    })

    // Write TripEvent (DOC_VERIFIED) if linked to a booking with an active trip
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
            type: "DOC_VERIFIED",
            stage: activeTrip.custodyStage,
            message: `Document verified: ${document.documentType.name} (v${document.version})`,
            payloadJson: { documentRecordId: id },
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
          message: "Failed to verify document.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
