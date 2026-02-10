import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { enqueueEvent } from "@/lib/outbox/publisher"

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
    // Tenant isolation: only return bookings whose terminal belongs to
    // this tenant.  Until we have a tenantId FK on Terminal, we use the
    // terminal name as a proxy (matches tenant slug convention).
    const bookings = await prisma.booking.findMany({
      where: {
        terminal: {
          name: { contains: ctx.tenantSlug, mode: "insensitive" },
        },
      },
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
