const BAY_AVAILABILITY_PATTERNS = [
  /\bbay(s)?\b/i,
  /\bavailable\b/i,
  /\bslot(s)?\b/i,
  /\bgantry\b/i,
  /\bloading\b/i,
  /\ballotment\b/i,
  /\bqueue\b/i,
  /\beta\b/i,
  /\bwaiting\b/i,
]

const DOCUMENT_PATTERNS = [/\bdocument(s)?\b/i, /\bupload\b/i, /\bdoc\b/i]

export type AssistIntent = "bay_availability" | "document_help" | "general"

export function detectAssistIntent(message: string): AssistIntent {
  const input = message.trim()
  if (!input) return "general"
  if (BAY_AVAILABILITY_PATTERNS.some((pattern) => pattern.test(input))) {
    return "bay_availability"
  }
  if (DOCUMENT_PATTERNS.some((pattern) => pattern.test(input))) {
    return "document_help"
  }
  return "general"
}

export function extractQueueHint(message: string): number | null {
  const queueMatch = message.match(/(\d+)\s*(truck|trucks|vehicle|vehicles)/i)
  if (!queueMatch) return null
  const parsed = Number.parseInt(queueMatch[1], 10)
  if (Number.isNaN(parsed)) return null
  return parsed
}
