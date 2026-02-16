import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

/**
 * POST /api/trips/:id/generate-evidence-pack
 *
 * Gather all trip-related data, build a JSON evidence bundle,
 * compute sha256, create an EvidencePack record, and return it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await authorize({
    permission: P.EVIDENCE_GENERATE,
    headers: request.headers,
  })
  if (error) return error

  const { id } = params

  try {
    // Gather trip details with booking
    const trip = await prisma.truckTrip.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            client: true,
            product: true,
            transporter: true,
            terminal: true,
            bayAllocations: {
              include: {
                bay: true,
                arm: true,
                allocatedBy: {
                  select: { id: true, name: true, email: true, role: true },
                },
              },
            },
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

    // Gather gate events
    const gateEvents = await prisma.gateEvent.findMany({
      where: { truckTripId: id },
      orderBy: { timestamp: "asc" },
      include: {
        security: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Gather safety checklists for the booking
    const safetyChecklists = await prisma.safetyChecklist.findMany({
      where: { bookingId: trip.bookingId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Gather documents linked to the booking
    const documents = await prisma.documentRecord.findMany({
      where: {
        linkType: "BOOKING",
        linkId: trip.bookingId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        documentType: true,
        verifiedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Gather compliance gate results
    const complianceResults = await prisma.complianceGateResult.findMany({
      where: { truckTripId: id },
      orderBy: { evaluatedAt: "desc" },
      include: {
        evaluatedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Gather trip events
    const tripEvents = await prisma.tripEvent.findMany({
      where: { truckTripId: id },
      orderBy: { createdAt: "asc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Build the evidence bundle
    const evidenceBundle = {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
      },
      trip: {
        id: trip.id,
        truckNumber: trip.truckNumber,
        driverName: trip.driverName,
        driverPhone: trip.driverPhone,
        status: trip.status,
        custodyStage: trip.custodyStage,
        priorityClass: trip.priorityClass,
        readyForBayAt: trip.readyForBayAt,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
      },
      booking: {
        id: trip.booking.id,
        bookingNo: trip.booking.bookingNo,
        status: trip.booking.status,
        date: trip.booking.date,
        quantityRequested: trip.booking.quantityRequested,
        client: trip.booking.client,
        product: trip.booking.product,
        transporter: trip.booking.transporter,
        terminal: trip.booking.terminal,
        bayAllocations: trip.booking.bayAllocations,
      },
      gateEvents,
      safetyChecklists,
      documents,
      complianceResults,
      tripEvents,
    }

    // Compute sha256 hash of the JSON string
    const jsonString = JSON.stringify(evidenceBundle)
    const sha256 = crypto.createHash("sha256").update(jsonString).digest("hex")

    // Create EvidencePack record
    const evidencePack = await prisma.evidencePack.create({
      data: {
        truckTripId: id,
        bookingId: trip.bookingId,
        status: "GENERATED",
        sha256,
        generatedByUserId: ctx.user.id,
        generatedAt: new Date(),
      },
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      evidencePack: {
        id: evidencePack.id,
        truckTripId: evidencePack.truckTripId,
        bookingId: evidencePack.bookingId,
        status: evidencePack.status,
        sha256: evidencePack.sha256,
        generatedByUserId: evidencePack.generatedByUserId,
        generatedAt: evidencePack.generatedAt,
      },
      bundle: evidenceBundle,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to generate evidence pack.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
