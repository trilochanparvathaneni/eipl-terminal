import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.SURVEYOR,
    Role.AUDITOR
  )
  if (error) return error

  try {
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    if (user!.role !== Role.SUPER_ADMIN) {
      const terminalAccessError = enforceTerminalAccess(user!, user!.terminalId)
      if (terminalAccessError) return terminalAccessError
    }

    const allocationWhere: any = {}
    if (dateFrom || dateTo) {
      allocationWhere.allocatedAt = {}
      if (dateFrom) allocationWhere.allocatedAt.gte = new Date(dateFrom)
      if (dateTo) allocationWhere.allocatedAt.lte = new Date(dateTo)
    }

    const bays = await prisma.bay.findMany({
      where: user!.role === Role.SUPER_ADMIN
        ? {}
        : { gantry: { terminalId: user!.terminalId! } },
      include: {
        gantry: {
          include: {
            terminal: { select: { id: true, name: true } },
          },
        },
        productBayMaps: {
          where: { isActive: true },
          include: {
            product: { select: { id: true, name: true, category: true } },
          },
        },
        bayAllocations: {
          where: allocationWhere,
        },
      },
    })

    const utilization = bays.map((bay) => ({
      bayId: bay.id,
      bayName: bay.name,
      uniqueCode: bay.uniqueCode,
      gantry: {
        id: bay.gantry.id,
        name: bay.gantry.name,
        terminal: bay.gantry.terminal,
      },
      products: bay.productBayMaps.map((m) => m.product),
      allocationCount: bay.bayAllocations.length,
    }))

    return NextResponse.json({ utilization })
  } catch (err) {
    console.error('Failed to fetch bay utilization report:', err)
    return NextResponse.json(
      { error: 'Failed to fetch bay utilization report' },
      { status: 500 }
    )
  }
}
