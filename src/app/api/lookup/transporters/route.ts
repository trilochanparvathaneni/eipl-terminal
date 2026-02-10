import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const transporters = await prisma.transporter.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ transporters })
  } catch (err) {
    console.error('Failed to fetch transporters:', err)
    return NextResponse.json(
      { error: 'Failed to fetch transporters' },
      { status: 500 }
    )
  }
}
