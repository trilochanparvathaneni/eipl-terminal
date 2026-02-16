/**
 * Deterministic heuristic rule-engine for bay assignment and queue resequencing.
 *
 * These functions run without any AI call and serve as the baseline (or fallback)
 * when AI_ENABLED is false or the Claude call fails.
 */

import type {
  BayRecommendationItem,
  QueueResequenceOutput,
} from '@/lib/ai/schemas'

// ── Input types consumed by the heuristics ──────────────────────────────────

export interface TruckCandidate {
  truckTripId: string
  bookingProductId: string
  priorityClass: 'APPOINTMENT' | 'FCFS' | 'RECLASSIFIED' | 'BLOCKED'
  readyForBayAt: Date | null
  appointmentStart: Date | null
  appointmentEnd: Date | null
  lateToleranceMinutes: number
  etaMinutes: number | null
  queuePosition: number | null
}

export interface BayCandidate {
  bayId: string
  bayName: string
  status: 'IDLE' | 'OCCUPIED' | 'BLOCKED' | 'MAINTENANCE'
  currentProductId: string | null
  lastProductId: string | null
  changeoverState: string
  allowedMode: string
  nextAvailableAt: Date
  compatibleProductIds: string[]
}

export interface CompatibilityRule {
  fromProductId: string
  toProductId: string
  isCompatible: boolean
  requiresFullClearance: boolean
  minClearanceMinutes: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ── Bay Assignment Heuristics ───────────────────────────────────────────────

/**
 * For each ready truck, find the best available bay using a simple scoring
 * model:
 *   +100  bay is IDLE right now
 *   +50   bay already has the same product loaded (no changeover)
 *   +30   bay is compatible with the product (via ProductBayMap)
 *   -20   bay needs changeover
 *   -999  bay is in MAINTENANCE or BLOCKED
 *
 * Each truck gets at most one recommendation. Bays can only appear once.
 */
export function heuristicBayRecommendations(
  trucks: TruckCandidate[],
  bays: BayCandidate[],
  compatibilityRules: CompatibilityRule[],
): BayRecommendationItem[] {
  const results: BayRecommendationItem[] = []
  const assignedBayIds = new Set<string>()

  // Sort trucks: APPOINTMENT first, then RECLASSIFIED, then FCFS; within each
  // class, earliest readyForBayAt wins.
  const sortedTrucks = [...trucks]
    .filter((t) => t.priorityClass !== 'BLOCKED' && t.readyForBayAt !== null)
    .sort((a, b) => {
      const classOrder = { APPOINTMENT: 0, RECLASSIFIED: 1, FCFS: 2, BLOCKED: 3 }
      const diff = classOrder[a.priorityClass] - classOrder[b.priorityClass]
      if (diff !== 0) return diff
      return (a.readyForBayAt?.getTime() ?? 0) - (b.readyForBayAt?.getTime() ?? 0)
    })

  for (const truck of sortedTrucks) {
    let bestBay: BayCandidate | null = null
    let bestScore = -Infinity
    const reasonCodes: string[] = []

    for (const bay of bays) {
      if (assignedBayIds.has(bay.bayId)) continue

      let score = 0
      const localReasons: string[] = []

      // Unavailable bays
      if (bay.status === 'MAINTENANCE' || bay.status === 'BLOCKED') {
        score = -999
        localReasons.push('bay_unavailable')
      } else {
        // Product compatibility check
        const isCompatible = bay.compatibleProductIds.includes(truck.bookingProductId)
        if (!isCompatible) continue // skip incompatible bays entirely

        if (bay.status === 'IDLE') {
          score += 100
          localReasons.push('bay_idle')
        }

        // Same product -- no changeover needed
        if (bay.currentProductId === truck.bookingProductId) {
          score += 50
          localReasons.push('same_product')
        } else if (bay.lastProductId === truck.bookingProductId) {
          score += 30
          localReasons.push('last_product_match')
        } else if (bay.currentProductId && bay.currentProductId !== truck.bookingProductId) {
          // Check compatibility rules for changeover
          const rule = compatibilityRules.find(
            (r) =>
              r.fromProductId === bay.currentProductId &&
              r.toProductId === truck.bookingProductId,
          )
          if (rule && !rule.isCompatible) {
            score -= 100
            localReasons.push('incompatible_changeover')
          } else if (rule && rule.requiresFullClearance) {
            score -= 20
            localReasons.push('changeover_clearance_needed')
          } else {
            score += 10
            localReasons.push('compatible_changeover')
          }
        }

        // Prefer bays that are available sooner
        const now = new Date()
        if (bay.nextAvailableAt <= now) {
          score += 20
          localReasons.push('available_now')
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestBay = bay
        reasonCodes.length = 0
        reasonCodes.push(...localReasons)
      }
    }

    if (bestBay && bestScore > -999) {
      assignedBayIds.add(bestBay.bayId)
      const confidence = Math.min(1, Math.max(0, (bestScore + 100) / 300))
      results.push({
        truck_trip_id: truck.truckTripId,
        suggested_bay_id: bestBay.bayId,
        bay_current_product_id: bestBay.currentProductId,
        changeover_state: bestBay.changeoverState,
        reason_codes: reasonCodes,
        confidence: Math.round(confidence * 100) / 100,
      })
    }
  }

  return results
}

// ── Queue Resequence Heuristics ─────────────────────────────────────────────

/**
 * Reorder the ready queue and identify at-risk trucks:
 * - APPOINTMENT trucks whose predicted start exceeds their appointmentEnd + tolerance
 *   are marked at-risk.
 * - Trucks are sorted by priority class, then by readyForBayAt.
 * - A new queue position and predicted start time are assigned.
 */
export function heuristicQueueResequence(
  trucks: TruckCandidate[],
  bays: BayCandidate[],
): QueueResequenceOutput {
  const now = new Date()

  // Calculate estimated service rate: how many bays could become available per hour
  const idleBays = bays.filter((b) => b.status === 'IDLE').length
  const occupiedBays = bays.filter((b) => b.status === 'OCCUPIED')

  // Average minutes until next bay frees up; fallback to 30 min if no data
  const avgServiceMinutes = 60
  const activeBayCount = Math.max(1, idleBays + occupiedBays.length)

  // Sort trucks: APPOINTMENT first (preserve deadline urgency), then RECLASSIFIED, then FCFS
  const sortedTrucks = [...trucks]
    .filter((t) => t.priorityClass !== 'BLOCKED' && t.readyForBayAt !== null)
    .sort((a, b) => {
      const classOrder = { APPOINTMENT: 0, RECLASSIFIED: 1, FCFS: 2, BLOCKED: 3 }
      const diff = classOrder[a.priorityClass] - classOrder[b.priorityClass]
      if (diff !== 0) return diff
      return (a.readyForBayAt?.getTime() ?? 0) - (b.readyForBayAt?.getTime() ?? 0)
    })

  const atRiskTrucks: QueueResequenceOutput['at_risk_trucks'] = []
  const resequencing: QueueResequenceOutput['resequencing'] = []

  for (let i = 0; i < sortedTrucks.length; i++) {
    const truck = sortedTrucks[i]
    // Estimate when this truck will start loading: depends on how many trucks are ahead
    const slotsAhead = Math.floor(i / activeBayCount)
    const predictedStartMs = now.getTime() + slotsAhead * avgServiceMinutes * 60_000
    const predictedStart = new Date(predictedStartMs)

    const reasonCodes: string[] = []
    const riskFlags: string[] = []

    // Check appointment risk
    if (truck.priorityClass === 'APPOINTMENT' && truck.appointmentEnd) {
      const deadline = new Date(
        truck.appointmentEnd.getTime() + truck.lateToleranceMinutes * 60_000,
      )
      if (predictedStart > deadline) {
        riskFlags.push('appointment_miss')
        reasonCodes.push('predicted_past_deadline')
      } else if (predictedStart > truck.appointmentEnd) {
        riskFlags.push('appointment_late_but_tolerated')
        reasonCodes.push('within_tolerance')
      }
    }

    // Check long-wait risk (>2 hours estimated)
    const waitMs = predictedStartMs - now.getTime()
    if (waitMs > 2 * 60 * 60_000) {
      riskFlags.push('long_wait')
      reasonCodes.push('wait_exceeds_2h')
    }

    if (riskFlags.length > 0) {
      atRiskTrucks.push({
        truck_trip_id: truck.truckTripId,
        risk_flags: riskFlags,
        confidence: 0.7,
      })
    }

    resequencing.push({
      truck_trip_id: truck.truckTripId,
      new_predicted_start_time: predictedStart.toISOString(),
      updated_queue_position: i + 1,
      reason_codes: reasonCodes.length > 0 ? reasonCodes : ['standard_order'],
      confidence: 0.8,
    })
  }

  return { at_risk_trucks: atRiskTrucks, resequencing }
}

// ── Bay Assignment Validation ───────────────────────────────────────────────

/**
 * Validate whether a specific truck can be assigned to a specific bay.
 * Used by the apply-assignment endpoint before committing.
 */
export function validateBayAssignment(
  truck: TruckCandidate,
  bay: BayCandidate,
  compatibilityRules: CompatibilityRule[],
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Bay must not be in maintenance or blocked
  if (bay.status === 'MAINTENANCE') {
    errors.push('Bay is currently under maintenance')
  }
  if (bay.status === 'BLOCKED') {
    errors.push('Bay is currently blocked')
  }

  // Product must be compatible with bay
  if (!bay.compatibleProductIds.includes(truck.bookingProductId)) {
    errors.push(`Product ${truck.bookingProductId} is not compatible with bay ${bay.bayName}`)
  }

  // Check contamination / changeover rules
  if (bay.currentProductId && bay.currentProductId !== truck.bookingProductId) {
    const rule = compatibilityRules.find(
      (r) =>
        r.fromProductId === bay.currentProductId &&
        r.toProductId === truck.bookingProductId,
    )
    if (rule && !rule.isCompatible) {
      errors.push(
        `Product changeover from ${bay.currentProductId} to ${truck.bookingProductId} is not allowed`,
      )
    } else if (rule && rule.requiresFullClearance) {
      warnings.push(
        `Changeover requires full clearance (${rule.minClearanceMinutes} min)`,
      )
    }
  }

  // Truck must not be blocked
  if (truck.priorityClass === 'BLOCKED') {
    errors.push('Truck is currently blocked and cannot be assigned')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
