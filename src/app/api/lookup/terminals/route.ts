import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const terminals = await prisma.terminal.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ terminals })
  } catch (err) {
    console.error('Failed to fetch terminals:', err)
    return NextResponse.json(
      { error: 'Failed to fetch terminals' },
      { status: 500 }
    )
  }
}
