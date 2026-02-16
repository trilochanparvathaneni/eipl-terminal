import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"

// Map action → required permission
const ACTION_PERMISSION: Record<string, string> = {
  maintenance: P.CONTROLLER_LOCK_BAY,
  end_maintenance: P.CONTROLLER_LOCK_BAY,
  set_ready_changeover: P.CHANGEOVER_SET_READY,
  lock: P.CONTROLLER_LOCK_BAY,
  unlock: P.CONTROLLER_LOCK_BAY,
}

/**
 * POST /api/controller/bay-action
 *
 * Performs bay state transitions:
 * - maintenance: IDLE → MAINTENANCE
 * - end_maintenance: MAINTENANCE → IDLE
 * - set_ready_changeover: NEEDS_CLEARANCE → READY_FOR_CHANGEOVER
 * - lock: → BLOCKED
 * - unlock: → IDLE, clear lockedByTripId
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bayId, action, reason } = body

    if (!bayId || !action) {
      // Need a basic auth check even for validation errors
      const { ctx, error } = await authorize({
        permission: P.CONTROLLER_CONSOLE,
        headers: request.headers,
      })
      if (error) return error
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "bayId and action are required.", requestId: ctx.requestId } },
        { status: 400 }
      )
    }

    const permission = ACTION_PERMISSION[action]
    if (!permission) {
      const { ctx, error } = await authorize({
        permission: P.CONTROLLER_CONSOLE,
        headers: request.headers,
      })
      if (error) return error
      return NextResponse.json(
        { error: { code: "VALIDATION", message: `Unknown action: ${action}. Valid actions: ${Object.keys(ACTION_PERMISSION).join(", ")}`, requestId: ctx.requestId } },
        { status: 400 }
      )
    }

    const { ctx, error } = await authorize({
      permission: permission as any,
      headers: request.headers,
    })
    if (error) return error

    const bay = await prisma.bay.findUnique({ where: { id: bayId } })
    if (!bay) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Bay not found.", requestId: ctx.requestId } },
        { status: 404 }
      )
    }

    let updateData: Record<string, any> = {}

    switch (action) {
      case "maintenance":
        if (bay.status !== "IDLE") {
          return NextResponse.json(
            { error: { code: "VALIDATION", message: "Bay must be IDLE to set maintenance.", requestId: ctx.requestId } },
            { status: 400 }
          )
        }
        updateData = { status: "MAINTENANCE" }
        break

      case "end_maintenance":
        if (bay.status !== "MAINTENANCE") {
          return NextResponse.json(
            { error: { code: "VALIDATION", message: "Bay must be in MAINTENANCE to end it.", requestId: ctx.requestId } },
            { status: 400 }
          )
        }
        updateData = { status: "IDLE" }
        break

      case "set_ready_changeover":
        if (bay.changeoverState !== "NEEDS_CLEARANCE") {
          return NextResponse.json(
            { error: { code: "VALIDATION", message: "Bay must be in NEEDS_CLEARANCE state.", requestId: ctx.requestId } },
            { status: 400 }
          )
        }
        updateData = { changeoverState: "READY_FOR_CHANGEOVER" }
        break

      case "lock":
        updateData = { status: "BLOCKED" }
        break

      case "unlock":
        updateData = { status: "IDLE", lockedByTripId: null }
        break
    }

    const updated = await prisma.bay.update({
      where: { id: bayId },
      data: updateData,
    })

    await createAuditLog({
      actorUserId: ctx.user.id,
      entityType: "Bay",
      entityId: bayId,
      action: `BAY_ACTION:${action.toUpperCase()}`,
      before: { status: bay.status, changeoverState: bay.changeoverState, lockedByTripId: bay.lockedByTripId },
      after: { status: updated.status, changeoverState: updated.changeoverState, lockedByTripId: updated.lockedByTripId, reason },
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      success: true,
      bayId,
      action,
      newStatus: updated.status,
      newChangeoverState: updated.changeoverState,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err.message || "Bay action failed." } },
      { status: 500 }
    )
  }
}
