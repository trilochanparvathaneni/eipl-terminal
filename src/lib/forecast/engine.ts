/**
 * EIPL Terminal Ops — Deterministic Forecast Engine
 *
 * Approach: discrete-time simulation with 5-minute ticks, aggregated into
 * 30-minute output buckets over a 2-hour horizon.
 *
 * All maths uses expected-value (deterministic) flow rates — no randomness —
 * so results are reproducible, fast (<5 ms typical), and fully explainable.
 *
 * Stage service times (from operational facts):
 *   Weighbridge : 2.5 min avg  (2 bridges → not a bottleneck)
 *   Inspection  : 7.5 min avg  (range 5–10 min)
 *   Docs clear  : 4 min (OK) / 22 min (delayed)
 *   Loading     : avgLoadingMinutes param (range 45–60, default 52)
 *   Exit        : 3 min
 *
 * Yard constants:
 *   Total bays  : 18  (G1=8, G2=4, G3-LPG=6)
 *   Inside limit: 8 trucks
 *   Outside limit: 15 trucks
 */

import type {
  ForecastInput,
  ForecastResult,
  ForecastBucket,
  ForecastParams,
  CongestionDriver,
  Recommendation,
  ScheduledTruck,
} from './types'

// ── Terminal constants ────────────────────────────────────────────────────────

const TOTAL_BAYS_DEFAULT = 18
const INSIDE_LIMIT_DEFAULT = 8
const OUTSIDE_LIMIT_DEFAULT = 15

// ── Stage service times (minutes) ─────────────────────────────────────────────

const WEIGHBRIDGE_MIN = 2.5
const INSPECTION_MIN = 7.5
const DOCS_NORMAL_MIN = 4
const DOCS_DELAYED_MIN = 22
const EXIT_MIN = 3
const GATE_SERVICE_MIN = WEIGHBRIDGE_MIN + INSPECTION_MIN // 10 min per truck per bridge

// ── Simulation resolution ─────────────────────────────────────────────────────

const TICK_MIN = 5       // simulation tick width (minutes)
const BUCKET_MIN = 30    // output bucket width (minutes)
const BUCKET_COUNT = 4   // 4 × 30 min = 2-hour horizon
const TICKS = (BUCKET_COUNT * BUCKET_MIN) / TICK_MIN          // 24 ticks
const TICKS_PER_BUCKET = BUCKET_MIN / TICK_MIN                // 6 ticks per bucket
// Gate: 2 weighbridges in parallel, each serves one truck every GATE_SERVICE_MIN
const GATE_THROUGHPUT_PER_TICK = (2 * TICK_MIN) / GATE_SERVICE_MIN // ~1.0 trucks/tick

// ── Arrival probability model ─────────────────────────────────────────────────

/**
 * For a truck whose slot window is [slotStart, slotEnd] (minutes from now),
 * returns the expected fraction of that truck arriving in the window
 * [wStart, wEnd].
 *
 * Three-band triangular mixture:
 *   On-time  (slotAdherencePct × 55%)  → uniform in [slotStart, slotEnd]
 *   Early    (15%)                     → uniform in [slotStart−45, slotStart]
 *   Late     (slotAdherencePct × 30%)  → uniform in [slotEnd, slotEnd+60]
 *   No-show  (remainder)               → handled via rejectionPct separately
 */
function arrivalProbInWindow(
  slotStart: number,
  slotEnd: number,
  wStart: number,
  wEnd: number,
  params: ForecastParams,
): number {
  const adherence = params.slotAdherencePct / 100
  const onTimeFrac = adherence * 0.55
  const earlyFrac = 0.15
  const lateFrac = adherence * 0.30

  function uniformOverlap(bandStart: number, bandEnd: number): number {
    const width = bandEnd - bandStart
    if (width <= 0) return 0
    const oStart = Math.max(bandStart, wStart)
    const oEnd = Math.min(bandEnd, wEnd)
    if (oEnd <= oStart) return 0
    return (oEnd - oStart) / width
  }

  return (
    onTimeFrac * uniformOverlap(slotStart, slotEnd) +
    earlyFrac  * uniformOverlap(slotStart - 45, slotStart) +
    lateFrac   * uniformOverlap(slotEnd, slotEnd + 60)
  )
}

