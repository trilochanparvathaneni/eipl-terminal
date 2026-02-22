import { Role } from "@prisma/client"

export type AssistRole = "SUPER_ADMIN" | "OPS" | "HSE" | "SECURITY" | "MAINTENANCE" | "CLIENT"

export type AssistPermissions = {
  canViewInternalBays: boolean
  canViewIncidentCounts: boolean
  canViewInventory: boolean
  canViewEquipmentHealth: boolean
  canViewOnlyOwnBookings: boolean
}

const PERMISSIONS: Record<AssistRole, AssistPermissions> = {
  SUPER_ADMIN: {
    canViewInternalBays: true,
    canViewIncidentCounts: true,
    canViewInventory: true,
    canViewEquipmentHealth: true,
    canViewOnlyOwnBookings: false,
  },
  OPS: {
    canViewInternalBays: true,
    canViewIncidentCounts: true,
    canViewInventory: true,
    canViewEquipmentHealth: true,
    canViewOnlyOwnBookings: false,
  },
  HSE: {
    canViewInternalBays: true,
    canViewIncidentCounts: true,
    canViewInventory: false,
    canViewEquipmentHealth: true,
    canViewOnlyOwnBookings: false,
  },
  SECURITY: {
    canViewInternalBays: true,
    canViewIncidentCounts: true,
    canViewInventory: false,
    canViewEquipmentHealth: false,
    canViewOnlyOwnBookings: false,
  },
  MAINTENANCE: {
    canViewInternalBays: true,
    canViewIncidentCounts: true,
    canViewInventory: false,
    canViewEquipmentHealth: true,
    canViewOnlyOwnBookings: false,
  },
  CLIENT: {
    canViewInternalBays: false,
    canViewIncidentCounts: false,
    canViewInventory: false,
    canViewEquipmentHealth: false,
    canViewOnlyOwnBookings: true,
  },
}

export function toAssistRole(role: Role | string): AssistRole {
  switch (role) {
    case Role.SUPER_ADMIN:
      return "SUPER_ADMIN"
    case Role.HSE_OFFICER:
      return "HSE"
    case Role.SECURITY:
      return "SECURITY"
    case Role.CLIENT:
    case Role.TRANSPORTER:
      return "CLIENT"
    case "MAINTENANCE":
      return "MAINTENANCE"
    case Role.TERMINAL_ADMIN:
    case Role.TRAFFIC_CONTROLLER:
    case Role.SURVEYOR:
    case Role.AUDITOR:
    default:
      return "OPS"
  }
}

export function getAssistPermissions(role: AssistRole): AssistPermissions {
  return PERMISSIONS[role]
}

export function isInternalAssistRole(role: AssistRole): boolean {
  return role !== "CLIENT"
}

export type PolicyMetric = {
  key: string
  label: string
  value: string
  tooltip: string
}

export type PolicyBlocker = {
  text: string
  severity?: "low" | "medium" | "high"
}

export type PolicyAction = {
  label: string
  url: string
  tooltip?: string
}

export type PolicyResponse = {
  headline: string
  terminalState: "OPEN" | "LIMITED" | "PAUSED"
  metrics: PolicyMetric[]
  blockers: PolicyBlocker[]
  actions: PolicyAction[]
}

export function redactForRole(response: PolicyResponse, role: AssistRole): PolicyResponse {
  if (role !== "CLIENT") return response

  const safeMetrics = response.metrics.filter((m) => {
    const key = m.key.toLowerCase()
    return !key.includes("bay") && !key.includes("incident") && !key.includes("inventory") && !key.includes("equipment")
  })

  return {
    headline: `Terminal status: ${response.terminalState}`,
    terminalState: response.terminalState,
    metrics: safeMetrics,
    blockers: [],
    actions: response.actions.filter((a) => !a.url.startsWith("/terminal/")),
  }
}
