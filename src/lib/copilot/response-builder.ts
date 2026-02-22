import type { FormattedAnswer } from "./tool-registry"
import type { AssistResponse } from "../../../types/assistResponse"

export type ChatAction = {
  id: string
  label: string
  href?: string
  incidentId?: string
  truckId?: string
  incident_id?: string
  truck_id?: string
  action?: "signout"
  /** When true, this is the primary resolution action and renders with high-visibility styling */
  primary?: boolean
}

export interface ApprovalCardPayload {
  status: "BLOCKED" | "ACTION_REQUIRED" | "APPROVED"
  truck_id: string
  transporter_name: string
  compliance_gap_summary?: string
  precheck: {
    peso_license_validity: { valid: boolean; detail: string }
    spark_arrestor_status: { valid: boolean; detail: string }
    earthing_relay_calibration: { valid: boolean; detail: string }
    rc_fitness_certificate: { valid: boolean; detail: string }
  }
  checklist?: Array<{ id: string; label: string }>
  gatekeeper_action?: {
    label: string
    action_url: string
  }
  priority?: "Info" | "Warning" | "Critical"
}

export interface CopilotMessage {
  id: string
  sender: "bot"
  text: string
  breakdown?: string[]
  recommendedActions?: string[]
  source?: string
  timestamp?: string
  actions?: ChatAction[]
  approvalCard?: ApprovalCardPayload
  assistResponse?: AssistResponse
  isOpsMetric?: boolean
  isLoading?: boolean
  error?: string
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildOpsResponse(formatted: FormattedAnswer): CopilotMessage {
  const actions: ChatAction[] = [...(formatted.actions ?? [])]
  if (formatted.navigateTo) {
    actions.push({
      id: `nav-${makeId()}`,
      label: `Open ${formatted.source}`,
      href: formatted.navigateTo,
    })
  }

  return {
    id: makeId(),
    sender: "bot",
    text: formatted.answer,
    breakdown: formatted.breakdown,
    recommendedActions: formatted.recommendedActions,
    source: formatted.source,
    timestamp: new Date().toISOString(),
    actions,
    approvalCard: formatted.approvalCard,
    assistResponse: formatted.assistResponse,
    isOpsMetric: true,
  }
}

export function buildNavResponse(text: string, actions: ChatAction[]): CopilotMessage {
  return {
    id: makeId(),
    sender: "bot",
    text,
    actions,
  }
}

export function buildErrorResponse(message: string): CopilotMessage {
  return {
    id: makeId(),
    sender: "bot",
    text: message,
    error: message,
  }
}

export function buildLoadingMessage(): CopilotMessage {
  return {
    id: makeId(),
    sender: "bot",
    text: "Fetching data...",
    isLoading: true,
  }
}

export function buildPermissionDeniedResponse(toolId: string): CopilotMessage {
  return {
    id: makeId(),
    sender: "bot",
    text: "You don't have access to this data. Contact your administrator if you believe this is an error.",
    error: `Permission denied for ${toolId}`,
  }
}
