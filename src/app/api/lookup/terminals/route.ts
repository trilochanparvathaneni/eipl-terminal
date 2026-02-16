import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    if (user!.role !== Role.SUPER_ADMIN) {
      const terminalAccessError = enforceTerminalAccess(user!, user!.terminalId)
      if (terminalAccessError) return terminalAccessError
    }

    const terminals = await prisma.terminal.findMany({
      where: user!.role === Role.SUPER_ADMIN ? {} : { id: user!.terminalId! },
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
