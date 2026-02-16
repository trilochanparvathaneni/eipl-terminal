import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/controller/update-eta
 *
 * Updates a truck trip's ETA fields: etaMinutes, etaSource, etaUpdatedAt.
 */
export async function POST(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.CONTROLLER_UPDATE_ETA,
    headers: request.headers,
  })
  if (error) return error

  try {
    const body = await request.json()
    const { truckTripId, etaMinutes, etaSource } = body

    if (!truckTripId || etaMinutes == null || !etaSource) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "truckTripId, etaMinutes, and etaSource are required.", requestId: ctx.requestId } },
        { status: 400 }
      )
    }

    const before = await prisma.truckTrip.findUnique({
      where: { id: truckTripId },
      select: { etaMinutes: true, etaSource: true, etaUpdatedAt: true },
    })

    if (!before) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Truck trip not found.", requestId: ctx.requestId } },
        { status: 404 }
      )
    }

    const updated = await prisma.truckTrip.update({
      where: { id: truckTripId },
      data: {
        etaMinutes: parseInt(String(etaMinutes), 10),
        etaSource,
        etaUpdatedAt: new Date(),
      },
    })

    await createAuditLog({
      actorUserId: ctx.user.id,
      entityType: "TruckTrip",
      entityId: truckTripId,
      action: "UPDATE_ETA",
      before,
      after: { etaMinutes: updated.etaMinutes, etaSource: updated.etaSource, etaUpdatedAt: updated.etaUpdatedAt },
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      success: true,
      truckTripId,
      etaMinutes: updated.etaMinutes,
      etaSource: updated.etaSource,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err.message || "ETA update failed.", requestId: ctx.requestId } },
      { status: 500 }
    )
  }
}
