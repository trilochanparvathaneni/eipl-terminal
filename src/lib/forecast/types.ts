/**
 * Forecast engine public types.
 *
 * All inputs/outputs are plain JSON-serialisable objects so the engine can
 * run identically on the server (API route) and on the client (simulation
 * mode without a round-trip).
 */

// ── Adjustable parameters (Simulation Mode knobs) ────────────────────────────

export interface ForecastParams {
  /** % of trucks that arrive within their booked slot window (0–100) */
  slotAdherencePct: number
  /** % of trucks turned away at the gate (docs/licence missing) (0–100) */
  rejectionPct: number
  /** % of trucks that face a documentation hold inside yard (0–100) */
  docsDelayPct: number
  /** Average loading time per bay per truck in minutes */
  avgLoadingMinutes: number
}

export const DEFAULT_PARAMS: ForecastParams = {
  slotAdherencePct: 70,
  rejectionPct: 15,
  docsDelayPct: 25,
  avgLoadingMinutes: 52, // midpoint of 45–60 min operational range
}

// ── Input: a single truck expected today ─────────────────────────────────────

export interface ScheduledTruck {
  bookingId: string
  /** Minutes from the forecast "now" when this truck's slot opens (may be negative = slot already started) */
  slotStartMinutesFromNow: number
  /** Minutes from now when slot closes */
  slotEndMinutesFromNow: number
  /** True if the truck has already passed the gate and is counted in current state */
  isAlreadyInTerminal: boolean
  productCategory: 'LPG' | 'POL' | 'CHEMICAL'
}

// ── Output: one 30-minute forecast bucket ────────────────────────────────────

export interface ForecastBucket {
  /** Human-readable e.g. "14:00–14:30" */
  label: string
  bucketStartMinutesFromNow: number
  bucketEndMinutesFromNow: number

  // Arrivals in this window
  expectedArrivals: number
  earlyFraction: number
  onTimeFraction: number
  lateFraction: number

  // Average queue sizes across the bucket (smoothed over 6 ticks)
  queueOutside: number
  queueInside: number

  // Bay occupancy
  baysOccupied: number
  bayOccupancyPct: number

  // Performance
  avgTurnaroundMinutes: number
  trucksCompleted: number

  // Warning flags
  outsideOverflow: boolean // queue approaching outside limit
  insideOverflow: boolean  // yard approaching inside limit
}

// ── Output: congestion risk driver ───────────────────────────────────────────

export interface CongestionDriver {
  factor: string
  /** Relative contribution 0–100 (for display as a progress-bar) */
  contributionPct: number
  detail: string
}

// ── Output: an operational recommendation ────────────────────────────────────

export type RecommendationType =
  | 'slot_cap'
  | 'shift_trucks'
  | 'docs_preclear'
  | 'bay_priority'
  | 'offpeak_incentive'

export interface Recommendation {
  id: string
  type: RecommendationType
  title: string
  description: string
  /** Short human-readable impact e.g. "-12 trucks outside" */
  impact: string
  /** Numeric impact for sorting */
  impactValue: number
  priority: 'high' | 'medium' | 'low'
}

// ── Full forecast input ───────────────────────────────────────────────────────

export interface ForecastInput {
  now: Date
  params: ForecastParams
  scheduledTrucks: ScheduledTruck[]
  /** How many bays are currently occupied (0–18) */
  currentBayOccupancy: number
  /** How many trucks are currently inside the yard but not yet at a bay */
  currentInsideYard: number
  /** How many trucks are currently queuing outside the gate */
  currentOutsideQueue: number
  // Optional overrides (default to terminal constants below)
  totalBays?: number
  insideYardLimit?: number
  outsideQueueLimit?: number
}

// ── Full forecast output ──────────────────────────────────────────────────────

export interface ForecastResult {
  generatedAt: string // ISO-8601
  params: ForecastParams
  /** 4 × 30-min buckets covering the next 2 hours */
  buckets: ForecastBucket[]
  /** Overall congestion risk 0–100 */
  congestionScore: number
  /** Top 3 drivers of congestion */
  congestionDrivers: CongestionDriver[]
  recommendations: Recommendation[]
  /** Human-readable list of model assumptions for the "Why" tooltip */
  modelAssumptions: string[]
  /** Snapshot of the terminal at forecast time */
  currentState: {
    trucksOutside: number
    trucksInside: number
    baysOccupied: number
    trucksInDocs: number
  }
  derivedStats: {
    avgBaseTurnaroundMin: number
    peakBayOccupancyPct: number
    peakOutsideQueue: number
    peakInsideQueue: number
  }
}
