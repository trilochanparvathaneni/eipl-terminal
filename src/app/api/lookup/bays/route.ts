import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const url = new URL(req.url)
    const productId = url.searchParams.get('productId')
    const terminalId = url.searchParams.get('terminalId')

    const where: any = {}
    if (user!.role !== Role.SUPER_ADMIN) {
      const terminalAccessError = enforceTerminalAccess(user!, terminalId ?? user!.terminalId)
      if (terminalAccessError) return terminalAccessError
      where.gantry = { terminalId: user!.terminalId! }
    } else if (terminalId) {
      where.gantry = { terminalId }
    }

    if (productId) {
      where.productBayMaps = {
        some: {
          productId,
          isActive: true,
        },
      }
    }

    const bays = await prisma.bay.findMany({
      where,
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
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ bays })
  } catch (err) {
    console.error('Failed to fetch bays:', err)
    return NextResponse.json(
      { error: 'Failed to fetch bays' },
      { status: 500 }
    )
  }
}
