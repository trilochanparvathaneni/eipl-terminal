import { Role } from "@prisma/client"

export interface PatternRule {
  toolId: string
  category: "ops-metric" | "safety-hse" | "action-request"
  patterns: RegExp[]
  keywords: string[]
  requiredPermission: string
  description: string
}

export const PATTERN_RULES: PatternRule[] = [
  // ── Safety / HSE (highest priority) ──────────────────────────────────
  {
    toolId: "safety_report",
    category: "safety-hse",
    patterns: [
      /safety\s*(report|summary|overview)/i,
      /hse\s*(report|summary|overview|status)/i,
      /stop\s*work/i,
      /safety\s*checklist/i,
    ],
    keywords: ["safety", "hse", "stop work", "checklist", "safety report"],
    requiredPermission: "safety:read",
    description: "Safety report with checklists, stop-work orders, and incidents by severity",
  },
  {
    toolId: "incidents_list",
    category: "safety-hse",
    patterns: [
      /list\s*incidents/i,
      /open\s*incidents/i,
      /incident\s*(list|report|log)/i,
      /any\s*(open\s*)?incidents/i,
      /show\s*incidents/i,
    ],
    keywords: ["incidents", "incident list", "open incidents"],
    requiredPermission: "incident:read",
    description: "List of incidents with status and severity",
  },
  {
    toolId: "create_incident",
    category: "action-request",
    patterns: [
      /report\s*(an?\s*)?incident/i,
      /create\s*(an?\s*)?incident/i,
      /new\s*incident/i,
      /log\s*(an?\s*)?incident/i,
    ],
    keywords: ["report incident", "create incident", "new incident", "log incident"],
    requiredPermission: "incident:create",
    description: "Report a new safety incident",
  },
  {
    toolId: "gate_pass_approval",
    category: "action-request",
    patterns: [
      /gate\s*pass/i,
      /issue\s*gate\s*pass/i,
      /approve\s*gate\s*pass/i,
      /truck\s*compliance\s*check/i,
      /peso\s*(check|compliance)/i,
      /oisd\s*(check|compliance)/i,
    ],
    keywords: [
      "gate pass",
      "issue gate pass",
      "approve gate pass",
      "truck compliance",
      "peso check",
      "oisd check",
    ],
    requiredPermission: "gate:read",
    description: "Pre-check and approve truck gate pass with PESO/OISD compliance workflow",
  },

  // ── Ops Metrics ──────────────────────────────────────────────────────
  {
    toolId: "dashboard_stats",
    category: "ops-metric",
    patterns: [
      /how\s*many\s*(bookings|trips|trucks)/i,
      /terminal\s*(overview|summary|stats)/i,
      /dashboard\s*(stats|summary|overview)/i,
      /trucks?\s*(in\s*terminal|in\s*yard)/i,
      /total\s*(bookings|trips)/i,
    ],
    keywords: [
      "how many bookings", "how many trips", "how many trucks",
      "terminal overview", "dashboard stats", "trucks in terminal",
      "in terminal", "today trips",
    ],
    requiredPermission: "booking:read",
    description: "Dashboard overview with total bookings, today's trips, trucks in terminal, and open incidents",
  },
  {
    toolId: "booking_stats",
    category: "ops-metric",
    patterns: [
      /booking\s*(status\s*)?(breakdown|stats|summary)/i,
      /bookings?\s*by\s*status/i,
      /booking\s*count/i,
    ],
    keywords: ["booking status", "booking breakdown", "bookings by status", "booking stats"],
    requiredPermission: "booking:read",
    description: "Booking count breakdown by status",
  },
  {
    toolId: "controller_state",
    category: "ops-metric",
    patterns: [
      /queue\s*(status|state)/i,
      /trucks?\s*waiting/i,
      /ready\s*queue/i,
      /bay\s*(status|state)/i,
      /controller\s*(state|console|status)/i,
    ],
    keywords: ["queue status", "trucks waiting", "ready queue", "bay status", "controller state"],
    requiredPermission: "controller:console",
    description: "Controller console state with bays, ready queue, and AI recommendations",
  },
  {
    toolId: "ai_plan",
    category: "ops-metric",
    patterns: [
      /ai\s*(recommend|plan|suggest)/i,
      /bay\s*assign/i,
      /at[\s-]*risk\s*trucks/i,
      /operational?\s*alerts?/i,
    ],
    keywords: ["ai recommendations", "bay assignments", "alerts", "ai plan", "at risk"],
    requiredPermission: "ai:read",
    description: "AI-generated bay recommendations, at-risk trucks, and operational alerts",
  },
  {
    toolId: "gate_today",
    category: "ops-metric",
    patterns: [
      /gate\s*(activity|ops|today)/i,
      /trucks?\s*(checked\s*in|arrived)\s*today/i,
      /today.?s?\s*gate/i,
    ],
    keywords: ["gate activity", "gate today", "trucks checked in today", "gate ops"],
    requiredPermission: "gate:read",
    description: "Today's gate activity with truck check-ins and check-outs",
  },
  {
    toolId: "movements_report",
    category: "ops-metric",
    patterns: [
      /turnaround\s*time/i,
      /average\s*turnaround/i,
      /movement\s*(report|log)/i,
      /truck\s*movements?/i,
    ],
    keywords: ["turnaround time", "average turnaround", "movement report", "truck movements"],
    requiredPermission: "reports:read",
    description: "Truck movement report with turnaround times",
  },
  {
    toolId: "bay_utilization",
    category: "ops-metric",
    patterns: [
      /bay\s*utiliz/i,
      /which\s*bays?\s*(are\s*)?(busy|idle|free|available)/i,
      /bay\s*(usage|load|allocation)/i,
    ],
    keywords: ["bay utilization", "bays busy", "bays idle", "bay usage"],
    requiredPermission: "reports:read",
    description: "Bay utilization report with allocation counts per bay",
  },

  {
    toolId: "inventory_summary",
    category: "ops-metric",
    patterns: [
      /inventory\s*(level|status|summary)/i,
      /lpg\s*(level|stock|inventory)/i,
      /horton\s*sphere/i,
      /tank\s*(level|capacity|status)/i,
      /how\s*much\s*(lpg|inventory|stock)/i,
    ],
    keywords: [
      "inventory", "lpg level", "horton sphere", "tank level",
      "stock", "inventory summary", "storage capacity", "decanting",
    ],
    requiredPermission: "reports:read",
    description: "Horton Sphere LPG inventory levels and product breakdown by client lot",
  },

  // ── Stub tools ───────────────────────────────────────────────────────
  {
    toolId: "realtime_queue",
    category: "ops-metric",
    patterns: [
      /trucks?\s*(waiting\s*)?(outside|at)\s*(the\s*)?gate/i,
      /queue\s*outside/i,
      /external\s*queue/i,
      /gate\s*queue/i,
    ],
    keywords: ["trucks waiting outside", "queue outside gate", "external queue", "gate queue"],
    requiredPermission: "gate:read",
    description: "Real-time queue of trucks waiting outside the gate",
  },
  {
    toolId: "predictive_maintenance",
    category: "ops-metric",
    patterns: [
      /predictive\s*maintenance/i,
      /equipment\s*(health|status)/i,
      /maintenance\s*(forecast|schedule)/i,
    ],
    keywords: ["predictive maintenance", "equipment health", "maintenance forecast"],
    requiredPermission: "reports:read",
    description: "Predictive maintenance analytics for terminal equipment",
  },
  {
    toolId: "export_report",
    category: "action-request",
    patterns: [
      /export\s*(report|pdf|csv)/i,
      /download\s*(report|pdf|csv)/i,
      /generate\s*(report|pdf|csv)/i,
    ],
    keywords: ["export report", "download pdf", "export csv", "generate report"],
    requiredPermission: "reports:export",
    description: "Export report as PDF or CSV",
  },
]
