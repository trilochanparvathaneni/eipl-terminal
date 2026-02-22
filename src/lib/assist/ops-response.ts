import { guardAssistAction } from "@/lib/assist/action-route-guard"
import { extractQueueHint } from "@/lib/assist/intent"
import { getAssistPermissions, redactForRole, type AssistRole, type PolicyResponse } from "@/lib/assist/policy"
import type { OpsSnapshot } from "@/lib/assist/snapshot"

type BayResponse = PolicyResponse & {
  replyText: string
  urgency: "low" | "medium" | "high"
}

function safeActionButtons(actions: Array<{ label: string; url: string; tooltip?: string }>) {
  return actions.map((action) => {
    const guarded = guardAssistAction(action)
    return {
      label: guarded.label,
      url: guarded.href,
      tooltip: guarded.replaced ? "Contact support for this action." : action.tooltip ?? guarded.tooltip,
    }
  })
}

export function buildBayAvailabilityResponse(params: {
  snapshot: OpsSnapshot
  role: AssistRole
  message: string
}): BayResponse {
  const { snapshot, role, message } = params
  const permissions = getAssistPermissions(role)
  const queueFallback = extractQueueHint(message)
  const queueCount = snapshot.queue.total ?? queueFallback ?? 0
  const activeBays = snapshot.activeBays.active ?? 0
  const avgLoadingMins = 55
  const estimatedMins =
    activeBays > 0 ? Math.max(20, Math.ceil((queueCount / Math.max(activeBays, 1)) * avgLoadingMins)) : null
  const etaRange =
    estimatedMins === null
      ? "Unavailable"
      : `${Math.max(estimatedMins - 10, 10)}-${estimatedMins + 10} mins`

  let terminalState: "OPEN" | "LIMITED" | "PAUSED" = "OPEN"
  if (snapshot.safety.terminalHalt === true || activeBays <= 0) {
    terminalState = "PAUSED"
  } else if ((snapshot.safety.blockingIncidentCount ?? 0) > 0 || (snapshot.safety.activeStopWorkCount ?? 0) > 0) {
    terminalState = "LIMITED"
  }

  const internalMetrics = [
    {
      key: "queue_count",
      label: "Queue",
      value: `${queueCount} trucks`,
      tooltip: "How many trucks are currently waiting in the movement pipeline.",
    },
    {
      key: "active_bays",
      label: "Active Bays",
      value:
        snapshot.activeBays.total !== null ? `${activeBays}/${snapshot.activeBays.total} active` : `${activeBays} active`,
      tooltip: "Number of bays currently usable for loading or staging.",
    },
    {
      key: "eta_range",
      label: "ETA",
      value: etaRange,
      tooltip: "Estimated allotment wait range based on queue and active bays.",
    },
    {
      key: "open_incidents",
      label: "Open HSE Incidents",
      value: `${snapshot.safety.openIncidentCount ?? 0}`,
      tooltip: "Current open safety incidents tracked in terminal systems.",
    },
  ]

  const clientMetrics = [
    {
      key: "terminal_state",
      label: "Terminal Status",
      value: terminalState,
      tooltip: "Overall terminal operating state for allotment planning.",
    },
    {
      key: "eta_range",
      label: "Estimated Allotment",
      value: etaRange,
      tooltip: "Expected waiting time range for your next truck movement.",
    },
    {
      key: "queue_public",
      label: "Current Flow",
      value: queueCount > 0 ? `${queueCount} trucks in cycle` : "Normal flow",
      tooltip: "High-level movement load without exposing internal capacity details.",
    },
  ]

  const blockers = permissions.canViewIncidentCounts
    ? [
        ...(snapshot.safety.blockingIncidentCount
          ? [{ text: `${snapshot.safety.blockingIncidentCount} high-severity incident(s) may impact loading`, severity: "high" as const }]
          : []),
        ...(snapshot.safety.activeStopWorkCount
          ? [{ text: `${snapshot.safety.activeStopWorkCount} active stop-work order(s)`, severity: "high" as const }]
          : []),
        ...(snapshot.safety.blockedComplianceCount
          ? [{ text: `${snapshot.safety.blockedComplianceCount} compliance gate block(s) in progress`, severity: "medium" as const }]
          : []),
      ]
    : []

  const actions = safeActionButtons([
    { label: "View Schedule", url: "/schedule", tooltip: "See today's planned loading slots." },
    { label: "Contact Control Room", url: "/contacts/control-room", tooltip: "Open contact details and escalation steps." },
    ...(permissions.canViewInternalBays
      ? [{ label: "View Bay Status", url: "/terminal/bays", tooltip: "Shows which bays are active or under maintenance." }]
      : []),
    ...(permissions.canViewInternalBays
      ? [{ label: "View Queue", url: "/terminal/queue", tooltip: "Shows current truck line status by stage." }]
      : []),
    { label: "Upload Documents", url: "/client/documents", tooltip: "Upload and index operational documents for Assist." },
  ])

  const roleAware = redactForRole(
    {
      headline: `Allotment status: ${terminalState}`,
      terminalState,
      metrics: permissions.canViewInternalBays ? internalMetrics : clientMetrics,
      blockers,
      actions,
    },
    role
  )

  const safetyReason =
    role === "CLIENT"
      ? terminalState === "OPEN"
        ? "terminal flow is normal"
        : "terminal constraints and safety checks are in progress"
      : blockers.length > 0
        ? blockers.map((b) => b.text).join("; ")
        : "no active safety blockers"
  const replyText =
    role === "CLIENT"
      ? `Terminal is ${terminalState}. Estimated allotment is ${etaRange}. Reason: ${safetyReason}.`
      : `Terminal is ${terminalState}. Queue is ${queueCount} trucks, active bays ${activeBays}. Estimated allotment ${etaRange}. Safety view: ${safetyReason}.`

  const urgency: "low" | "medium" | "high" =
    terminalState === "PAUSED" ? "high" : terminalState === "LIMITED" ? "medium" : "low"

  return {
    ...roleAware,
    replyText,
    urgency,
  }
}

export function buildDocumentActions() {
  return safeActionButtons([
    { label: "Open Document Vault", url: "/client/documents", tooltip: "Upload and manage booking and compliance documents." },
    { label: "Contact Control Room", url: "/contacts/control-room", tooltip: "Get help if upload mapping needs manual review." },
  ])
}
