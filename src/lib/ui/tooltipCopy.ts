export const TOOLTIP_COPY = {
  hseManagement: "Safety controls: checklists, incidents, stop-work.",
  safetyChecklists: "Pre-shift checks before loading starts.",
  stopWorkOrders: "Pause work until safety issue is fixed.",
  incidents: "Report and track safety/ops incidents.",
} as const

export function shortTip(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= 80) return compact
  return `${compact.slice(0, 79).trim()}...`
}
