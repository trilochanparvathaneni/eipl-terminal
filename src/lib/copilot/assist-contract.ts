import type { SessionUser } from "@/lib/auth-utils"
import type { AssistAction, AssistResponse, AssistSeverity, ChatRole } from "../../../types/assistResponse"
import type { FormattedAnswer } from "./tool-registry"

interface BuildAssistContractInput {
  toolId: string
  data: any
  formatted: FormattedAnswer
  user: SessionUser
}

function toChatRole(user: SessionUser): ChatRole {
  return user.role === "CLIENT" || user.role === "TRANSPORTER" ? "external_client" : "internal_ops"
}

function inferSeverity(text: string): AssistSeverity {
  const t = text.toLowerCase()
  if (t.includes("blocked") || t.includes("fault") || t.includes("danger") || t.includes("critical")) return "danger"
  if (t.includes("warning") || t.includes("pending") || t.includes("risk")) return "warning"
  if (t.includes("clear") || t.includes("normal") || t.includes("healthy") || t.includes("all clear")) return "success"
  return "info"
}

function toStatus(toolId: string, data: any, formatted: FormattedAnswer): AssistResponse["status"] {
  if (toolId === "dashboard_stats") {
    const trucks = Number(data?.inTerminal ?? 0)
    const trips = Number(data?.todayTrips ?? 0)
    const incidents = Number(data?.openIncidents ?? 0)
    if (trucks > 0 && trips === 0) return { label: "Allotment Blocked", severity: "danger", icon: "alert-triangle" }
    if (incidents > 0) return { label: "Safety Watch", severity: "warning", icon: "shield-alert" }
    return { label: "Flow Stable", severity: "success", icon: "circle-check" }
  }

  if (toolId === "controller_state") {
    const queue = Array.isArray(data?.readyQueue) ? data.readyQueue.length : 0
    const idle = Array.isArray(data?.bays) ? data.bays.filter((b: any) => b.status === "IDLE").length : 0
    if (queue > 0 && idle === 0) return { label: "Bay Saturation", severity: "danger", icon: "factory" }
    if (queue > 0) return { label: "Queue Pending", severity: "warning", icon: "clock-3" }
    return { label: "Controller Clear", severity: "success", icon: "list-checks" }
  }

  if (toolId === "ai_plan") {
    const atRisk = Number(data?.queueResequence?.at_risk_trucks?.length ?? 0)
    const alerts = Number(data?.alerts?.length ?? 0)
    if (atRisk > 0) return { label: "Risk Active", severity: "danger", icon: "siren" }
    if (alerts > 0) return { label: "Plan Alerts", severity: "warning", icon: "triangle-alert" }
    return { label: "Plan Healthy", severity: "success", icon: "brain-circuit" }
  }

  if (toolId === "incidents_list") {
    const incidents = Array.isArray(data?.incidents) ? data.incidents : []
    const openCount = incidents.filter((x: any) => x.status === "OPEN").length
    if (openCount > 0) return { label: "Open Incidents", severity: "danger", icon: "shield-x" }
    return { label: "No Open Incidents", severity: "success", icon: "shield-check" }
  }

  if (toolId === "safety_report") {
    const activeStopWork = Number(data?.stopWorkOrders?.active ?? 0)
    if (activeStopWork > 0) return { label: "Stop-Work Active", severity: "danger", icon: "hand" }
    return { label: "Safety Normal", severity: "success", icon: "hard-hat" }
  }

  const sourceText = `${formatted.answer} ${(formatted.breakdown ?? []).join(" ")}`
  const severity = inferSeverity(sourceText)
  return {
    label: severity === "danger" ? "Critical Bottleneck" :
      severity === "warning" ? "Operational Warning" :
      severity === "success" ? "Operationally Stable" :
      "Operational Insight",
    severity,
    icon: "info",
  }
}

function pushMetric(metrics: AssistResponse["metrics"], label: string, value: string | number | null | undefined, hint?: string) {
  if (value === null || value === undefined) return
  metrics.push({
    label,
    value: typeof value === "number" ? String(value) : value,
    hint,
  })
}

