import { Role } from "@prisma/client"
import type { Session } from "next-auth"
import type { SessionUser } from "@/lib/auth-utils"
import { getRoleFromSession, type AppRole } from "@/lib/security/permissions"

const INTERNAL_ROLES = new Set<AppRole>([
  Role.SUPER_ADMIN,
  Role.TERMINAL_ADMIN,
  Role.HSE_OFFICER,
  Role.SECURITY,
  Role.SURVEYOR,
  Role.AUDITOR,
  Role.TRAFFIC_CONTROLLER,
  "OPS",
  "ADMIN",
  "MAINTENANCE",
])

export function getUserRole(session: Session | SessionUser | null | undefined): AppRole {
  return getRoleFromSession(session)
}

export function isInternalRole(role: AppRole): boolean {
  return INTERNAL_ROLES.has(role)
}

export function isClientRole(role: AppRole): boolean {
  return role === Role.CLIENT || role === Role.TRANSPORTER
}

export function enforceRole(role: AppRole, allowedRoles: AppRole[]) {
  if (!allowedRoles.includes(role)) {
    const err = new Error("Forbidden")
    ;(err as any).status = 403
    throw err
  }
}