// ── Discrete-time simulation state ───────────────────────────────────────────

interface SimState {
  outsideQueue: number // trucks waiting outside gate
  insideYard: number   // trucks inside yard (not yet at a bay)
  inDocs: number       // subset of insideYard blocked on doc verification
  inLoading: number    // trucks currently at a bay (= bays occupied)
  totalCompleted: number
}

interface TickOutput {
  state: SimState
  netArrivals: number
  completed: number
}

/**
 * Advance simulation by one TICK_MIN period.
 *
 * All quantities are fractional "expected" trucks, not integers.
 * This keeps the simulation smooth and deterministic.
 */
function stepTick(
  state: SimState,
  rawArrivals: number,
  params: ForecastParams,
  totalBays: number,
  insideLimit: number,
  outsideLimit: number,
): TickOutput {
  const LOADING_MIN = params.avgLoadingMinutes

  // 1. Loading completions (fraction of in-loading trucks finishing this tick)
  const loadingCompletions = state.inLoading * (TICK_MIN / LOADING_MIN)

  // 2. Docs clearance (fraction of docs-blocked trucks unblocking)
  const docsClearing = state.inDocs * (TICK_MIN / DOCS_DELAYED_MIN)

  // 3. Bay assignments from ready-in-yard trucks (not in docs)
  const readyInYard = Math.max(0, state.insideYard - state.inDocs)
  const currentlyLoading = Math.max(0, state.inLoading - loadingCompletions)
  const availableBays = Math.max(0, totalBays - currentlyLoading)
  const bayAssigned = Math.min(readyInYard, availableBays)

  // 4. Gate processing: move trucks outside → inside
  const yardSpace = Math.max(0, insideLimit - state.insideYard)
  const entering = Math.min(
    GATE_THROUGHPUT_PER_TICK,
    state.outsideQueue,
    yardSpace,
  )
  const newDocsStuck = entering * (params.docsDelayPct / 100)

  // 5. New arrivals filtered by rejection rate
  const netArrivals = rawArrivals * (1 - params.rejectionPct / 100)
  const newOutsideRaw = state.outsideQueue - entering + netArrivals
  const newOutside = Math.min(outsideLimit, Math.max(0, newOutsideRaw))

  const newState: SimState = {
    outsideQueue: newOutside,
    insideYard: Math.max(0, state.insideYard + entering - bayAssigned),
    inDocs: Math.max(0, state.inDocs + newDocsStuck - docsClearing),
    inLoading: Math.max(
      0,
      Math.min(totalBays, currentlyLoading + bayAssigned),
    ),
    totalCompleted: state.totalCompleted + loadingCompletions,
  }

  return { state: newState, netArrivals, completed: loadingCompletions }
}

// ── Average turnaround calculation ────────────────────────────────────────────

function avgTurnaround(params: ForecastParams, queueWaitMin: number): number {
  const docAvg =
    (params.docsDelayPct / 100) * DOCS_DELAYED_MIN +
    (1 - params.docsDelayPct / 100) * DOCS_NORMAL_MIN
  return (
    WEIGHBRIDGE_MIN +
    INSPECTION_MIN +
    docAvg +
    queueWaitMin +
    params.avgLoadingMinutes +
    EXIT_MIN
  )
}

// ── Bucket label helper ────────────────────────────────────────────────────────

