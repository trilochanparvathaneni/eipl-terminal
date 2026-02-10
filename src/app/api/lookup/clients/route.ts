import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(Role.TERMINAL_ADMIN, Role.SUPER_ADMIN)
  if (error) return error

  try {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ clients })
  } catch (err) {
    console.error('Failed to fetch clients:', err)
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}
