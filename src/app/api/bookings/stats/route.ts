import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const where: any = {}

  // Role-based filtering (same as list endpoint)
  if (user!.role === Role.CLIENT && user!.clientId) {
    where.clientId = user!.clientId
  } else if (user!.role === Role.TRANSPORTER && user!.transporterId) {
    where.transporterId = user!.transporterId
  }

  const [total, grouped] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    }),
  ])

  const byStatus: Record<string, number> = {}
  for (const g of grouped) {
    byStatus[g.status] = g._count.status
  }

  return NextResponse.json({ total, byStatus })
}
