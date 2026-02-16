import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { enqueueEvent } from "@/lib/outbox/publisher"
import { Role } from "@prisma/client"

function normalizeToTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

async function resolveTenantTerminalIds(tenantSlug: string): Promise<string[]> {
  const terminals = await prisma.terminal.findMany({
    select: { id: true, name: true },
  })
  return terminals
    .filter((terminal) => normalizeToTokens(terminal.name).includes(tenantSlug.toLowerCase()))
    .map((terminal) => terminal.id)
}

/**
 * GET /api/v1/appointments
 *
 * List bookings (appointments) scoped to the current tenant.
 * Tenant isolation: filters by terminalId linked to the tenant.
 */
export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.APPOINTMENTS_READ,
    headers: request.headers,
  })
  if (error) return error

  try {
    const terminalIds = await resolveTenantTerminalIds(ctx.tenantSlug)
    if (terminalIds.length === 0) {
      return NextResponse.json({
        requestId: ctx.requestId,
        tenantSlug: ctx.tenantSlug,
        count: 0,
        appointments: [],
      })
    }

    const where: any = { terminalId: { in: terminalIds } }
    if (ctx.user.role === Role.CLIENT && ctx.user.clientId) {
      where.clientId = ctx.user.clientId
    }
    if (ctx.user.role === Role.TRANSPORTER && ctx.user.transporterId) {
      where.transporterId = ctx.user.transporterId
    }

    const bookings = await prisma.booking.findMany({
      where,
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingNo: true,
        date: true,
        status: true,
        quantityRequested: true,
        client: { select: { name: true } },
        product: { select: { name: true } },
        terminal: { select: { name: true } },
        createdAt: true,
      },
    })

    return NextResponse.json({
      requestId: ctx.requestId,
      tenantSlug: ctx.tenantSlug,
      count: bookings.length,
      appointments: bookings,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to fetch appointments.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/appointments
 *
 * Create a new booking (appointment) for the current tenant.
 * Demonstrates: authorize → write → outbox event.
 */
export async function POST(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.APPOINTMENTS_WRITE,
    headers: request.headers,
  })
  if (error) return error

  try {
    const body = await request.json()
    const { terminalId, clientId, productId, quantityRequested, date } = body

    if (!terminalId || !clientId || !productId || !quantityRequested || !date) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message:
              "Missing required fields: terminalId, clientId, productId, quantityRequested, date",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    const bookingNo = `BK-${Date.now().toString(36).toUpperCase()}`
    const terminalIds = await resolveTenantTerminalIds(ctx.tenantSlug)
    if (!terminalIds.includes(terminalId)) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Terminal does not belong to current tenant.",
            requestId: ctx.requestId,
          },
        },
        { status: 403 }
      )
    }

    if (ctx.user.role === Role.CLIENT && ctx.user.clientId && clientId !== ctx.user.clientId) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Client user can only create appointments for own client account.",
            requestId: ctx.requestId,
          },
        },
        { status: 403 }
      )
    }

    const booking = await prisma.booking.create({
      data: {
        bookingNo,
        terminalId,
        clientId,
        productId,
        quantityRequested: Number(quantityRequested),
        date: new Date(date),
        createdByUserId: ctx.user.id,
        status: "SUBMITTED",
      },
    })

    // Enqueue outbox event for downstream integrations
    await enqueueEvent({
      eventType: "appointment.created",
      aggregateType: "booking",
      aggregateId: booking.id,
      tenantSlug: ctx.tenantSlug,
      payload: {
        bookingNo: booking.bookingNo,
        terminalId: booking.terminalId,
        clientId: booking.clientId,
        productId: booking.productId,
        quantityRequested: booking.quantityRequested,
        date: booking.date,
        createdBy: ctx.user.id,
      },
    })

    return NextResponse.json(
      {
        requestId: ctx.requestId,
        appointment: {
          id: booking.id,
          bookingNo: booking.bookingNo,
          status: booking.status,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to create appointment.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
