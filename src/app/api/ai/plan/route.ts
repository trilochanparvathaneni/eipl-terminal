import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/ai/plan
 *
 * Generates deterministic AI recommendations from real data (no external AI needed).
 * - Matches READY_FOR_BAY trucks to compatible idle bays
 * - Scores confidence based on product match
 * - Generates at-risk flags and operational alerts
 *
 * Returns { bayRecommendations, queueResequence, alerts, computedAt }
 */
export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.AI_READ,
    headers: request.headers,
  })
  if (error) return error

  try {
    // Fetch all data needed for planning
    const [bays, trips, compatRules] = await Promise.all([
      prisma.bay.findMany({
        include: {
          currentProduct: true,
          lastProduct: true,
          productBayMaps: { where: { isActive: true }, select: { productId: true } },
        },
      }),
      prisma.truckTrip.findMany({
        where: { status: "IN_TERMINAL" },
        include: {
          booking: {
            include: {
              product: true,
              client: true,
            },
          },
        },
        orderBy: [{ queuePosition: "asc" }, { readyForBayAt: "asc" }],
      }),
      prisma.productBayMap.findMany({ where: { isActive: true } }),
    ])

    // Build compatibility lookup: bayId -> Set of allowed productIds
    const bayProductMap = new Map<string, Set<string>>()
    for (const rule of compatRules) {
      if (!bayProductMap.has(rule.bayId)) bayProductMap.set(rule.bayId, new Set())
      bayProductMap.get(rule.bayId)!.add(rule.productId)
    }

    const idleBays = bays.filter((b) => b.status === "IDLE")
    const assignedBayIds = new Set<string>()
    const assignedTripIds = new Set<string>()

    // ── Bay Recommendations ─────────────────────────────────────────────────
    const bayRecommendations: {
      truck_trip_id: string
      suggested_bay_id: string
      bay_current_product_id: string | null
      changeover_state: string
      reason_codes: string[]
      confidence: number
    }[] = []

    for (const trip of trips) {
      const productId = trip.booking.productId
      let bestBay: (typeof bays)[0] | null = null
      let bestScore = -1
      let bestReasons: string[] = []

      for (const bay of idleBays) {
        if (assignedBayIds.has(bay.id)) continue

        // Check if bay is compatible with this product
        const allowedProducts = bayProductMap.get(bay.id)
        const isAllowed = !allowedProducts || allowedProducts.size === 0 || allowedProducts.has(productId)
        if (!isAllowed) continue

        let score = 0
        const reasons: string[] = []

        // Same product currently loaded → best match, no changeover
        if (bay.currentProductId === productId) {
          score = 0.95
          reasons.push("SAME_PRODUCT")
        }
        // Empty bay (no current product) → good match
        else if (!bay.currentProductId) {
          score = 0.88
          reasons.push("EMPTY_BAY")
        }
        // Bay has a different product but is ready for changeover
        else if (bay.changeoverState === "READY_FOR_CHANGEOVER") {
          score = 0.72
          reasons.push("CHANGEOVER_READY")
        }
        // Bay has different product and needs clearance → skip
        else if (bay.currentProductId && bay.currentProductId !== productId) {
          continue
        }

        // Bonus: last product matches (bay was recently used for same product)
        if (bay.lastProductId === productId && score < 0.95) {
          score += 0.02
          reasons.push("LAST_PRODUCT_MATCH")
        }

        // Bonus: appointment priority
        if (trip.priorityClass === "APPOINTMENT") {
          reasons.push("APPOINTMENT_PRIORITY")
        }

        if (score > bestScore) {
          bestScore = score
          bestBay = bay
          bestReasons = reasons
        }
      }

      if (bestBay && bestScore > 0) {
        assignedBayIds.add(bestBay.id)
        assignedTripIds.add(trip.id)
        bayRecommendations.push({
          truck_trip_id: trip.id,
          suggested_bay_id: bestBay.id,
          bay_current_product_id: bestBay.currentProductId,
          changeover_state: bestBay.changeoverState,
          reason_codes: bestReasons,
          confidence: Math.min(bestScore, 0.99),
        })
      }
    }

    // ── At-Risk Trucks ──────────────────────────────────────────────────────
    const atRiskTrucks: {
      truck_trip_id: string
      risk_flags: string[]
      confidence: number
    }[] = []

    for (const trip of trips) {
      const flags: string[] = []

      if (trip.priorityClass === "BLOCKED") {
        flags.push("BLOCKED_STATUS")
      }

      // Approaching appointment window
      if (trip.appointmentStart) {
        const now = new Date()
        const apptStart = new Date(trip.appointmentStart)
        const minutesUntilAppt = (apptStart.getTime() - now.getTime()) / 60000
        if (minutesUntilAppt < 30 && minutesUntilAppt > -60) {
          flags.push("APPOINTMENT_APPROACHING")
        }
        if (minutesUntilAppt < 0) {
          flags.push("APPOINTMENT_OVERDUE")
        }
      }

      // Long wait
      if (trip.readyForBayAt) {
        const waitMinutes = (Date.now() - new Date(trip.readyForBayAt).getTime()) / 60000
        if (waitMinutes > 60) {
          flags.push("LONG_WAIT")
        }
      }

      // No bay assignment found by AI
      if (!assignedTripIds.has(trip.id) && flags.length === 0) {
        flags.push("NO_COMPATIBLE_BAY")
      }

      if (flags.length > 0) {
        atRiskTrucks.push({
          truck_trip_id: trip.id,
          risk_flags: flags,
          confidence: flags.includes("BLOCKED_STATUS") ? 0.99 : 0.85,
        })
      }
    }

    // ── Alerts ──────────────────────────────────────────────────────────────
    const alerts: {
      type: string
      message: string
      truckTripId?: string
      bayId?: string
      confidence: number
      reasonCodes: string[]
    }[] = []

    // Alert: idle bays with trucks waiting
    if (idleBays.length > 0 && trips.length > 0) {
      const unassignedTrips = trips.filter((t) => !assignedTripIds.has(t.id))
      if (unassignedTrips.length > 0) {
        alerts.push({
          type: "idle_bays_waiting_trucks",
          message: `${idleBays.length} idle bay(s) available but ${unassignedTrips.length} truck(s) have no compatible bay match.`,
          confidence: 0.9,
          reasonCodes: ["IDLE_BAYS_EXIST", "TRUCKS_WAITING"],
        })
      }
    }

    // Alert: blocked trucks
    const blockedTrips = trips.filter((t) => t.priorityClass === "BLOCKED")
    for (const trip of blockedTrips) {
      alerts.push({
        type: "blocked_risk",
        message: `Truck ${trip.truckNumber} is BLOCKED — requires controller intervention.`,
        truckTripId: trip.id,
        confidence: 0.99,
        reasonCodes: ["BLOCKED_STATUS"],
      })
    }

    // Alert: bays needing changeover with compatible waiting trucks
    const changeoverBays = bays.filter((b) => b.status === "IDLE" && b.changeoverState === "NEEDS_CLEARANCE")
    for (const bay of changeoverBays) {
      const waitingForBay = trips.find((t) => {
        const allowedProducts = bayProductMap.get(bay.id)
        return allowedProducts?.has(t.booking.productId)
      })
      if (waitingForBay) {
        alerts.push({
          type: "changeover_needed",
          message: `Bay ${bay.name} needs clearance — truck ${waitingForBay.truckNumber} is waiting for a compatible bay.`,
          truckTripId: waitingForBay.id,
          bayId: bay.id,
          confidence: 0.88,
          reasonCodes: ["NEEDS_CLEARANCE", "TRUCK_WAITING"],
        })
      }
    }

    // Alert: recommendations ready to apply
    for (const rec of bayRecommendations) {
      const trip = trips.find((t) => t.id === rec.truck_trip_id)
      const bay = bays.find((b) => b.id === rec.suggested_bay_id)
      if (trip && bay) {
        alerts.push({
          type: "recommendation_ready",
          message: `Assign ${trip.truckNumber} → ${bay.name} (${(rec.confidence * 100).toFixed(0)}% confidence)`,
          truckTripId: trip.id,
          bayId: bay.id,
          confidence: rec.confidence,
          reasonCodes: rec.reason_codes,
        })
      }
    }

    return NextResponse.json({
      requestId: ctx.requestId,
      bayRecommendations,
      queueResequence: {
        at_risk_trucks: atRiskTrucks,
        resequencing: [],
      },
      alerts,
      computedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to compute AI plan.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
