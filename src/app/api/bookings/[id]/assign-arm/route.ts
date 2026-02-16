import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/bookings/:id/assign-arm
 *
 * Assign a loading arm (and bay) to a booking.
 * Body: { bayId, armId }
 * Validates arm contamination rules before assigning.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await authorize({
    permission: P.CONTROLLER_ASSIGN_ARM,
    headers: request.headers,
  })
  if (error) return error

  const bookingId = params.id

  try {
    const body = await request.json()
    const { bayId, armId } = body

    if (!bayId || !armId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "bayId and armId are required.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // Load the booking with product
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { product: true },
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

    // Load the arm with currentProduct
    const arm = await prisma.loadingArm.findUnique({
      where: { id: armId },
      include: { currentProduct: true, bay: true },
    })

    if (!arm) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Loading arm not found.",
            requestId: ctx.requestId,
          },
        },
        { status: 404 }
      )
    }

    // Validate arm belongs to the specified bay
    if (arm.bayId !== bayId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "The specified arm does not belong to the specified bay.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    // Check arm status: MAINTENANCE or BLOCKED -> 409
    if (arm.status === "MAINTENANCE" || arm.status === "BLOCKED") {
      return NextResponse.json(
        {
          error: {
            code: "ARM_UNAVAILABLE",
            message: `Loading arm is currently ${arm.status} and cannot be assigned.`,
            requestId: ctx.requestId,
          },
        },
        { status: 409 }
      )
    }

    // Contamination rules
    if (arm.currentProductId !== null) {
      if (arm.currentProductId === booking.productId) {
        // Same product -> OK
      } else {
        // Different product: arm must be READY_FOR_CHANGEOVER
        if (arm.changeoverState !== "READY_FOR_CHANGEOVER") {
          return NextResponse.json(
            {
              error: {
                code: "CHANGEOVER_NOT_READY",
                message: `Arm changeover state is ${arm.changeoverState}. Must be READY_FOR_CHANGEOVER to switch products.`,
                requestId: ctx.requestId,
              },
            },
            { status: 409 }
          )
        }

        // Look up ProductCompatibility
        const compatibility = await prisma.productCompatibility.findUnique({
          where: {
            fromProductId_toProductId: {
              fromProductId: arm.currentProductId,
              toProductId: booking.productId,
            },
          },
        })

        if (!compatibility || !compatibility.isCompatible) {
          const fromName = arm.currentProduct?.name ?? arm.currentProductId
          const toName = booking.product.name

          return NextResponse.json(
            {
              error: {
                code: "INCOMPATIBLE_PRODUCT",
                message: `Product changeover from "${fromName}" to "${toName}" is not compatible.${
                  compatibility?.notes ? ` Note: ${compatibility.notes}` : ""
                }`,
                requestId: ctx.requestId,
              },
            },
            { status: 409 }
          )
        }
      }
    }
    // If arm.currentProductId is null -> OK (empty arm)

    // Create BookingBayAllocation
    const allocation = await prisma.bookingBayAllocation.create({
      data: {
        bookingId,
        bayId,
        armId,
        allocatedByUserId: ctx.user.id,
      },
      include: {
        booking: {
          include: {
            client: true,
            product: true,
          },
        },
        bay: true,
        arm: {
          include: {
            currentProduct: true,
          },
        },
        allocatedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Find the active trip for this booking and write TripEvent ARM_ASSIGNED
    const activeTrip = await prisma.truckTrip.findFirst({
      where: {
        bookingId,
        status: { notIn: ["COMPLETED", "EXITED"] },
      },
    })

    if (activeTrip) {
      await prisma.tripEvent.create({
        data: {
          truckTripId: activeTrip.id,
          bookingId,
          type: "ARM_ASSIGNED",
          stage: activeTrip.custodyStage,
          message: `Loading arm ${arm.name ?? arm.armNo} on bay ${arm.bay.name} assigned to booking ${booking.bookingNo}.`,
          payloadJson: {
            allocationId: allocation.id,
            bayId,
            armId,
            armName: arm.name ?? `Arm ${arm.armNo}`,
            bayName: arm.bay.name,
          },
          actorUserId: ctx.user.id,
        },
      })
    }

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        actorUserId: ctx.user.id,
        entityType: "BookingBayAllocation",
        entityId: allocation.id,
        action: "ASSIGN_ARM",
        afterJson: {
          bookingId,
          bayId,
          armId,
          bookingNo: booking.bookingNo,
        },
      },
    })

    return NextResponse.json(
      {
        requestId: ctx.requestId,
        allocation,
      },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to assign arm.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
