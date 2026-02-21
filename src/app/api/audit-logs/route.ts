import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(Role.AUDITOR, Role.SUPER_ADMIN)
  if (error) return error

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const entityType = url.searchParams.get('entityType')
    const actorUserId = url.searchParams.get('actorUserId')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    const where: any = {}
    if (user!.role !== Role.SUPER_ADMIN) {
      const terminalAccessError = enforceTerminalAccess(user!, user!.terminalId)
      if (terminalAccessError) return terminalAccessError
      // Filter on the immutable terminalId stamped at write time — not the actor's current terminal
      where.terminalId = user!.terminalId
    }

    if (entityType) where.entityType = entityType
    if (actorUserId) where.actorUserId = actorUserId
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, page, limit })
  } catch (err) {
    console.error('Failed to fetch audit logs:', err)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
