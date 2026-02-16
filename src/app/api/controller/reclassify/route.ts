import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/controller/reclassify
 *
 * Changes a truck trip's priorityClass with a reason.
 */
export async function POST(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.CONTROLLER_RECLASSIFY,
    headers: request.headers,
  })
  if (error) return error

  try {
    const body = await request.json()
    const { truckTripId, newPriorityClass, reason } = body

    if (!truckTripId || !newPriorityClass || !reason) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "truckTripId, newPriorityClass, and reason are required.", requestId: ctx.requestId } },
        { status: 400 }
      )
    }

    const validClasses = ["APPOINTMENT", "FCFS", "RECLASSIFIED", "BLOCKED"]
    if (!validClasses.includes(newPriorityClass)) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: `Invalid priorityClass. Must be one of: ${validClasses.join(", ")}`, requestId: ctx.requestId } },
        { status: 400 }
      )
    }

    const before = await prisma.truckTrip.findUnique({
      where: { id: truckTripId },
      select: { priorityClass: true },
    })

    if (!before) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Truck trip not found.", requestId: ctx.requestId } },
        { status: 404 }
      )
    }

    const updated = await prisma.truckTrip.update({
      where: { id: truckTripId },
      data: { priorityClass: newPriorityClass },
    })

    await createAuditLog({
      actorUserId: ctx.user.id,
      entityType: "TruckTrip",
      entityId: truckTripId,
      action: "RECLASSIFY",
      before: { priorityClass: before.priorityClass },
      after: { priorityClass: updated.priorityClass, reason },
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      success: true,
      truckTripId,
      priorityClass: updated.priorityClass,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err.message || "Reclassification failed.", requestId: ctx.requestId } },
      { status: 500 }
    )
  }
}
