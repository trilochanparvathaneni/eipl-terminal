import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/rbac"
import { bookingScopeForUser } from "@/lib/auth/scope"
import { redactPII } from "@/lib/ai/redact"
import type { ChatToolFn } from "./types"

const ENTITY_MODELS: Record<string, string> = {
  booking: "booking",
  truck_trip: "truckTrip",
  incident: "incident",
  client: "client",
  transporter: "transporter",
  product: "product",
  terminal: "terminal",
}

function stripSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj }
  delete result.passwordHash
  // Redact PII in string values
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      result[key] = redactPII(value)
    }
  }
  return result
}

export const getEntityTool: ChatToolFn = async (params, ctx) => {
  const entityType = params.entity_type as string
  const entityId = params.id as string

  const modelName = ENTITY_MODELS[entityType]
  if (!modelName) {
    return { data: { error: `Unknown entity type: ${entityType}` } }
  }

  // Permission checks
  if (["booking", "truck_trip"].includes(entityType) && !hasPermission(ctx.user.role, "booking:read")) {
    return { data: { error: "Permission denied" } }
  }
  if (entityType === "incident" && !hasPermission(ctx.user.role, "incident:read")) {
    return { data: { error: "Permission denied" } }
  }

  // RBAC scope for bookings
  if (entityType === "booking") {
    const { where: scope, error } = bookingScopeForUser(ctx.user)
    if (error) return { data: { error: "Permission denied" } }

    const booking = await prisma.booking.findFirst({
      where: { id: entityId, ...scope },
      include: {
        client: { select: { id: true, name: true } },
        transporter: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, category: true } },
        terminal: { select: { id: true, name: true } },
      },
    })
    if (!booking) return { data: { error: "Entity not found" } }
    return {
      data: stripSensitive(booking as unknown as Record<string, unknown>),
      recordIds: [{ type: "booking", id: booking.id }],
    }
  }

  if (entityType === "truck_trip") {
    const { where: scope } = bookingScopeForUser(ctx.user)
    const trip = await prisma.truckTrip.findFirst({
      where: { id: entityId, booking: scope },
      include: {
        booking: { select: { id: true, bookingNo: true, clientId: true } },
      },
    })
    if (!trip) return { data: { error: "Entity not found" } }
    return {
      data: stripSensitive(trip as unknown as Record<string, unknown>),
      recordIds: [{ type: "truck_trip", id: trip.id }],
    }
  }

  if (entityType === "incident") {
    const incident = await prisma.incident.findUnique({
      where: { id: entityId },
      include: {
        terminal: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
      },
    })
    if (!incident) return { data: { error: "Entity not found" } }
    return {
      data: stripSensitive(incident as unknown as Record<string, unknown>),
      recordIds: [{ type: "incident", id: incident.id }],
    }
  }

  // Simple entities: client, transporter, product, terminal
  const model = (prisma as any)[modelName]
  const entity = await model.findUnique({ where: { id: entityId } })
  if (!entity) return { data: { error: "Entity not found" } }
  return {
    data: stripSensitive(entity as Record<string, unknown>),
    recordIds: [{ type: entityType, id: entityId }],
  }
}
