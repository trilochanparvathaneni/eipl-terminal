import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/rbac"
import { bookingScopeForUser } from "@/lib/auth/scope"
import type { ChatToolFn } from "./types"

interface ActivityItem {
  type: "audit_log" | "gate_event" | "incident"
  timestamp: Date
  summary: string
  entityType?: string
  entityId?: string
}

export const getRecentActivityTool: ChatToolFn = async (params, ctx) => {
  const limit = Math.min(Number(params.limit) || 20, 50)
  const dateRange = params.date_range as { from?: string; to?: string } | undefined
  const filters = params.filters as { entity_type?: string; action?: string } | undefined

  const dateFilter: Record<string, Date> = {}
  if (dateRange?.from) dateFilter.gte = new Date(dateRange.from)
  if (dateRange?.to) dateFilter.lte = new Date(dateRange.to)

  const activities: ActivityItem[] = []

  // Audit logs (only for users with audit:read)
  if (hasPermission(ctx.user.role, "audit:read")) {
    const auditWhere: Record<string, unknown> = {}
    if (Object.keys(dateFilter).length > 0) auditWhere.createdAt = dateFilter
    if (filters?.entity_type) auditWhere.entityType = filters.entity_type
    if (filters?.action) auditWhere.action = filters.action

    const logs = await prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { name: true } } },
    })

    for (const log of logs) {
      activities.push({
        type: "audit_log",
        timestamp: log.createdAt,
        summary: `${log.actor.name} performed ${log.action} on ${log.entityType} ${log.entityId}`,
        entityType: log.entityType,
        entityId: log.entityId,
      })
    }
  }

  // Gate events
  if (hasPermission(ctx.user.role, "gate:read")) {
    const { where: scope } = bookingScopeForUser(ctx.user)
    const gateWhere: Record<string, unknown> = { truckTrip: { booking: scope } }
    if (Object.keys(dateFilter).length > 0) gateWhere.timestamp = dateFilter

    const events = await prisma.gateEvent.findMany({
      where: gateWhere,
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        truckTrip: { select: { truckNumber: true, booking: { select: { bookingNo: true } } } },
        security: { select: { name: true } },
      },
    })

    for (const event of events) {
      activities.push({
        type: "gate_event",
        timestamp: event.timestamp,
        summary: `${event.type} - Truck ${event.truckTrip.truckNumber} (${event.truckTrip.booking.bookingNo}) by ${event.security.name}`,
        entityType: "gate_event",
        entityId: event.id,
      })
    }
  }

  // Incidents
  if (hasPermission(ctx.user.role, "incident:read")) {
    const incidentWhere: Record<string, unknown> = {}
    if (Object.keys(dateFilter).length > 0) incidentWhere.createdAt = dateFilter

    const incidents = await prisma.incident.findMany({
      where: incidentWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        terminal: { select: { name: true } },
        reportedBy: { select: { name: true } },
      },
    })

    for (const incident of incidents) {
      activities.push({
        type: "incident",
        timestamp: incident.createdAt,
        summary: `[${incident.severity}] ${incident.description} at ${incident.terminal.name} (${incident.status})`,
        entityType: "incident",
        entityId: incident.id,
      })
    }
  }

  // Sort by timestamp descending, take limit
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  const trimmed = activities.slice(0, limit)

  return {
    data: { count: trimmed.length, activities: trimmed },
    recordIds: trimmed
      .filter((a) => a.entityId)
      .map((a) => ({ type: a.entityType!, id: a.entityId! })),
  }
}
