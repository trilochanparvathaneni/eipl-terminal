export interface FormattedAnswer {
  answer: string
  breakdown?: string[]
  recommendedActions?: string[]
  source: string
  navigateTo?: string
}

export interface OpsTool {
  id: string
  endpoint: string
  method: "GET" | "POST"
  requiredPermission: string
  integrated: boolean
  description: string
  formatResponse: (data: any) => FormattedAnswer
}

export const TOOL_REGISTRY: Record<string, OpsTool> = {
  dashboard_stats: {
    id: "dashboard_stats",
    endpoint: "/api/dashboard/stats",
    method: "GET",
    requiredPermission: "booking:read",
    integrated: true,
    description: "Terminal dashboard overview",
    formatResponse: (data) => ({
      answer: `Terminal has ${data.inTerminal} truck(s) currently in yard, ${data.totalBookings} active booking(s), and ${data.todayTrips} trip(s) scheduled today.`,
      breakdown: [
        `Active bookings: ${data.totalBookings}`,
        `Today's trips: ${data.todayTrips}`,
        `Trucks in terminal: ${data.inTerminal}`,
        `Open incidents: ${data.openIncidents}`,
      ],
      recommendedActions: data.openIncidents > 0
        ? ["Review open incidents in HSE module", "Check dashboard for details"]
        : ["All clear — no open incidents"],
      source: "Dashboard Stats",
      navigateTo: "/dashboard",
    }),
  },

  booking_stats: {
    id: "booking_stats",
    endpoint: "/api/bookings/stats",
    method: "GET",
    requiredPermission: "booking:read",
    integrated: true,
    description: "Booking count breakdown by status",
    formatResponse: (data) => {
      const statusEntries = Object.entries(data.byStatus || {}) as [string, number][]
      return {
        answer: `There are ${data.total} total booking(s).`,
        breakdown: statusEntries.length > 0
          ? statusEntries.map(([status, count]) => `${status}: ${count}`)
          : ["No bookings found"],
        recommendedActions: ["View all bookings for details"],
        source: "Booking Stats",
        navigateTo: "/bookings",
      }
    },
  },

  controller_state: {
    id: "controller_state",
    endpoint: "/api/controller/state",
    method: "GET",
    requiredPermission: "controller:console",
    integrated: true,
    description: "Controller console state",
    formatResponse: (data) => {
      const totalBays = data.bays?.length ?? 0
      const idleBays = data.bays?.filter((b: any) => b.status === "IDLE").length ?? 0
      const queueLength = data.readyQueue?.length ?? 0

      return {
        answer: `${queueLength} truck(s) in ready queue. ${idleBays} of ${totalBays} bay(s) idle.`,
        breakdown: [
          `Total bays: ${totalBays}`,
          `Idle bays: ${idleBays}`,
          `Ready queue: ${queueLength} truck(s)`,
          `Recent AI recommendations: ${data.recentRecommendations?.length ?? 0}`,
        ],
        recommendedActions: queueLength > 0 && idleBays > 0
          ? ["Review AI plan for bay assignments", "Open controller console"]
          : queueLength === 0
            ? ["No trucks waiting — queue is clear"]
            : ["All bays busy — monitor for availability"],
        source: "Controller State",
        navigateTo: "/controller/console",
      }
    },
  },

  ai_plan: {
    id: "ai_plan",
    endpoint: "/api/ai/plan",
    method: "GET",
    requiredPermission: "ai:read",
    integrated: true,
    description: "AI bay recommendations and alerts",
    formatResponse: (data) => {
      const recCount = data.bayRecommendations?.length ?? 0
      const alertCount = data.alerts?.length ?? 0
      const atRisk = data.queueResequence?.at_risk_trucks?.length ?? 0

      const breakdown = [
        `Bay recommendations: ${recCount}`,
        `Operational alerts: ${alertCount}`,
        `At-risk trucks: ${atRisk}`,
      ]

      if (data.alerts?.length > 0) {
        breakdown.push("", "Top alerts:")
        for (const alert of data.alerts.slice(0, 3)) {
          breakdown.push(`• ${alert.message}`)
        }
      }

      return {
        answer: `AI plan has ${recCount} bay recommendation(s) and ${alertCount} alert(s). ${atRisk} truck(s) at risk.`,
        breakdown,
        recommendedActions: recCount > 0
          ? ["Review and apply bay assignments in controller console"]
          : ["No recommendations — check if trucks are in queue"],
        source: "AI Plan",
        navigateTo: "/controller/console",
      }
    },
  },

  gate_today: {
    id: "gate_today",
    endpoint: "/api/gate/today",
    method: "GET",
    requiredPermission: "gate:read",
    integrated: true,
    description: "Today's gate activity",
    formatResponse: (data) => {
      const trips = Array.isArray(data) ? data : []
      const checkedIn = trips.filter((t: any) => t.gateEvents?.some((e: any) => e.type === "CHECK_IN")).length
      const checkedOut = trips.filter((t: any) => t.gateEvents?.some((e: any) => e.type === "CHECK_OUT")).length

      return {
        answer: `Today: ${trips.length} trip(s) processed at gate. ${checkedIn} checked in, ${checkedOut} checked out.`,
        breakdown: [
          `Total trips today: ${trips.length}`,
          `Checked in: ${checkedIn}`,
          `Checked out: ${checkedOut}`,
          `Still in terminal: ${checkedIn - checkedOut}`,
        ],
        recommendedActions: ["View gate operations for full details"],
        source: "Gate Today",
        navigateTo: "/security/gate",
      }
    },
  },

  movements_report: {
    id: "movements_report",
    endpoint: "/api/reports/movements",
    method: "GET",
    requiredPermission: "reports:read",
    integrated: true,
    description: "Truck movement report with turnaround times",
    formatResponse: (data) => {
      const movements = data.movements ?? []
      const withTurnaround = movements.filter((m: any) => m.turnaroundTimeMinutes != null)
      const avgTurnaround = withTurnaround.length > 0
        ? Math.round(withTurnaround.reduce((sum: number, m: any) => sum + m.turnaroundTimeMinutes, 0) / withTurnaround.length)
        : null

      return {
        answer: avgTurnaround != null
          ? `${data.total} truck movement(s) recorded. Average turnaround: ${avgTurnaround} minutes.`
          : `${data.total} truck movement(s) recorded. No turnaround data available yet.`,
        breakdown: [
          `Total movements: ${data.total}`,
          `With turnaround data: ${withTurnaround.length}`,
          ...(avgTurnaround != null ? [`Average turnaround: ${avgTurnaround} min`] : []),
        ],
        recommendedActions: ["Open reports page for detailed movement analysis"],
        source: "Movements Report",
        navigateTo: "/reports",
      }
    },
  },

  safety_report: {
    id: "safety_report",
    endpoint: "/api/reports/safety",
    method: "GET",
    requiredPermission: "safety:read",
    integrated: true,
    description: "Safety report with checklists, stop-work orders, and incidents",
    formatResponse: (data) => {
      const checklistEntries = Object.entries(data.checklists || {}) as [string, number][]
      const totalChecklists = checklistEntries.reduce((sum, [, count]) => sum + count, 0)
      const incidentEntries = Object.entries(data.incidents || {}) as [string, number][]
      const totalIncidents = incidentEntries.reduce((sum, [, count]) => sum + count, 0)

      const breakdown = [
        `Safety checklists: ${totalChecklists}`,
        ...checklistEntries.map(([status, count]) => `  ${status}: ${count}`),
        `Stop-work orders: ${data.stopWorkOrders?.total ?? 0} (${data.stopWorkOrders?.active ?? 0} active)`,
        `Incidents: ${totalIncidents}`,
        ...incidentEntries.map(([severity, count]) => `  ${severity}: ${count}`),
      ]

      return {
        answer: `Safety summary: ${totalChecklists} checklist(s), ${data.stopWorkOrders?.active ?? 0} active stop-work order(s), ${totalIncidents} incident(s).`,
        breakdown,
        recommendedActions: (data.stopWorkOrders?.active ?? 0) > 0
          ? ["Review active stop-work orders immediately", "Check HSE module for details"]
          : ["No active stop-work orders — HSE status normal"],
        source: "Safety Report",
        navigateTo: "/hse",
      }
    },
  },

  bay_utilization: {
    id: "bay_utilization",
    endpoint: "/api/reports/bay-utilization",
    method: "GET",
    requiredPermission: "reports:read",
    integrated: true,
    description: "Bay utilization report",
    formatResponse: (data) => {
      const bays = data.utilization ?? []
      const totalAllocations = bays.reduce((sum: number, b: any) => sum + b.allocationCount, 0)
      const busiest = bays.length > 0
        ? [...bays].sort((a: any, b: any) => b.allocationCount - a.allocationCount).slice(0, 3)
        : []

      const breakdown = [
        `Total bays: ${bays.length}`,
        `Total allocations: ${totalAllocations}`,
      ]

      if (busiest.length > 0) {
        breakdown.push("", "Busiest bays:")
        for (const bay of busiest) {
          breakdown.push(`• ${bay.bayName} (${bay.gantry?.name ?? "N/A"}): ${bay.allocationCount} allocations`)
        }
      }

      return {
        answer: `${bays.length} bay(s) tracked with ${totalAllocations} total allocation(s).`,
        breakdown,
        recommendedActions: ["View reports page for detailed bay analysis"],
        source: "Bay Utilization",
        navigateTo: "/reports",
      }
    },
  },

  incidents_list: {
    id: "incidents_list",
    endpoint: "/api/incidents",
    method: "GET",
    requiredPermission: "incident:read",
    integrated: true,
    description: "List of incidents",
    formatResponse: (data) => {
      const incidents = data.incidents ?? []
      const openCount = incidents.filter((i: any) => i.status === "OPEN").length

      const breakdown = [
        `Total incidents: ${data.total ?? incidents.length}`,
        `Open: ${openCount}`,
        `Resolved/Closed: ${(data.total ?? incidents.length) - openCount}`,
      ]

      if (incidents.length > 0) {
        breakdown.push("", "Recent incidents:")
        for (const inc of incidents.slice(0, 3)) {
          breakdown.push(`• [${inc.severity}] ${inc.description?.slice(0, 60) ?? "No description"}${inc.description?.length > 60 ? "..." : ""} — ${inc.status}`)
        }
      }

      return {
        answer: `${data.total ?? incidents.length} incident(s) found, ${openCount} currently open.`,
        breakdown,
        recommendedActions: openCount > 0
          ? ["Review and resolve open incidents in HSE module"]
          : ["No open incidents — all clear"],
        source: "Incidents",
        navigateTo: "/hse",
      }
    },
  },

  create_incident: {
    id: "create_incident",
    endpoint: "/api/incidents",
    method: "POST",
    requiredPermission: "incident:create",
    integrated: true,
    description: "Create a new incident report",
    formatResponse: () => ({
      answer: "To report an incident, please use the HSE module where you can fill in all required details (terminal, severity, description).",
      recommendedActions: ["Open HSE module to report incident"],
      source: "Incident Reporting",
      navigateTo: "/hse",
    }),
  },
}
