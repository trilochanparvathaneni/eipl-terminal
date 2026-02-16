import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.HSE_OFFICER,
    Role.AUDITOR
  )
  if (error) return error

  try {
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const checklistStatus = url.searchParams.get('checklistStatus')
    const incidentSeverity = url.searchParams.get('incidentSeverity')
    const incidentStatus = url.searchParams.get('incidentStatus')
    const stopWorkActiveOnly = url.searchParams.get('stopWorkActiveOnly') === 'true'
    if (user!.role !== Role.SUPER_ADMIN) {
      const terminalAccessError = enforceTerminalAccess(user!, user!.terminalId)
      if (terminalAccessError) return terminalAccessError
    }

    const dateFilter: any = {}
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {}
      if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom)
      if (dateTo) dateFilter.createdAt.lte = new Date(dateTo)
    }
    const checklistWhere: any = { ...dateFilter }
    const stopWorkWhere: any = { ...dateFilter }
    const incidentWhere: any = { ...dateFilter }
    if (checklistStatus) checklistWhere.status = checklistStatus
    if (incidentSeverity) incidentWhere.severity = incidentSeverity
    if (incidentStatus) incidentWhere.status = incidentStatus
    if (stopWorkActiveOnly) stopWorkWhere.active = true
    if (user!.role !== Role.SUPER_ADMIN) {
      checklistWhere.booking = { terminalId: user!.terminalId! }
      stopWorkWhere.booking = { terminalId: user!.terminalId! }
      incidentWhere.terminalId = user!.terminalId!
    }

    const [
      checklistsByStatus,
      stopWorkOrdersCount,
      activeStopWorkOrders,
      incidentsBySeverity,
    ] = await Promise.all([
      prisma.safetyChecklist.groupBy({
        by: ['status'],
        where: checklistWhere,
        _count: { status: true },
      }),
      prisma.stopWorkOrder.count({
        where: stopWorkWhere,
      }),
      prisma.stopWorkOrder.count({
        where: { ...stopWorkWhere, active: true },
      }),
      prisma.incident.groupBy({
        by: ['severity'],
        where: incidentWhere,
        _count: { severity: true },
      }),
    ])

    const checklistCounts: Record<string, number> = {}
    for (const item of checklistsByStatus) {
      checklistCounts[item.status] = item._count.status
    }

    const incidentCounts: Record<string, number> = {}
    for (const item of incidentsBySeverity) {
      incidentCounts[item.severity] = item._count.severity
    }

    return NextResponse.json({
      checklists: checklistCounts,
      stopWorkOrders: {
        total: stopWorkOrdersCount,
        active: activeStopWorkOrders,
      },
      incidents: incidentCounts,
    })
  } catch (err) {
    console.error('Failed to fetch safety report:', err)
    return NextResponse.json(
      { error: 'Failed to fetch safety report' },
      { status: 500 }
    )
  }
}
