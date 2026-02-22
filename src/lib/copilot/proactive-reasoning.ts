import type { ChatAction } from "./response-builder"
import type { FormattedAnswer } from "./tool-registry"

type FetchInternalJson = (endpoint: string) => Promise<any | null>

interface ProactiveInput {
  toolId: string
  primaryData: any
  fetchedAt: Date
  rawQuery?: string
  fetchInternalJson: FetchInternalJson
}

function parseTruckQuantity(rawQuery?: string): number | null {
  if (!rawQuery) return null
  const match = rawQuery.toLowerCase().match(/\b(\d+)\s*trucks?\b/)
  if (!match) return null
  const count = Number.parseInt(match[1], 10)
  return Number.isFinite(count) && count > 0 ? count : null
}

function elapsedMinutes(fromIso: string | Date | null | undefined, now: Date): number | null {
  if (!fromIso) return null
  const from = new Date(fromIso)
  if (Number.isNaN(from.getTime())) return null
  return Math.floor((now.getTime() - from.getTime()) / 60000)
}

export async function applyProactiveReasoning(
  input: ProactiveInput
): Promise<Pick<FormattedAnswer, "breakdown" | "recommendedActions" | "actions"> | null> {
  const now = input.fetchedAt
  const additions: string[] = []
  const recommended: string[] = []
  const actions: ChatAction[] = []

  if (input.toolId === "dashboard_stats") {
    const trucksInYard = Number(input.primaryData?.inTerminal ?? 0)
    const tripsScheduled = Number(input.primaryData?.todayTrips ?? 0)

    if (trucksInYard > 0 && tripsScheduled === 0) {
      const incidents = await input.fetchInternalJson("/api/incidents?status=OPEN&limit=5")
      const safety = await input.fetchInternalJson("/api/reports/safety")
      const aiPlan = await input.fetchInternalJson("/api/ai/plan")

      const openIncidents: any[] = Array.isArray(incidents?.incidents) ? incidents.incidents : []
      const activeStopWork = Number(safety?.stopWorkOrders?.active ?? 0)
      const pendingChecklists = Object.entries(safety?.checklists ?? {}).reduce((sum, [status, count]) => {
        return status.toUpperCase().includes("PENDING") ? sum + Number(count || 0) : sum
      }, 0)
      const equipmentAlerts: any[] = Array.isArray(aiPlan?.alerts) ? aiPlan.alerts : []
      const equipmentBlocker = equipmentAlerts.find((a) => {
        const msg = String(a?.message ?? "").toLowerCase()
        return msg.includes("clearance") || msg.includes("bay") || msg.includes("relay") || msg.includes("gantry")
      })

      let blockerText = "no immediate blocker signal was found in safety/compliance/equipment feeds"
      if (openIncidents.length > 0) {
        const inc = openIncidents[0]
        blockerText = `open safety incident ${inc?.id ?? "N/A"}`
        additions.push(
          `[STATUS] ${trucksInYard} trucks are in the yard with 0 scheduled trips; movement is blocked by ${blockerText}.`
        )
        additions.push(
          `[INSIGHT] Contradiction detected: trucks are present but throughput is zero, aligned with ${openIncidents.length} open incident(s).`
        )
        recommended.push("Open incident log and close blocking safety events")
        actions.push({ id: "proactive-open-incidents", label: "Open Incident Log", href: "/hse" })
      } else if (activeStopWork > 0 || pendingChecklists > 0) {
        blockerText = activeStopWork > 0
          ? `${activeStopWork} active stop-work order(s)`
          : `${pendingChecklists} pending compliance checklist(s)`
        additions.push(
          `[STATUS] ${trucksInYard} trucks are waiting and allotment is paused by ${blockerText}.`
        )
        additions.push(
          `[INSIGHT] Safety/compliance controls are preventing dispatch despite available yard inventory.`
        )
        recommended.push("Resolve pending PESO/OISD compliance checks before allotment release")
        actions.push({ id: "proactive-open-hse", label: "Open HSE Module", href: "/hse" })
      } else if (equipmentBlocker) {
        blockerText = String(equipmentBlocker.message)
        additions.push(
          `[STATUS] ${trucksInYard} trucks are waiting with zero trips due to an equipment bottleneck.`
        )
        additions.push(`[INSIGHT] Equipment signal: ${blockerText}`)
        recommended.push("Review bay/equipment readiness and apply controller recommendation")
        actions.push({ id: "proactive-open-controller", label: "Open Controller Console", href: "/controller/console" })
      } else {
        additions.push(
          `[STATUS] ${trucksInYard} trucks are in yard and no trips are scheduled.`
        )
        additions.push(
          "[INSIGHT] Bottleneck detected but blocker source is currently inconclusive; verify safety incidents, compliance checklist, then equipment status."
        )
      }
    }
  }

  if (input.toolId === "controller_state" || input.toolId === "ai_plan" || input.toolId === "gate_today") {
    const controller = input.toolId === "controller_state"
      ? input.primaryData
      : await input.fetchInternalJson("/api/controller/state")
    const queue: any[] = Array.isArray(controller?.readyQueue) ? controller.readyQueue : []
    const longWait = queue
      .map((trip) => {
        const wait = elapsedMinutes(trip?.readyForBayAt ?? trip?.appointmentStart ?? null, now)
        return { trip, wait }
      })
      .filter((x) => (x.wait ?? 0) > 60)
      .sort((a, b) => (b.wait ?? 0) - (a.wait ?? 0))

    if (longWait.length > 0) {
      const top = longWait[0]
      const truckNo = top.trip?.truckNumber ?? "unknown truck"
      const waitMinutes = top.wait ?? 0
      additions.push(
        `[STATUS] Bottleneck alert: ${longWait.length} truck(s) have waited over 60 minutes without allotment.`
      )
      additions.push(
        `[INSIGHT] Oldest wait is ${truckNo} at ${waitMinutes} minutes, indicating a queue-to-bay assignment gap.`
      )
      recommended.push("Run immediate bay readiness recheck and re-sequence queued trucks")
      actions.push({
        id: "proactive-resequence",
        label: "Open Controller Console",
        href: "/controller/console",
      })
    }

    const requestedQty = parseTruckQuantity(input.rawQuery)
    if (requestedQty && queue.length > 0) {
      const sample = queue.slice(0, requestedQty).map((t) => {
        const wait = elapsedMinutes(t?.readyForBayAt ?? null, now)
        const flags = Array.isArray(t?.riskFlags) && t.riskFlags.length > 0
          ? t.riskFlags.join(", ")
          : "compliance verification pending"
        return `${t.truckNumber}: waited ${wait ?? 0} min, compliance ${flags}`
      })
      additions.push(
        `[INSIGHT] Unit-level status requested: ${sample.join(" | ")}`
      )
    }
  }

  // ── Rule B: PESO/OISD Compliance Gatekeeper ──────────────────────────────
  // Flag trucks at the gantry gate that are held due to compliance violations
  // (active stop-work orders or riskFlag markers). These are the primary cause
  // of gate delays and must surface before the operator asks about them.
  if (input.toolId === "gate_today") {
    const trips: any[] = Array.isArray(input.primaryData) ? input.primaryData : []

    const stopWorkBlocked = trips.filter((t) =>
      Array.isArray(t?.booking?.stopWorkOrders) && t.booking.stopWorkOrders.length > 0
    )

    const riskFlagged = trips.filter((t) => {
      const flags: unknown[] = Array.isArray(t?.riskFlags) ? t.riskFlags : []
      return flags.some(
        (f) =>
          typeof f === "string" &&
          (f.toLowerCase().includes("document") ||
            f.toLowerCase().includes("compliance") ||
            f.toLowerCase().includes("expired") ||
            f.toLowerCase().includes("safety"))
      )
    })

    // De-duplicate by trip id
    const blockedIds = new Set([
      ...stopWorkBlocked.map((t) => t.id),
      ...riskFlagged.map((t) => t.id),
    ])

    if (blockedIds.size > 0) {
      const primaryTrip = stopWorkBlocked[0] ?? riskFlagged[0]
      const truckNo = primaryTrip?.truckNumber ?? "unknown truck"
      const gantryName =
        primaryTrip?.booking?.bayAllocations?.[0]?.bay?.gantry?.name ?? "gantry"

      additions.push(
        `[STATUS] PESO/OISD compliance hold: ${blockedIds.size} truck(s) at the ${gantryName} are blocked due to active compliance violations.`
      )
      additions.push(
        `[INSIGHT] Primary hold: ${truckNo} — stop-work order or document verification pending. Gate release is blocked until compliance is cleared.`
      )
      recommended.push("Clear active stop-work orders in HSE module before issuing gate release")
      recommended.push("Verify PESO/OISD documentation for all held trucks")
      actions.push({
        id: "proactive-compliance-gate",
        label: "Verify PESO/OISD Compliance",
        href: "/hse",
        primary: true,
      })
    }
  }

  // ── Rule C: Horton Sphere Capacity Alert ──────────────────────────────────
  // Pre-emptively warn on high Horton Sphere fill (>90%) or critically low
  // inventory (<10%) before the operator asks about storage status.
  if (input.toolId === "inventory_summary") {
    const pct = Number(input.primaryData?.lpgLevelPercentage ?? 0)
    const lpgKL = Number(input.primaryData?.lpgLevelKL ?? 0)
    const capacityKL = Number(input.primaryData?.hortonSphereCapacityKL ?? 10_000)

    if (pct > 90) {
      additions.push(
        `[STATUS] Horton Sphere high-capacity alert: LPG storage at ${pct}% fill (${lpgKL.toFixed(1)} KL of ${capacityKL} KL rated capacity).`
      )
      additions.push(
        `[INSIGHT] Decanting and earthing relay checks are mandatory before any further product receipt at this fill level. Dispatch throughput must be maximised to reduce sphere load.`
      )
      recommended.push("Verify earthing relay continuity before next loading arm activation")
      recommended.push("Prioritise dispatch scheduling to draw down Horton Sphere fill")
      actions.push({
        id: "proactive-inventory-high",
        label: "Open Reports",
        href: "/reports",
        primary: true,
      })
    } else if (pct < 10 && lpgKL >= 0) {
      additions.push(
        `[STATUS] Horton Sphere critically low: LPG inventory at ${pct}% (${lpgKL.toFixed(1)} KL remaining) — risk of loading halt if replenishment is not actioned.`
      )
      additions.push(
        `[INSIGHT] Pending bookings may not be fulfilled. Initiate LPG replenishment scheduling immediately to prevent decanting operations from stalling.`
      )
      recommended.push("Initiate emergency LPG replenishment schedule with sourcing team")
      recommended.push("Review pending bookings for fulfilment risk and notify affected clients")
      actions.push({
        id: "proactive-inventory-low",
        label: "Open Bookings",
        href: "/bookings",
        primary: true,
      })
    }
  }

  if (additions.length === 0 && actions.length === 0 && recommended.length === 0) {
    return null
  }

  return {
    breakdown: additions,
    recommendedActions: recommended,
    actions,
  }
}
