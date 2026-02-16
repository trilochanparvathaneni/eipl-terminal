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

    const transporters = await prisma.transporter.findMany({
      where: user!.role === Role.SUPER_ADMIN
        ? { isActive: true }
        : {
            isActive: true,
            users: { some: { terminalId: user!.terminalId! } },
          },
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
