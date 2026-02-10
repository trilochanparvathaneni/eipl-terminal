import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    if (user!.role === Role.CLIENT && user!.clientId) {
      const inventoryLots = await prisma.inventoryLot.findMany({
        where: { clientId: user!.clientId },
        include: {
          product: true,
        },
      })

      const products = inventoryLots.map((lot) => lot.product)

      return NextResponse.json({ products })
    }

    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ products })
  } catch (err) {
    console.error('Failed to fetch products:', err)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