function buildMetrics(toolId: string, data: any): AssistResponse["metrics"] {
  const metrics: AssistResponse["metrics"] = []
  if (toolId === "dashboard_stats") {
    const trucks = Number(data?.inTerminal ?? 0)
    const trips = Number(data?.todayTrips ?? 0)
    const incidents = Number(data?.openIncidents ?? 0)
    pushMetric(metrics, "Trucks in Yard", trucks, trips === 0 && trucks > 0 ? "Yard load without dispatch" : undefined)
    pushMetric(metrics, "Trips Scheduled", trips)
    pushMetric(metrics, "Active Bookings", data?.totalBookings)
    pushMetric(metrics, "Open Incidents", incidents)
    if (metrics[0]) metrics[0].severity = trips === 0 && trucks > 0 ? "warning" : "info"
    if (metrics[1]) metrics[1].severity = trips === 0 && trucks > 0 ? "danger" : "success"
    if (metrics[3]) metrics[3].severity = incidents > 0 ? "warning" : "success"
    return metrics
  }

  if (toolId === "controller_state") {
    const queue = Array.isArray(data?.readyQueue) ? data.readyQueue.length : 0
    const bays = Array.isArray(data?.bays) ? data.bays : []
    const idle = bays.filter((b: any) => b.status === "IDLE").length
    pushMetric(metrics, "Ready Queue", queue)
    pushMetric(metrics, "Total Bays", bays.length)
    pushMetric(metrics, "Idle Bays", idle)
    if (metrics[0]) metrics[0].severity = queue > 0 ? "warning" : "success"
    if (metrics[2]) metrics[2].severity = queue > 0 && idle === 0 ? "danger" : "success"
    return metrics
  }

  if (toolId === "ai_plan") {
    const recs = Number(data?.bayRecommendations?.length ?? 0)
    const alerts = Number(data?.alerts?.length ?? 0)
    const risk = Number(data?.queueResequence?.at_risk_trucks?.length ?? 0)
    pushMetric(metrics, "Bay Recommendations", recs)
    pushMetric(metrics, "Operational Alerts", alerts)
    pushMetric(metrics, "At-Risk Trucks", risk)
    if (metrics[0]) metrics[0].severity = recs > 0 ? "info" : "warning"
    if (metrics[1]) metrics[1].severity = alerts > 0 ? "warning" : "success"
    if (metrics[2]) metrics[2].severity = risk > 0 ? "danger" : "success"
    return metrics
  }

  if (toolId === "gate_today") {
    const trips = Array.isArray(data) ? data : []
    pushMetric(metrics, "Trips at Gate", trips.length)
    return metrics
  }

  if (toolId === "incidents_list") {
    const total = Number(data?.total ?? data?.incidents?.length ?? 0)
    const openCount = Array.isArray(data?.incidents) ? data.incidents.filter((x: any) => x.status === "OPEN").length : 0
    pushMetric(metrics, "Total Incidents", total)
    pushMetric(metrics, "Open Incidents", openCount)
    if (metrics[1]) metrics[1].severity = openCount > 0 ? "danger" : "success"
    return metrics
  }

  if (toolId === "safety_report") {
    const active = Number(data?.stopWorkOrders?.active ?? 0)
    pushMetric(metrics, "Active Stop-Work", active)
    pushMetric(metrics, "Total Stop-Work", data?.stopWorkOrders?.total)
    if (metrics[0]) metrics[0].severity = active > 0 ? "danger" : "success"
    return metrics
  }

  return metrics
}

function buildBlockers(formatted: FormattedAnswer): AssistResponse["blockers"] | undefined {
  const lines = formatted.breakdown ?? []
  const blockerItems = lines
    .filter((line) => {
      const l = line.toLowerCase()
      return line.includes("[STATUS]") || l.includes("block") || l.includes("fault") || l.includes("incident") || l.includes("stop-work")
    })
    .map((line) => ({
      text: line.replace("[STATUS]", "").trim(),
      severity: inferSeverity(line),
    }))

  if (blockerItems.length === 0) return undefined
  return {
    title: "Detected Blockers",
    items: blockerItems,
  }
}

function visibilityForHref(href: string): ChatRole[] {
  if (href.startsWith("/hse") || href.startsWith("/controller")) {
    return ["internal_ops"]
  }
  return ["internal_ops", "external_client"]
}

function buildActions(formatted: FormattedAnswer, source: string): AssistAction[] {
  const actions: AssistAction[] = []
  for (const a of formatted.actions ?? []) {
    if (!a.href) continue
    actions.push({
      id: a.id,
      label: a.label,
      href: a.href,
      tooltip: `Open ${a.label.toLowerCase()}`,
      primary: a.primary,
      visibility: visibilityForHref(a.href),
    })
  }

  if (formatted.navigateTo) {
    actions.push({
      id: `open-${source.toLowerCase().replace(/\s+/g, "-")}`,
      label: `Open ${source}`,
      href: formatted.navigateTo,
      tooltip: `Open ${source} page`,
      visibility: visibilityForHref(formatted.navigateTo),
    })
  }
  return actions
}

export function buildAssistContract(input: BuildAssistContractInput): AssistResponse {
  const role = toChatRole(input.user)
  return {
    kind: "ops_availability",
    intent: "availability_allotment",
    role,
    headline: input.formatted.source,
    summary: input.formatted.answer,
    status: toStatus(input.toolId, input.data, input.formatted),
    metrics: buildMetrics(input.toolId, input.data),
    blockers: buildBlockers(input.formatted),
    actions: buildActions(input.formatted, input.formatted.source),
    debug: {
      toolId: input.toolId,
      generatedAt: new Date().toISOString(),
    },
  }
}
