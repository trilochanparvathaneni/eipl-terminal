import { Role } from "@prisma/client"
import type { SessionUser } from "@/lib/auth-utils"
import { hasPermission, isClient, type AppRole, type PermissionKey } from "@/lib/security/permissions"

type SecureWhereOptions = {
  clientIdField?: string
  transporterIdField?: string
}

export function secureWhere(
  user: SessionUser,
  baseWhere: Record<string, unknown> = {},
  options: SecureWhereOptions = {}
): Record<string, unknown> {
  const role = user.role as AppRole
  const where = { ...baseWhere }
  const clientIdField = options.clientIdField ?? "clientId"
  const transporterIdField = options.transporterIdField ?? "transporterId"

  if (role === Role.CLIENT) {
    if (!user.clientId) {
      where.id = "__never__"
      return where
    }
    where[clientIdField] = user.clientId
  }

  if (role === Role.TRANSPORTER) {
    if (!user.transporterId) {
      where.id = "__never__"
      return where
    }
    where[transporterIdField] = user.transporterId
  }

  return where
}

const SELECT_PERMISSION_MAP: Partial<Record<string, PermissionKey>> = {
  incidentCount: "canViewHseIncidents",
  incidents: "canViewHseIncidents",
  bayStatus: "canViewBayStatus",
  queueTotal: "canViewQueueTotals",
  inventory: "canViewInventory",
  inventoryPercent: "canViewInventory",
  complianceFlags: "canViewComplianceFlags",
  equipmentHealth: "canViewBayStatus",
}

export function secureSelect(
  role: AppRole,
  select: Record<string, unknown>
): Record<string, unknown> {
  if (!isClient(role)) return select

  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(select)) {
    const mapped = SELECT_PERMISSION_MAP[key]
    if (!mapped || hasPermission(role, mapped)) {
      filtered[key] = value
    }
  }
  return filtered
}
