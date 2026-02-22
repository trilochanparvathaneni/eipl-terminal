import { Role } from "@prisma/client"
import type { Session } from "next-auth"
import type { SessionUser } from "@/lib/auth-utils"

export type AppRole =
  | Role
  | "OPS"
  | "ADMIN"
  | "MAINTENANCE"
  | "FINANCE"

export type PermissionKey =
  | "canViewTerminalWideMetrics"
  | "canViewQueueTotals"
  | "canViewBayStatus"
  | "canViewHseIncidents"
  | "canViewIncidentDetails"
  | "canViewInventory"
  | "canViewComplianceFlags"
  | "canViewAuditLogs"
  | "canUseInternalActions"
  | "canViewOnlyOwnCompanyData"

const ALL_PERMISSIONS: PermissionKey[] = [
  "canViewTerminalWideMetrics",
  "canViewQueueTotals",
  "canViewBayStatus",
  "canViewHseIncidents",
  "canViewIncidentDetails",
  "canViewInventory",
  "canViewComplianceFlags",
  "canViewAuditLogs",
  "canUseInternalActions",
  "canViewOnlyOwnCompanyData",
]

const NONE: ReadonlySet<PermissionKey> = new Set<PermissionKey>()
const INTERNAL: ReadonlySet<PermissionKey> = new Set(
  ALL_PERMISSIONS.filter((permission) => permission !== "canViewOnlyOwnCompanyData")
)

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<PermissionKey>> = {
  SUPER_ADMIN: INTERNAL,
  TERMINAL_ADMIN: INTERNAL,
  HSE_OFFICER: new Set<PermissionKey>([
    "canViewTerminalWideMetrics",
    "canViewQueueTotals",
    "canViewBayStatus",
    "canViewHseIncidents",
    "canViewIncidentDetails",
    "canViewComplianceFlags",
    "canUseInternalActions",
  ]),
  SECURITY: new Set<PermissionKey>([
    "canViewTerminalWideMetrics",
    "canViewQueueTotals",
    "canViewBayStatus",
    "canViewHseIncidents",
    "canViewIncidentDetails",
    "canUseInternalActions",
  ]),
  SURVEYOR: new Set<PermissionKey>([
    "canViewTerminalWideMetrics",
    "canViewHseIncidents",
    "canViewIncidentDetails",
    "canUseInternalActions",
  ]),
  AUDITOR: new Set<PermissionKey>([
    "canViewTerminalWideMetrics",
    "canViewHseIncidents",
    "canViewIncidentDetails",
    "canViewComplianceFlags",
    "canViewAuditLogs",
    "canUseInternalActions",
  ]),
  TRAFFIC_CONTROLLER: new Set<PermissionKey>([
    "canViewTerminalWideMetrics",
    "canViewQueueTotals",
    "canViewBayStatus",
    "canViewHseIncidents",
    "canViewIncidentDetails",
    "canUseInternalActions",
  ]),
  TRANSPORTER: new Set<PermissionKey>(["canViewOnlyOwnCompanyData"]),
  CLIENT: new Set<PermissionKey>(["canViewOnlyOwnCompanyData"]),
  OPS: INTERNAL,
  ADMIN: INTERNAL,
  MAINTENANCE: new Set<PermissionKey>([
    "canViewTerminalWideMetrics",
    "canViewQueueTotals",
    "canViewBayStatus",
    "canViewIncidentDetails",
    "canUseInternalActions",
  ]),
  FINANCE: NONE,
}

export function getRoleFromSession(session: Session | SessionUser | null | undefined): AppRole {
  const role = (session as any)?.user?.role ?? (session as any)?.role
  if (!role) return Role.CLIENT
  if (Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) {
    return role as AppRole
  }
  return Role.CLIENT
}

export function isClient(role: AppRole): boolean {
  return role === Role.CLIENT || role === Role.TRANSPORTER
}

export function hasPermission(role: AppRole, permission: PermissionKey): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  return permissions.has(permission)
}

export function assertPermission(role: AppRole, permission: PermissionKey) {
  if (!hasPermission(role, permission)) {
    const err = new Error("Forbidden")
    ;(err as any).status = 403
    throw err
  }
}
