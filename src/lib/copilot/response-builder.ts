import type { FormattedAnswer } from "./tool-registry"

export type ChatAction = {
  id: string
  label: string
  href?: string
  action?: "signout"
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
  isOpsMetric?: boolean
  isLoading?: boolean
  error?: string
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildOpsResponse(formatted: FormattedAnswer): CopilotMessage {
  const actions: ChatAction[] = []
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
