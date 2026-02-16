import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { createAuditLog } from '@/lib/audit'
import { Role, IncidentStatus } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth(
    Role.HSE_OFFICER,
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN
  )
  if (error) return error

  const { id } = params

  try {
    // Find the incident
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        terminal: true,
        booking: true,
      },
    })

    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }

    const terminalAccessError = enforceTerminalAccess(user!, incident.terminalId)
    if (terminalAccessError) return terminalAccessError

    if (incident.status === IncidentStatus.CLOSED) {
      return NextResponse.json(
        { error: 'Incident is already closed' },
        { status: 400 }
      )
    }

    const now = new Date()

    const closed = await prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.CLOSED,
        closedAt: now,
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
      entityId: id,
      action: 'CLOSE',
      before: { status: IncidentStatus.OPEN },
      after: { status: IncidentStatus.CLOSED, closedAt: now },
    })

    return NextResponse.json(closed)
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to close incident' },
      { status: 500 }
    )
  }
}
