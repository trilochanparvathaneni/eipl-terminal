import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { bookingScopeForUser } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const scoped = bookingScopeForUser(user!)
  if (scoped.error) return scoped.error
  const where: any = { ...scoped.where }

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
