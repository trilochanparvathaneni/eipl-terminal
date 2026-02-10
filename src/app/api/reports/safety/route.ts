import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

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

    const dateFilter: any = {}
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {}
      if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom)
      if (dateTo) dateFilter.createdAt.lte = new Date(dateTo)
    }

    const [
      checklistsByStatus,
      stopWorkOrdersCount,
      activeStopWorkOrders,
      incidentsBySeverity,
    ] = await Promise.all([
      prisma.safetyChecklist.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { status: true },
      }),
      prisma.stopWorkOrder.count({
        where: dateFilter,
      }),
      prisma.stopWorkOrder.count({
        where: { ...dateFilter, active: true },
      }),
      prisma.incident.groupBy({
        by: ['severity'],
        where: dateFilter,
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
