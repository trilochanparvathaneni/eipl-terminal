const INCIDENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/

export function isValidIncidentId(id: unknown): id is string {
  if (typeof id !== "string") return false
  const trimmed = id.trim()
  if (!trimmed) return false
  return INCIDENT_ID_PATTERN.test(trimmed)
}

export function buildIncidentHref(id?: string | null): string {
  if (!isValidIncidentId(id)) {
    return "/hse/incidents"
  }
  return `/hse/incidents/${encodeURIComponent(id)}`
}
