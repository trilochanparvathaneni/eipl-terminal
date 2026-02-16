import { Role } from "@prisma/client"
import { NextResponse } from "next/server"
import type { SessionUser } from "@/lib/auth-utils"

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === Role.SUPER_ADMIN
}

export function bookingScopeForUser(
  user: SessionUser
): { where: Record<string, unknown>; error: NextResponse | null } {
  if (user.role === Role.CLIENT) {
    if (!user.clientId) {
      return {
        where: {},
        error: NextResponse.json({ error: "Client association missing" }, { status: 400 }),
      }
    }
    return { where: { clientId: user.clientId }, error: null }
  }

  if (user.role === Role.TRANSPORTER) {
    if (!user.transporterId) {
      return {
        where: {},
        error: NextResponse.json({ error: "Transporter association missing" }, { status: 400 }),
      }
    }
    return { where: { transporterId: user.transporterId }, error: null }
  }

  if (isSuperAdmin(user)) {
    return { where: {}, error: null }
  }

  if (!user.terminalId) {
    return {
      where: {},
      error: NextResponse.json({ error: "Terminal association missing" }, { status: 400 }),
    }
  }

  return { where: { terminalId: user.terminalId }, error: null }
}

export function enforceTerminalAccess(
  user: SessionUser,
  targetTerminalId: string | null | undefined
): NextResponse | null {
  if (isSuperAdmin(user)) return null
  if (!user.terminalId) {
    return NextResponse.json({ error: "Terminal association missing" }, { status: 400 })
  }
  if (targetTerminalId && targetTerminalId !== user.terminalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}
