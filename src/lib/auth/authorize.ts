import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/rbac"
import { TENANT_HEADER, DEFAULT_TENANT_SLUG } from "@/lib/tenant/types"
import type { Permission } from "./permissions"
import { randomUUID } from "crypto"

// ── Extended role → permission map for new v1 keys ──────────────────────────
// Merges with existing ROLE_PERMISSIONS from rbac.ts at runtime.
const V1_ROLE_PERMISSIONS: Record<string, Role[]> = {
  "appointments.read": [
    Role.CLIENT,
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.TRANSPORTER,
    Role.SURVEYOR,
    Role.HSE_OFFICER,
    Role.AUDITOR,
    Role.SECURITY,
  ],
  "appointments.write": [
    Role.CLIENT,
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
  ],
  "tenant:read": [
    Role.SUPER_ADMIN,
    Role.TERMINAL_ADMIN,
    Role.CLIENT,
    Role.TRANSPORTER,
    Role.SECURITY,
    Role.SURVEYOR,
    Role.HSE_OFFICER,
    Role.AUDITOR,
    Role.TRAFFIC_CONTROLLER,
  ],
  "controller:console": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "controller:assign_bay": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "controller:lock_bay": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "controller:update_eta": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "controller:resequence": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "controller:mark_noshow": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "controller:reclassify": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "changeover:set_ready": [Role.TRAFFIC_CONTROLLER, Role.HSE_OFFICER, Role.SUPER_ADMIN],
  "ai:read": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.AUDITOR],
  "document:upload": [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.TRANSPORTER],
  "document:read": [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR, Role.HSE_OFFICER, Role.TRAFFIC_CONTROLLER],
  "document:verify": [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR],
  "document:reject": [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR],
  "compliance:evaluate": [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.HSE_OFFICER],
  "compliance:read": [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR, Role.HSE_OFFICER, Role.TRAFFIC_CONTROLLER],
  "custody:transition": [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SECURITY, Role.HSE_OFFICER, Role.TRAFFIC_CONTROLLER],
  "evidence:generate": [Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR],
  "evidence:read": [Role.CLIENT, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN, Role.SURVEYOR, Role.AUDITOR],
  "controller:assign_arm": [Role.TRAFFIC_CONTROLLER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
  "chat:use": [Role.SUPER_ADMIN, Role.TERMINAL_ADMIN, Role.CLIENT, Role.TRANSPORTER, Role.SECURITY, Role.SURVEYOR, Role.HSE_OFFICER, Role.AUDITOR, Role.TRAFFIC_CONTROLLER],
  "form:submit": [Role.CLIENT, Role.TRANSPORTER, Role.TERMINAL_ADMIN, Role.SUPER_ADMIN],
}

function checkPermission(role: Role, permission: string): boolean {
  // Check legacy map first
  if (ROLE_PERMISSIONS[permission]) {
    return hasPermission(role, permission)
  }
  // Then check v1 map
  const allowed = V1_ROLE_PERMISSIONS[permission]
  if (!allowed) return false
  return allowed.includes(role)
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthorizedUser {
  id: string
  name: string
  email: string
  role: Role
  clientId: string | null
  transporterId: string | null
  terminalId: string | null
}

export interface AuthContext {
  user: AuthorizedUser
  tenantSlug: string
  requestId: string
}

interface AuthorizeParams {
  permission: Permission
  headers: Headers
}

interface AuthorizeSuccess {
  ctx: AuthContext
  error: null
}

interface AuthorizeFailure {
  ctx: null
  error: NextResponse
}

// ── Typed error response helper ─────────────────────────────────────────────

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string
): NextResponse {
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status }
  )
}

// ── Main authorize function ─────────────────────────────────────────────────

/**
 * Server-side authorization gate.
 *
 * Resolves the authenticated user (via NextAuth session) and the tenant
 * context (via x-tenant header injected by middleware), then checks
 * whether the user's role grants the requested permission.
 *
 * Returns either `{ ctx, error: null }` or `{ ctx: null, error: NextResponse }`.
 */
export async function authorize(
  params: AuthorizeParams
): Promise<AuthorizeSuccess | AuthorizeFailure> {
  const requestId = randomUUID()

  // 1. Authentication
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return {
      ctx: null,
      error: errorResponse(401, "UNAUTHENTICATED", "Authentication required.", requestId),
    }
  }

  const user = session.user as AuthorizedUser

  // 2. Tenant context
  const tenantSlug = params.headers.get(TENANT_HEADER) ?? DEFAULT_TENANT_SLUG

  // 3. Permission check
  if (!checkPermission(user.role, params.permission)) {
    return {
      ctx: null,
      error: errorResponse(
        403,
        "FORBIDDEN",
        `Missing permission: ${params.permission}`,
        requestId
      ),
    }
  }

  return {
    ctx: { user, tenantSlug, requestId },
    error: null,
  }
}

/**
 * Convenience: get list of all permissions a role has.
 */
export function permissionsForRole(role: Role): string[] {
  const perms: string[] = []
  for (const [perm, roles] of Object.entries(ROLE_PERMISSIONS)) {
    if (roles.includes(role)) perms.push(perm)
  }
  for (const [perm, roles] of Object.entries(V1_ROLE_PERMISSIONS)) {
    if (roles.includes(role)) perms.push(perm)
  }
  return perms
}
