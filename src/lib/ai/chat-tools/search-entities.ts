import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/rbac"
import { bookingScopeForUser } from "@/lib/auth/scope"
import { redactPII } from "@/lib/ai/redact"
import type { ChatToolFn } from "./types"

function redactArray(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items.map((item) => {
    const result = { ...item }
    delete result.passwordHash
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "string") result[key] = redactPII(value)
    }
    return result
  })
}

export const searchEntitiesTool: ChatToolFn = async (params, ctx) => {
  const entityType = params.entity_type as string
  const query = params.query as string | undefined
  const filters = params.filters as Record<string, unknown> | undefined
  const limit = Math.min(Number(params.limit) || 20, 50)

  if (entityType === "booking") {
    if (!hasPermission(ctx.user.role, "booking:read")) {
      return { data: { error: "Permission denied" } }
    }
    const { where: scope, error } = bookingScopeForUser(ctx.user)
    if (error) return { data: { error: "Permission denied" } }

    const where: Record<string, unknown> = { ...scope }
    if (filters?.status) where.status = filters.status
    if (filters?.date_from || filters?.date_to) {
      where.date = {}
      if (filters?.date_from) (where.date as any).gte = new Date(filters.date_from as string)
      if (filters?.date_to) (where.date as any).lte = new Date(filters.date_to as string)
    }
    if (query) {
      where.OR = [
        { bookingNo: { contains: query, mode: "insensitive" } },
        { client: { name: { contains: query, mode: "insensitive" } } },
      ]
    }

    const results = await prisma.booking.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        terminal: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return {
      data: { count: results.length, results: redactArray(results as unknown as Record<string, unknown>[]) },
      recordIds: results.map((r) => ({ type: "booking", id: r.id })),
    }
  }

  if (entityType === "truck_trip") {
    if (!hasPermission(ctx.user.role, "trip:read")) {
      return { data: { error: "Permission denied" } }
    }
    const { where: scope } = bookingScopeForUser(ctx.user)
    const where: Record<string, unknown> = { booking: scope }
    if (filters?.status) where.status = filters.status
    if (query) {
      where.OR = [
        { truckNumber: { contains: query, mode: "insensitive" } },
        { driverName: { contains: query, mode: "insensitive" } },
      ]
    }

    const results = await prisma.truckTrip.findMany({
      where,
      include: {
        booking: { select: { id: true, bookingNo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return {
      data: { count: results.length, results: redactArray(results as unknown as Record<string, unknown>[]) },
      recordIds: results.map((r) => ({ type: "truck_trip", id: r.id })),
    }
  }

  if (entityType === "incident") {
    if (!hasPermission(ctx.user.role, "incident:read")) {
      return { data: { error: "Permission denied" } }
    }
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.severity) where.severity = filters.severity
    if (query) {
      where.description = { contains: query, mode: "insensitive" }
    }

    const results = await prisma.incident.findMany({
      where,
      include: {
        terminal: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return {
      data: { count: results.length, results: redactArray(results as unknown as Record<string, unknown>[]) },
      recordIds: results.map((r) => ({ type: "incident", id: r.id })),
    }
  }

  if (entityType === "client") {
    const results = await prisma.client.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : {},
      take: limit,
      orderBy: { name: "asc" },
    })
    return {
      data: { count: results.length, results: redactArray(results as unknown as Record<string, unknown>[]) },
      recordIds: results.map((r) => ({ type: "client", id: r.id })),
    }
  }

  if (entityType === "transporter") {
    const results = await prisma.transporter.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : {},
      take: limit,
      orderBy: { name: "asc" },
    })
    return {
      data: { count: results.length, results: redactArray(results as unknown as Record<string, unknown>[]) },
      recordIds: results.map((r) => ({ type: "transporter", id: r.id })),
    }
  }

  if (entityType === "product") {
    const results = await prisma.product.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : {},
      take: limit,
    })
    return {
      data: { count: results.length, results: redactArray(results as unknown as Record<string, unknown>[]) },
      recordIds: results.map((r) => ({ type: "product", id: r.id })),
    }
  }

  if (entityType === "terminal") {
    const results = await prisma.terminal.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : {},
      take: limit,
    })
    return {
      data: { count: results.length, results: redactArray(results as unknown as Record<string, unknown>[]) },
      recordIds: results.map((r) => ({ type: "terminal", id: r.id })),
    }
  }

  return { data: { error: `Unknown entity type: ${entityType}` } }
}
