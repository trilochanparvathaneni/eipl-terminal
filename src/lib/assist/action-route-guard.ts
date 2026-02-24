type RawAction = {
  label?: string
  url?: string
  href?: string
  tooltip?: string
}

export type GuardedAction = {
  label: string
  href: string
  tooltip: string
  replaced: boolean
  replacementReason?: string
}

const SUPPORT_ROUTE = "/dashboard"
const SUPPORT_LABEL = "Open Dashboard"

const ROUTE_ALLOWLIST_EXACT = new Set<string>([
  "/dashboard",
  "/hse",
  "/hse/incidents",
  "/hse/incidents/new",
  "/hse/incidents/report",
  "/incidents/report",
  "/hse/protocols/gas-leak",
  "/inventory/methanol",
  "/contacts/control-room",
  "/support/contact",
  "/schedule",
  "/reports",
  "/bookings",
  "/controller/console",
  "/security/gate",
  "/notifications",
  "/terminal/bays",
  "/terminal/queue",
  "/client/documents",
  "/admin/documents-review",
])

const ROUTE_ALLOWLIST_PREFIXES = [
  "/hse/incidents/",
  "/bookings/",
  "/transporter/trips/",
  "/controller/",
  "/reports/",
]

function isInternalAllowedRoute(path: string): boolean {
  const pathname = new URL(path, "http://local.test").pathname
  if (ROUTE_ALLOWLIST_EXACT.has(pathname)) return true
  return ROUTE_ALLOWLIST_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function normalizePath(path: string): string {
  const clean = path.trim()
  if (!clean) return SUPPORT_ROUTE
  if (clean.startsWith("/")) return clean
  return `/${clean}`
}

function knownRouteFromText(label: string, url: string): string | null {
  const probe = `${label} ${url}`.toLowerCase()
  if (probe.includes("report") && probe.includes("incident")) return "/hse/incidents/new"
  if (probe.includes("contact") && (probe.includes("hse") || probe.includes("control room"))) {
    return "/contacts/control-room"
  }
  if (probe.includes("gas leak") || (probe.includes("protocol") && probe.includes("gas"))) {
    return "/hse/protocols/gas-leak"
  }
  if (probe.includes("methanol") && probe.includes("inventory")) return "/inventory/methanol"
  if (probe.includes("inventory")) return "/inventory/methanol"
  if (probe.includes("appointment") || probe.includes("slot")) return "/schedule"
  if (probe.includes("queue")) return "/terminal/queue"
  if (probe.includes("bay status") || (probe.includes("view") && probe.includes("bay"))) return "/terminal/bays"
  if (probe.includes("document") || probe.includes("upload")) return "/client/documents"
  if (probe.includes("incident")) return "/hse/incidents"
  if (probe.includes("hse")) return "/hse"
  if (probe.includes("dashboard")) return "/dashboard"
  return null
}

function parseToInternalPath(inputUrl: string): { path: string | null; rejectedExternalHost: boolean } {
  const raw = inputUrl.trim()
  if (!raw) return { path: null, rejectedExternalHost: false }

  if (raw.startsWith("/")) return { path: raw, rejectedExternalHost: false }

  try {
    const parsed = new URL(raw)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      const host = parsed.hostname.toLowerCase()
      if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) {
        return { path: `${parsed.pathname}${parsed.search}${parsed.hash}`, rejectedExternalHost: false }
      }
      return { path: null, rejectedExternalHost: true }
    }
  } catch {
    // Treat as a relative-ish token below.
  }

  return { path: normalizePath(raw), rejectedExternalHost: false }
}

export function guardAssistAction(action: RawAction): GuardedAction {
  const rawLabel = action.label?.trim() || "Open"
  const rawUrl = action.href?.trim() || action.url?.trim() || ""
  const tooltip = action.tooltip?.trim() || `Open ${rawLabel}`

  const inferred = knownRouteFromText(rawLabel, rawUrl)
  const parsed = parseToInternalPath(rawUrl)
  const candidatePath = normalizePath(inferred || parsed.path || SUPPORT_ROUTE)

  if (isInternalAllowedRoute(candidatePath)) {
    return { label: rawLabel, href: candidatePath, tooltip, replaced: false }
  }

  const reason = parsed.rejectedExternalHost
    ? "Blocked external host. Redirected to support."
    : "Requested page is not available. Redirected to support."

  if (process.env.NODE_ENV !== "production") {
    console.warn("[assist-route-guard] replaced invalid action", { rawLabel, rawUrl, candidatePath, reason })
  }

  return {
    label: SUPPORT_LABEL,
    href: SUPPORT_ROUTE,
    tooltip: "Fallback link because target page is unavailable.",
    replaced: true,
    replacementReason: reason,
  }
}

export function guardAssistActions(actions: RawAction[]): GuardedAction[] {
  return actions.map(guardAssistAction)
}
