import { guardAssistAction } from "@/lib/assist/action-route-guard"
import { isClient, type AppRole } from "@/lib/security/permissions"

export const CLIENT_FORBIDDEN_TERMS = [
  "hse",
  "checklist",
  "gate-in",
  "sop",
  "incident",
  "gantry",
  "bay",
  "inventory",
  "tank-top",
  "peso",
  "oisd",
  "escalate",
  "blocked movement",
  "control room escalation",
]

const CLIENT_ALLOWED_ACTIONS = new Set([
  "/bookings",
  "/client/documents",
  "/contacts/control-room",
  "/dashboard",
])

function scrubText(text: string): string {
  let next = text
  const replacements: Array<[RegExp, string]> = [
    [/\bHSE\b/gi, "terminal"],
    [/\bincident(s)?\b/gi, "terminal constraints"],
    [/\bgantry\b/gi, "loading area"],
    [/\bbay(s)?\b/gi, "loading area"],
    [/\binventory\b/gi, "capacity"],
    [/\bgate-?in\b/gi, "entry"],
    [/\bchecklist(s)?\b/gi, "checks"],
    [/\bescalate\b/gi, "contact"],
  ]
  for (const [pattern, value] of replacements) {
    next = next.replace(pattern, value)
  }
  return next
}

function containsForbiddenTerm(text: string): boolean {
  const low = text.toLowerCase()
  return CLIENT_FORBIDDEN_TERMS.some((token) => low.includes(token))
}

export function sanitizeForClient(responseText: string): string {
  const trimmed = scrubText(responseText).trim()
  if (!trimmed) {
    return "Terminal data is available on your bookings page."
  }
  if (containsForbiddenTerm(trimmed)) {
    return "Terminal status is available. Please check your bookings for your truck progress."
  }
  return trimmed
}

type BriefingPayload = {
  status: "CRITICAL" | "BOTTLENECKED" | "STABLE"
  headline: string
  key_metrics: string[]
  primary_action: {
    label: string
    action_url: string
  }
}

type ClientBriefingInput = {
  myTrucksToday: number
  inProgress: number
  completed: number
  terminalState: "OPEN" | "LIMITED" | "PAUSED"
  etaRange?: string
}

export function redactBriefingForClient(input: ClientBriefingInput): BriefingPayload {
  const guarded = guardAssistAction({
    label: "View my bookings",
    url: "/bookings",
    tooltip: "Track your active bookings and truck progress.",
  })
  const summary = `Your trucks today: ${input.myTrucksToday} | In progress: ${input.inProgress} | Completed: ${input.completed}`
  const etaMetric = input.etaRange ? `Estimated timeline: ${input.etaRange}` : "Estimated timeline: based on terminal constraints"
  return {
    status: input.terminalState === "PAUSED" ? "CRITICAL" : input.terminalState === "LIMITED" ? "BOTTLENECKED" : "STABLE",
    headline: `Client Daily Summary: Terminal status ${input.terminalState}.`,
    key_metrics: [
      summary,
      "Some terminal constraints may affect timelines.",
      etaMetric,
    ],
    primary_action: {
      label: "View my bookings",
      action_url: guarded.href,
    },
  }
}

type AssistantPayload = {
  reply_text: string
  urgency: "low" | "medium" | "high"
  action_buttons: Array<{ label: string; url: string; tooltip?: string }>
}

export function redactAssistantResponse(role: AppRole, response: AssistantPayload): AssistantPayload {
  if (!isClient(role)) return response

  const safeButtons = response.action_buttons
    .map((button) => guardAssistAction(button))
    .filter((button) => CLIENT_ALLOWED_ACTIONS.has(button.href))
    .map((button) => ({
      label: containsForbiddenTerm(button.label) ? "Open support action" : button.label,
      url: button.href,
      tooltip: button.tooltip,
    }))

  if (safeButtons.length === 0) {
    safeButtons.push(
      { label: "View my bookings", url: "/bookings", tooltip: "Track your booking and truck status." },
      { label: "Upload pending documents", url: "/client/documents", tooltip: "Upload files linked to your booking." },
      { label: "Contact support", url: "/contacts/control-room", tooltip: "Open support contacts for assistance." }
    )
  }

  return {
    ...response,
    reply_text: sanitizeForClient(response.reply_text),
    action_buttons: safeButtons,
  }
}

type MovementRowBase = {
  id: string
  updatedAt: string
  vehicleNo: string
  clientName?: string
  product?: string
  stage: unknown
  statusFlag: "on_time" | "delayed" | "blocked"
  note?: string
  bookingId?: string
  truckId?: string
}

export function redactMovements<T extends MovementRowBase>(role: AppRole, rows: T[]): T[] {
  if (!isClient(role)) return rows
  return rows.map((row) => ({
    ...row,
    clientName: undefined,
    product: undefined,
    note: undefined,
    statusFlag: row.statusFlag === "blocked" ? "delayed" : row.statusFlag,
  }))
}
