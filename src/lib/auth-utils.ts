import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'
import { Role } from '@prisma/client'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  clientId: string | null
  transporterId: string | null
  terminalId: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as SessionUser
}

export async function requireAuth(...allowedRoles: Role[]) {
  const user = await getSessionUser()
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, error: null }
}
