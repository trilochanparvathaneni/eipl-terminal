import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { Role } from "@prisma/client"

/**
 * GET /api/documents?linkType=BOOKING&linkId=xxx
 *
 * Fetch documents for a given link (e.g. a booking).
 * CLIENT role users can only see documents linked to their own bookings.
 */
export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.DOCUMENT_READ,
    headers: request.headers,
  })
  if (error) return error

  try {
    const url = new URL(request.url)
    const linkType = url.searchParams.get("linkType")
    const linkId = url.searchParams.get("linkId")

    if (!linkType || !linkId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "linkType and linkId query parameters are required.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // CLIENT role: enforce that the linkId is their own booking
    if (ctx.user.role === Role.CLIENT && linkType === "BOOKING") {
      const booking = await prisma.booking.findUnique({
        where: { id: linkId },
        select: { clientId: true },
      })

      if (!booking) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Booking not found.",
              requestId: ctx.requestId,
            },
          },
          { status: 404 }
        )
      }

      if (booking.clientId !== ctx.user.clientId) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "You can only view documents for your own bookings.",
              requestId: ctx.requestId,
            },
          },
          { status: 403 }
        )
      }
    }

    const documents = await prisma.documentRecord.findMany({
      where: {
        linkType: linkType as any,
        linkId,
      },
      include: {
        documentType: true,
        verifiedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      documents,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to fetch documents.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/documents
 *
 * Create a new DocumentRecord (upload).
 * Body: { documentTypeId, linkType, linkId, fileUrl, expiryDate? }
 * CLIENT role users can only upload documents for their own bookings.
 */
export async function POST(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.DOCUMENT_UPLOAD,
    headers: request.headers,
  })
  if (error) return error

  try {
    const body = await request.json()
    const { documentTypeId, linkType, linkId, fileUrl, expiryDate } = body

    if (!documentTypeId || !linkType || !linkId || !fileUrl) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message:
              "Missing required fields: documentTypeId, linkType, linkId, fileUrl.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // Validate documentType exists
    const docType = await prisma.documentType.findUnique({
      where: { id: documentTypeId },
    })

    if (!docType) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Document type not found.",
            requestId: ctx.requestId,
          },
        },
        { status: 404 }
      )
    }

    // CLIENT role: enforce that the linkId is their own booking
    if (ctx.user.role === Role.CLIENT && linkType === "BOOKING") {
      const booking = await prisma.booking.findUnique({
        where: { id: linkId },
        select: { clientId: true },
      })

      if (!booking) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Booking not found.",
              requestId: ctx.requestId,
            },
          },
          { status: 404 }
        )
      }

      if (booking.clientId !== ctx.user.clientId) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "You can only upload documents for your own bookings.",
              requestId: ctx.requestId,
            },
          },
          { status: 403 }
        )
      }
    }

    // Determine version: increment if a previous record exists for same type + link
    const existingCount = await prisma.documentRecord.count({
      where: { documentTypeId, linkType: linkType as any, linkId },
    })

    const document = await prisma.documentRecord.create({
      data: {
        documentTypeId,
        linkType: linkType as any,
        linkId,
        fileUrl,
        version: existingCount + 1,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        verificationStatus: "PENDING",
      },
      include: {
        documentType: true,
      },
    })

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        actorUserId: ctx.user.id,
        entityType: "DocumentRecord",
        entityId: document.id,
        action: "UPLOAD",
        afterJson: {
          documentTypeId,
          linkType,
          linkId,
          fileUrl,
          version: document.version,
        },
      },
    })

    // Write TripEvent if linked to a booking with an active trip
    if (linkType === "BOOKING") {
      const activeTrip = await prisma.truckTrip.findFirst({
        where: {
          bookingId: linkId,
          status: { notIn: ["COMPLETED", "EXITED"] },
        },
      })

      if (activeTrip) {
        await prisma.tripEvent.create({
          data: {
            truckTripId: activeTrip.id,
            bookingId: linkId,
            type: "DOC_UPLOADED",
            stage: activeTrip.custodyStage,
            message: `Document uploaded: ${docType.name} (v${document.version})`,
            payloadJson: { documentRecordId: document.id },
            actorUserId: ctx.user.id,
          },
        })
      }
    }

    return NextResponse.json(
      {
        requestId: ctx.requestId,
        document,
      },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to upload document.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
