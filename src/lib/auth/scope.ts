import { Role } from "@prisma/client"
import { NextResponse } from "next/server"
import type { SessionUser } from "@/lib/auth-utils"
import { TENANT_HEADER } from "@/lib/tenant/types"

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

/**
 * Guard that verifies the request's tenant slug (from middleware) is in the
 * permitted set for this operation.
 *
 * Internal roles (TERMINAL_ADMIN, etc.) are scoped to the "eipl" tenant.
 * External roles (CLIENT, TRANSPORTER) are scoped to their org's slug.
 *
 * Returns a 403 NextResponse if there is a mismatch, or null if OK.
 *
 * Usage:
 *   const tenantError = requireTenantMatch(user, requestHeaders)
 *   if (tenantError) return tenantError
 */
export function requireTenantMatch(
  user: SessionUser,
  headers: Headers
): NextResponse | null {
  const requestTenant = headers.get(TENANT_HEADER)?.toLowerCase()
  if (!requestTenant) return null // middleware not yet enforcing — allow

  // SUPER_ADMIN is permitted across all tenants
  if (isSuperAdmin(user)) return null

  // Internal roles must be on the "eipl" (or configured default) tenant
  const INTERNAL_ROLES = new Set<Role>([
    Role.TERMINAL_ADMIN,
    Role.SECURITY,
    Role.SURVEYOR,
    Role.HSE_OFFICER,
    Role.AUDITOR,
    Role.TRAFFIC_CONTROLLER,
  ])

  if (INTERNAL_ROLES.has(user.role as Role)) {
    if (requestTenant !== "eipl" && requestTenant !== "public") {
      return NextResponse.json(
        { error: "Tenant mismatch: internal users must access the eipl tenant." },
        { status: 403 }
      )
    }
    return null
  }

  // CLIENT: request tenant must match their clientId-derived slug OR "eipl"
  // TRANSPORTER: same pattern
  // For now, allow if the request is on the default tenant (single-tenant deployment).
  // In a true SaaS build, match requestTenant against the user's org slug from DB.
  return null
}
