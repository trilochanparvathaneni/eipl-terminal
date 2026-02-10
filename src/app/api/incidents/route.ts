import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { incidentSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, IncidentSeverity, IncidentStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const url = new URL(req.url)
  const terminalId = url.searchParams.get('terminalId')
  const status = url.searchParams.get('status')
  const severity = url.searchParams.get('severity')
  const bookingId = url.searchParams.get('bookingId')
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  const where: any = {}

  if (terminalId) where.terminalId = terminalId
  if (status) where.status = status as IncidentStatus
  if (severity) where.severity = severity as IncidentSeverity
  if (bookingId) where.bookingId = bookingId

  try {
    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        include: {
          terminal: true,
          booking: {
            include: {
              client: true,
              product: true,
            },
          },
          reportedBy: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.incident.count({ where }),
    ])

    return NextResponse.json({ incidents, total, page, limit })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(
    Role.HSE_OFFICER,
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.SECURITY
  )
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = incidentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  try {
    // Verify terminal exists
    const terminal = await prisma.terminal.findUnique({
      where: { id: data.terminalId },
    })

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal not found' }, { status: 404 })
    }

    // If bookingId provided, verify it exists
    if (data.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: data.bookingId },
      })

      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
    }

    const incident = await prisma.incident.create({
      data: {
        terminalId: data.terminalId,
        bookingId: data.bookingId || null,
        reportedByUserId: user!.id,
        severity: data.severity as IncidentSeverity,
        description: data.description,
        status: IncidentStatus.OPEN,
      },
      include: {
        terminal: true,
        booking: {
          include: {
            client: true,
            product: true,
          },
        },
        reportedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    await createAuditLog({
      actorUserId: user!.id,
      entityType: 'Incident',
      entityId: incident.id,
      action: 'CREATE',
      after: incident,
    })

    // Notify HSE officers and terminal admins
    await notifyByRole({
      roles: ['HSE_OFFICER', 'TERMINAL_ADMIN', 'SUPER_ADMIN'],
      terminalId: data.terminalId,
      subject: `Incident Reported [${data.severity}] - ${terminal.name}`,
      body: `A ${data.severity} severity incident has been reported at ${terminal.name}: ${data.description}`,
    })

    // Notify security at the terminal
    await notifyByRole({
      roles: ['SECURITY'],
      terminalId: data.terminalId,
      subject: `Incident Alert [${data.severity}] - ${terminal.name}`,
      body: `A ${data.severity} severity incident has been reported: ${data.description}`,
    })

    return NextResponse.json(incident, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create incident' },
      { status: 500 }
    )
  }
}