function bucketLabel(now: Date, startMin: number, endMin: number): string {
  const fmt = (d: Date) =>
    `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
  const s = new Date(now.getTime() + startMin * 60_000)
  const e = new Date(now.getTime() + endMin * 60_000)
  return `${fmt(s)}–${fmt(e)}`
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Compute a 2-hour forecast with 30-minute resolution.
 *
 * Pure function — no I/O, no randomness, <10 ms for typical inputs.
 * Can be called on both server and client (simulation mode).
 */
export function computeForecast(input: ForecastInput): ForecastResult {
  const {
    now,
    params,
    scheduledTrucks,
    currentBayOccupancy,
    currentInsideYard,
    currentOutsideQueue,
  } = input

  const totalBays   = input.totalBays        ?? TOTAL_BAYS_DEFAULT
  const insideLimit = input.insideYardLimit  ?? INSIDE_LIMIT_DEFAULT
  const outsideLimit = input.outsideQueueLimit ?? OUTSIDE_LIMIT_DEFAULT

  // ── Pre-compute expected arrivals per tick ──────────────────────────────

  const arrivalsPerTick: number[] = Array<number>(TICKS).fill(0)
  for (const truck of scheduledTrucks) {
    if (truck.isAlreadyInTerminal) continue
    for (let t = 0; t < TICKS; t++) {
      const wStart = t * TICK_MIN
      const wEnd = wStart + TICK_MIN
      arrivalsPerTick[t] += arrivalProbInWindow(
        truck.slotStartMinutesFromNow,
        truck.slotEndMinutesFromNow,
        wStart,
        wEnd,
        params,
      )
    }
  }

  // ── Run simulation ──────────────────────────────────────────────────────

  const docsEstimate = Math.round(
    currentInsideYard * (params.docsDelayPct / 100) * 0.5,
  )

  let state: SimState = {
    outsideQueue: currentOutsideQueue,
    insideYard: currentInsideYard,
    inDocs: docsEstimate,
    inLoading: currentBayOccupancy,
    totalCompleted: 0,
  }

  // Store one state snapshot per tick boundary (TICKS + 1 snapshots)
  const tickStates: SimState[] = [{ ...state }]
  const tickOutputs: TickOutput[] = []

  for (let t = 0; t < TICKS; t++) {
    const out = stepTick(
      state,
      arrivalsPerTick[t],
      params,
      totalBays,
      insideLimit,
      outsideLimit,
    )
    tickOutputs.push(out)
    tickStates.push({ ...out.state })
    state = out.state
  }

  // ── Aggregate into 30-min buckets ───────────────────────────────────────

  const buckets: ForecastBucket[] = []

  for (let b = 0; b < BUCKET_COUNT; b++) {
    const startTick = b * TICKS_PER_BUCKET
    const endTick = startTick + TICKS_PER_BUCKET

    // State snapshots at each tick boundary within this bucket
    const bStates = tickStates.slice(startTick, endTick + 1)
    const bOutputs = tickOutputs.slice(startTick, endTick)

    const n = bStates.length
    const avgOutside  = bStates.reduce((s, t) => s + t.outsideQueue, 0) / n
    const avgInside   = bStates.reduce((s, t) => s + t.insideYard,   0) / n
    const avgLoading  = bStates.reduce((s, t) => s + t.inLoading,    0) / n
    const totalArrivals  = bOutputs.reduce((s, o) => s + o.netArrivals, 0)
    const totalCompleted = bOutputs.reduce((s, o) => s + o.completed,   0)

    // Estimated queue wait: how long a truck waits in yard before getting a bay
    const idleBays = Math.max(0, totalBays - avgLoading)
    const queueWaitMin =
      idleBays > 0
        ? 0
        : (Math.max(0, avgInside - docsEstimate) / Math.max(1, totalBays)) *
          params.avgLoadingMinutes

    const startMin = b * BUCKET_MIN
    const endMin   = startMin + BUCKET_MIN

    const adherence = params.slotAdherencePct / 100
    buckets.push({
      label: bucketLabel(now, startMin, endMin),
      bucketStartMinutesFromNow: startMin,
      bucketEndMinutesFromNow: endMin,
      expectedArrivals: Math.round(totalArrivals * 10) / 10,
      earlyFraction:   0.15,
      onTimeFraction:  adherence * 0.55,
      lateFraction:    adherence * 0.30,
      queueOutside:    Math.round(avgOutside  * 10) / 10,
      queueInside:     Math.round(avgInside   * 10) / 10,
      baysOccupied:    Math.round(avgLoading),
      bayOccupancyPct: Math.round((avgLoading / totalBays) * 100),
      avgTurnaroundMinutes: Math.round(avgTurnaround(params, queueWaitMin)),
      trucksCompleted: Math.round(totalCompleted * 10) / 10,
      outsideOverflow: avgOutside > outsideLimit * 0.80,
      insideOverflow:  avgInside  > insideLimit  * 0.80,
    })
  }

  // ── Congestion score (0–100, weighted sum of four components) ───────────

  const peakOutside   = Math.max(...buckets.map((b) => b.queueOutside))
  const peakInside    = Math.max(...buckets.map((b) => b.queueInside))
  const peakOccupancy = Math.max(...buckets.map((b) => b.bayOccupancyPct))
  const peakTurnaround = Math.max(...buckets.map((b) => b.avgTurnaroundMinutes))

  // Normalised per-component scores, weights sum to 1.0
  const outsideScore    = Math.min(1, peakOutside   / outsideLimit)      * 30
  const insideScore     = Math.min(1, peakInside    / insideLimit)       * 25
  const bayScore        = Math.min(1, peakOccupancy / 100)               * 25
  const turnaroundScore = Math.min(1, Math.max(0, (peakTurnaround - 60) / 120)) * 20

  const congestionScore = Math.min(
    100,
    Math.round(outsideScore + insideScore + bayScore + turnaroundScore),
  )

  // ── Congestion drivers (up to 3) ────────────────────────────────────────

  const rawDrivers: CongestionDriver[] = []

  if (params.docsDelayPct > 10) {
    rawDrivers.push({
      factor: 'Documentation Delays',
      contributionPct: Math.min(100, Math.round(params.docsDelayPct * 2)),
      detail: `${params.docsDelayPct}% of trucks face doc holds (~${DOCS_DELAYED_MIN} min each). Pre-clear docs to cut turnaround.`,
    })
  }

  if (peakOutside > outsideLimit * 0.55) {
    rawDrivers.push({
      factor: 'Outside Queue Pressure',
      contributionPct: Math.round((peakOutside / outsideLimit) * 100),
      detail: `Queue peaks at ${peakOutside.toFixed(1)} trucks vs. ${outsideLimit}-truck limit outside the gate.`,
    })
  }

  if (peakOccupancy > 70) {
    rawDrivers.push({
      factor: 'Bay Saturation',
      contributionPct: Math.round(peakOccupancy),
      detail: `All ${totalBays} bays are ${peakOccupancy}% occupied at peak — no buffer for changeover or delays.`,
    })
  }

  if (peakInside > insideLimit * 0.55) {
    rawDrivers.push({
      factor: 'Inside Yard Congestion',
      contributionPct: Math.round((peakInside / insideLimit) * 100),
      detail: `Yard peaks at ${peakInside.toFixed(1)} trucks vs. ${insideLimit}-truck inside limit.`,
    })
  }

  if (params.rejectionPct > 20) {
    rawDrivers.push({
      factor: 'High Gate Rejection',
      contributionPct: Math.round(params.rejectionPct * 2),
      detail: `${params.rejectionPct}% rejection at gate wastes slot capacity and creates re-booking pressure.`,
    })
  }

  rawDrivers.sort((a, b) => b.contributionPct - a.contributionPct)
  const congestionDrivers = rawDrivers.slice(0, 3)

  // ── Recommendations ─────────────────────────────────────────────────────

  const recs: Recommendation[] = []

  if (peakOutside > outsideLimit * 0.65) {
    const capTo = Math.max(3, Math.round(totalBays / 6))
    const reduction = Math.round(peakOutside * 0.35)
    recs.push({
      id: 'slot_cap',
      type: 'slot_cap',
      title: `Cap next slot to ${capTo} trucks`,
      description: `Reduce the next 30-min booking window from the current load to ${capTo} trucks to prevent the outside queue from breaching the ${outsideLimit}-truck limit.`,
      impact: `-${reduction} trucks outside`,
      impactValue: reduction,
      priority: 'high',
    })
  }

  if (params.docsDelayPct > 15) {
    const turnaroundSaving = Math.round(
      (params.docsDelayPct / 100) * DOCS_DELAYED_MIN * 0.55,
    )
    recs.push({
      id: 'docs_preclear',
      type: 'docs_preclear',
      title: 'Pre-clear docs for next arrivals',
      description:
        'Call top clients 2 h before their slot to confirm EX-Bond, Delivery Order, and e-Way Bill are ready. Focus on clients with historically high rejection rates.',
      impact: `-${turnaroundSaving} min avg turnaround`,
      impactValue: turnaroundSaving,
      priority: params.docsDelayPct > 30 ? 'high' : 'medium',
    })
  }

  if (peakInside > insideLimit * 0.65) {
    const yardReduction = Math.round(peakInside * 0.30)
    recs.push({
      id: 'shift_trucks',
      type: 'shift_trucks',
      title: 'Shift 3–4 trucks to off-peak slot',
      description:
        'Offer the 06:00–08:00 or post-17:30 slot to 3–4 trucks booked in the busiest window. Incentivise with priority bay assignment.',
      impact: `-${yardReduction} trucks inside yard`,
      impactValue: yardReduction,
      priority: 'medium',
    })
  }

  recs.push({
    id: 'lpg_priority',
    type: 'bay_priority',
    title: 'Reserve G3 bays when LPG queue > 3',
    description:
      'Lock all 6 G3 (LPG) bays exclusively for LPG trucks when LPG queue exceeds 3 to prevent POL/chemical bays blocking LPG flow. Supports upcoming LPG capacity doubling.',
    impact: '-15 min avg LPG truck wait',
    impactValue: 15,
    priority: peakOccupancy > 85 ? 'high' : 'low',
  })

  recs.sort(
    (a, b) =>
      ({ high: 0, medium: 1, low: 2 }[a.priority] -
       { high: 0, medium: 1, low: 2 }[b.priority]),
  )

  // ── Model assumptions (human-readable) ──────────────────────────────────

  const docAvgMin = Math.round(
    (params.docsDelayPct / 100) * DOCS_DELAYED_MIN +
    (1 - params.docsDelayPct / 100) * DOCS_NORMAL_MIN,
  )
  const baseTurnaround = Math.round(avgTurnaround(params, 0))

  const modelAssumptions: string[] = [
    `Loading: ${params.avgLoadingMinutes} min avg per truck (operational range 45–60 min)`,
    `Weighbridge: ${WEIGHBRIDGE_MIN} min — 2 bridges running in parallel, not a bottleneck`,
    `Safety inspection: ${INSPECTION_MIN} min avg (range 5–10 min)`,
    `Docs: ${docAvgMin} min avg (${DOCS_DELAYED_MIN} min if delayed, ${DOCS_NORMAL_MIN} min if clear; ${params.docsDelayPct}% of trucks face delays)`,
    `Slot adherence: ${params.slotAdherencePct}% on-time, 15% early (≤45 min before), ${Math.round((params.slotAdherencePct / 100) * 30)}% late (≤60 min after)`,
    `Gate rejection rate: ${params.rejectionPct}%`,
    `Yard limits: inside ${insideLimit} trucks, outside ${outsideLimit} trucks`,
    `Bay configuration: G1=${8} POL/Chem, G2=${4} POL/Chem, G3=${6} LPG — total ${totalBays} bays`,
    `Forecast horizon: 120 min in ${BUCKET_COUNT}×${BUCKET_MIN}-min buckets, ${TICK_MIN}-min tick resolution`,
    `Model: deterministic expected-value flow simulation (no randomness)`,
    `Base turnaround (no queue wait): ${baseTurnaround} min`,
  ]

  return {
    generatedAt: now.toISOString(),
    params,
    buckets,
    congestionScore,
    congestionDrivers,
    recommendations: recs,
    modelAssumptions,
    currentState: {
      trucksOutside: currentOutsideQueue,
      trucksInside:  currentInsideYard,
      baysOccupied:  currentBayOccupancy,
      trucksInDocs:  docsEstimate,
    },
    derivedStats: {
      avgBaseTurnaroundMin: baseTurnaround,
      peakBayOccupancyPct:  peakOccupancy,
      peakOutsideQueue:     Math.round(peakOutside  * 10) / 10,
      peakInsideQueue:      Math.round(peakInside   * 10) / 10,
    },
  }
}
