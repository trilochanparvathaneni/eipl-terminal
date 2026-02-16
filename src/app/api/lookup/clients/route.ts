import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { enforceTerminalAccess } from '@/lib/auth/scope'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(Role.TERMINAL_ADMIN, Role.SUPER_ADMIN)
  if (error) return error

  try {
    if (user!.role !== Role.SUPER_ADMIN) {
      const terminalAccessError = enforceTerminalAccess(user!, user!.terminalId)
      if (terminalAccessError) return terminalAccessError
    }

    const clients = await prisma.client.findMany({
      where: user!.role === Role.SUPER_ADMIN
        ? { isActive: true }
        : { isActive: true, bookings: { some: { terminalId: user!.terminalId! } } },
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
