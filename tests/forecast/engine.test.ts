/**
 * Unit tests for the deterministic forecast engine.
 *
 * All tests use Vitest globals (describe / it / expect) — enabled via
 * vitest.config.ts { test: { globals: true } }.
 *
 * The engine is a pure function with no I/O, so every test is deterministic
 * and runs in < 1 ms.
 */

import { computeForecast } from '@/lib/forecast/engine'
import { DEFAULT_PARAMS } from '@/lib/forecast/types'
import type { ForecastInput, ForecastParams, ScheduledTruck } from '@/lib/forecast/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date('2025-01-15T10:00:00Z')

function makeInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    now: NOW,
    params: { ...DEFAULT_PARAMS },
    scheduledTrucks: [],
    currentBayOccupancy: 0,
    currentInsideYard: 0,
    currentOutsideQueue: 0,
    ...overrides,
  }
}

function makeTruck(overrides: Partial<ScheduledTruck> = {}): ScheduledTruck {
  return {
    bookingId: 'test-booking',
    slotStartMinutesFromNow: 0,
    slotEndMinutesFromNow: 30,
    isAlreadyInTerminal: false,
    productCategory: 'POL',
    ...overrides,
  }
}

// ── Bucket structure ──────────────────────────────────────────────────────────

describe('computeForecast — bucket structure', () => {
  it('always produces exactly 4 buckets', () => {
    const result = computeForecast(makeInput())
    expect(result.buckets).toHaveLength(4)
  })

  it('bucket spans are consecutive and cover 0–120 min', () => {
    const result = computeForecast(makeInput())
    const buckets = result.buckets

    expect(buckets[0].bucketStartMinutesFromNow).toBe(0)
    expect(buckets[0].bucketEndMinutesFromNow).toBe(30)
    expect(buckets[1].bucketStartMinutesFromNow).toBe(30)
    expect(buckets[1].bucketEndMinutesFromNow).toBe(60)
    expect(buckets[2].bucketStartMinutesFromNow).toBe(60)
    expect(buckets[2].bucketEndMinutesFromNow).toBe(90)
    expect(buckets[3].bucketStartMinutesFromNow).toBe(90)
    expect(buckets[3].bucketEndMinutesFromNow).toBe(120)
  })

  it('bucket labels include HH:MM–HH:MM format', () => {
    const result = computeForecast(makeInput())
    for (const bucket of result.buckets) {
      expect(bucket.label).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/)
    }
  })

  it('bucket labels advance in 30-min steps from "now"', () => {
    // Use a local-time anchor so the test is timezone-agnostic
    const localNow = new Date()
    localNow.setSeconds(0, 0)
    // Round down to a clean 30-min boundary to make label arithmetic predictable
    localNow.setMinutes(localNow.getMinutes() < 30 ? 0 : 30)

    const result = computeForecast(makeInput({ now: localNow }))
    const labels = result.buckets.map((b) => b.label)

    // Verify each label starts where the previous one ended
    for (let i = 1; i < labels.length; i++) {
      const prevEnd   = labels[i - 1].split('–')[1]
      const currStart = labels[i].split('–')[0]
      expect(currStart).toBe(prevEnd)
    }

    // Last bucket ends 120 minutes after start
    const firstStart = new Date(localNow)
    const lastEnd    = new Date(localNow.getTime() + 120 * 60_000)
    const fmt = (d: Date) =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    expect(labels[0].split('–')[0]).toBe(fmt(firstStart))
    expect(labels[3].split('–')[1]).toBe(fmt(lastEnd))
  })
})

// ── Queue simulation constraints ──────────────────────────────────────────────

describe('computeForecast — queue constraints', () => {
  it('outside queue is non-negative in all buckets', () => {
    const trucks = Array.from({ length: 5 }, (_, i) =>
      makeTruck({ bookingId: `b${i}`, slotStartMinutesFromNow: i * 10 }),
    )
    const result = computeForecast(makeInput({ scheduledTrucks: trucks }))
    for (const b of result.buckets) {
      expect(b.queueOutside).toBeGreaterThanOrEqual(0)
    }
  })

  it('inside yard queue is non-negative in all buckets', () => {
    const trucks = Array.from({ length: 10 }, (_, i) =>
      makeTruck({ bookingId: `b${i}`, slotStartMinutesFromNow: i * 5 }),
    )
    const result = computeForecast(makeInput({ scheduledTrucks: trucks }))
    for (const b of result.buckets) {
      expect(b.queueInside).toBeGreaterThanOrEqual(0)
    }
  })

  it('bays occupied never exceeds totalBays', () => {
    // Start with near-full terminal
    const result = computeForecast(
      makeInput({
        currentBayOccupancy: 18,
        currentInsideYard: 8,
        currentOutsideQueue: 15,
        scheduledTrucks: Array.from({ length: 20 }, (_, i) =>
          makeTruck({ bookingId: `b${i}` }),
        ),
      }),
    )
    for (const b of result.buckets) {
      expect(b.baysOccupied).toBeLessThanOrEqual(18)
    }
  })

  it('outsideOverflow flag triggers when outside queue average ≥ 80% of limit (15)', () => {
    // Start at the queue limit and keep many trucks arriving throughout the 2 h
    // so the AVERAGE outside queue across every bucket stays above the 80% threshold
    const trucks = Array.from({ length: 60 }, (_, i) =>
      makeTruck({
        bookingId: `b${i}`,
        // Spread slots evenly across the 2-hour window so arrivals are sustained
        slotStartMinutesFromNow: (i % 12) * 10,
        slotEndMinutesFromNow:   (i % 12) * 10 + 10,
      }),
    )
    const result = computeForecast(
      makeInput({
        currentOutsideQueue: 14,        // start just below the 15-truck limit
        scheduledTrucks: trucks,
        params: { ...DEFAULT_PARAMS, slotAdherencePct: 100, rejectionPct: 0 },
      }),
    )
    const anyOverflow = result.buckets.some((b) => b.outsideOverflow)
    expect(anyOverflow).toBe(true)
  })

  it('insideOverflow flag triggers when inside queue average ≥ 80% of limit (8)', () => {
    // Gate can admit 1 truck/tick. Bay clearance rate is also ~1/tick (18 bays ÷ 90 min × 5 min).
    // Starting at insideYard=8 with a full outside queue means 1 truck enters per tick but also
    // 1 truck leaves to a bay → insideYard holds at 7 for the whole first bucket.
    // avg = (8 + 7×6) / 7 = 7.14 > 6.4 → insideOverflow = true.
    const result = computeForecast(
      makeInput({
        currentInsideYard: 8,     // at the inside limit
        currentBayOccupancy: 18,   // all bays full
        currentOutsideQueue: 15,   // outside queue full — trucks feed yard at gate throughput (1/tick)
        params: {
          ...DEFAULT_PARAMS,
          avgLoadingMinutes: 90,   // slowest loading → bays take longest to clear
          rejectionPct: 0,
        },
      }),
    )
    const anyOverflow = result.buckets.some((b) => b.insideOverflow)
    expect(anyOverflow).toBe(true)
  })

  it('outsideOverflow is false when there are zero trucks', () => {
    const result = computeForecast(makeInput())
    expect(result.buckets.every((b) => !b.outsideOverflow)).toBe(true)
  })

  it('bayOccupancyPct is clamped to 0–100', () => {
    const result = computeForecast(makeInput({ currentBayOccupancy: 18 }))
    for (const b of result.buckets) {
      expect(b.bayOccupancyPct).toBeGreaterThanOrEqual(0)
      expect(b.bayOccupancyPct).toBeLessThanOrEqual(100)
    }
  })
})

// ── Congestion risk score ─────────────────────────────────────────────────────

describe('computeForecast — congestion score', () => {
  it('score is in range 0–100', () => {
    // Test with both an empty terminal and a heavily loaded one
    const empty = computeForecast(makeInput())
    expect(empty.congestionScore).toBeGreaterThanOrEqual(0)
    expect(empty.congestionScore).toBeLessThanOrEqual(100)

    const busy = computeForecast(
      makeInput({
        currentBayOccupancy: 18,
        currentInsideYard: 8,
        currentOutsideQueue: 15,
        scheduledTrucks: Array.from({ length: 30 }, (_, i) =>
          makeTruck({ bookingId: `b${i}` }),
        ),
      }),
    )
    expect(busy.congestionScore).toBeGreaterThanOrEqual(0)
    expect(busy.congestionScore).toBeLessThanOrEqual(100)
  })

  it('score is deterministic — same inputs always produce same result', () => {
    const input = makeInput({
      currentBayOccupancy: 10,
      currentInsideYard: 4,
      currentOutsideQueue: 6,
      scheduledTrucks: [
        makeTruck({ bookingId: 'a', slotStartMinutesFromNow: 10 }),
        makeTruck({ bookingId: 'b', slotStartMinutesFromNow: 40 }),
      ],
    })
    const r1 = computeForecast(input)
    const r2 = computeForecast(input)
    expect(r1.congestionScore).toBe(r2.congestionScore)
  })

  it('score increases as congestion parameters worsen', () => {
    const baseline = computeForecast(makeInput({ params: DEFAULT_PARAMS }))

    // Increase docs delay and lower slot adherence — should push score up
    const worse = computeForecast(
      makeInput({
        params: {
          ...DEFAULT_PARAMS,
          docsDelayPct: 55,
          slotAdherencePct: 30,
          rejectionPct: 40,
        },
        scheduledTrucks: Array.from({ length: 20 }, (_, i) =>
          makeTruck({ bookingId: `b${i}` }),
        ),
      }),
    )
    expect(worse.congestionScore).toBeGreaterThanOrEqual(baseline.congestionScore)
  })

  it('empty terminal yields a low score (< 30)', () => {
    const result = computeForecast(makeInput())
    expect(result.congestionScore).toBeLessThan(30)
  })

  it('congestionDrivers array has at most 3 items', () => {
    const result = computeForecast(
      makeInput({
        params: { ...DEFAULT_PARAMS, docsDelayPct: 50, rejectionPct: 30 },
        currentBayOccupancy: 18,
        currentInsideYard: 8,
        currentOutsideQueue: 15,
        scheduledTrucks: Array.from({ length: 20 }, (_, i) =>
          makeTruck({ bookingId: `b${i}` }),
        ),
      }),
    )
    expect(result.congestionDrivers.length).toBeLessThanOrEqual(3)
  })

  it('each driver contributionPct is in 0–100', () => {
    const result = computeForecast(
      makeInput({
        params: { ...DEFAULT_PARAMS, docsDelayPct: 40 },
        currentBayOccupancy: 15,
      }),
    )
    for (const d of result.congestionDrivers) {
      expect(d.contributionPct).toBeGreaterThanOrEqual(0)
      expect(d.contributionPct).toBeLessThanOrEqual(100)
    }
  })
})

// ── Arrival probability model ─────────────────────────────────────────────────

describe('computeForecast — arrival model', () => {
  it('trucks already in terminal do not contribute to arrivals', () => {
    const alreadyIn = makeTruck({
      bookingId: 'already-in',
      isAlreadyInTerminal: true,
      slotStartMinutesFromNow: 0,
      slotEndMinutesFromNow: 30,
    })
    const resultWith    = computeForecast(makeInput({ scheduledTrucks: [alreadyIn] }))
    const resultWithout = computeForecast(makeInput({ scheduledTrucks: [] }))

    const arrivalsSum = (r: typeof resultWith) =>
      r.buckets.reduce((s, b) => s + b.expectedArrivals, 0)

    expect(arrivalsSum(resultWith)).toBeCloseTo(arrivalsSum(resultWithout), 5)
  })

  it('expectedArrivals is non-negative in all buckets', () => {
    const trucks = Array.from({ length: 10 }, (_, i) =>
      makeTruck({ bookingId: `b${i}`, slotStartMinutesFromNow: i * 20 }),
    )
    const result = computeForecast(makeInput({ scheduledTrucks: trucks }))
    for (const b of result.buckets) {
      expect(b.expectedArrivals).toBeGreaterThanOrEqual(0)
    }
  })

  it('100% rejection rate reduces arrivals to near zero', () => {
    const trucks = Array.from({ length: 10 }, (_, i) =>
      makeTruck({ bookingId: `b${i}` }),
    )
    const result = computeForecast(
      makeInput({
        scheduledTrucks: trucks,
        params: { ...DEFAULT_PARAMS, rejectionPct: 100 },
      }),
    )
    const totalArrivals = result.buckets.reduce((s, b) => s + b.expectedArrivals, 0)
    expect(totalArrivals).toBeCloseTo(0, 5)
  })

  it('higher slot adherence concentrates more arrivals in the slot window', () => {
    // Both runs have 1 truck slotted from t=0 to t=30 min (bucket 0)
    const trucks = [makeTruck({ slotStartMinutesFromNow: 0, slotEndMinutesFromNow: 30 })]

    const highAdherence = computeForecast(
      makeInput({
        scheduledTrucks: trucks,
        params: { ...DEFAULT_PARAMS, slotAdherencePct: 95, rejectionPct: 0 },
      }),
    )
    const lowAdherence = computeForecast(
      makeInput({
        scheduledTrucks: trucks,
        params: { ...DEFAULT_PARAMS, slotAdherencePct: 20, rejectionPct: 0 },
      }),
    )

    // Bucket 0 should have more arrivals with high adherence
    expect(highAdherence.buckets[0].expectedArrivals).toBeGreaterThanOrEqual(
      lowAdherence.buckets[0].expectedArrivals,
    )
  })
})

// ── Recommendations ───────────────────────────────────────────────────────────

describe('computeForecast — recommendations', () => {
  it('always includes the LPG bay priority recommendation', () => {
    const result = computeForecast(makeInput())
    const hasLpg = result.recommendations.some((r) => r.type === 'bay_priority')
    expect(hasLpg).toBe(true)
  })

  it('each recommendation has a valid priority', () => {
    const result = computeForecast(
      makeInput({
        params: { ...DEFAULT_PARAMS, docsDelayPct: 40 },
        currentOutsideQueue: 12,
        scheduledTrucks: Array.from({ length: 15 }, (_, i) =>
          makeTruck({ bookingId: `b${i}` }),
        ),
      }),
    )
    for (const rec of result.recommendations) {
      expect(['high', 'medium', 'low']).toContain(rec.priority)
    }
  })

  it('recommendations are sorted high → medium → low', () => {
    const result = computeForecast(
      makeInput({
        params: { ...DEFAULT_PARAMS, docsDelayPct: 40 },
        currentOutsideQueue: 12,
        scheduledTrucks: Array.from({ length: 15 }, (_, i) =>
          makeTruck({ bookingId: `b${i}` }),
        ),
      }),
    )
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < result.recommendations.length; i++) {
      expect(priorityOrder[result.recommendations[i].priority]).toBeGreaterThanOrEqual(
        priorityOrder[result.recommendations[i - 1].priority],
      )
    }
  })

  it('docs_preclear recommendation appears when docsDelayPct > 15', () => {
    const result = computeForecast(
      makeInput({ params: { ...DEFAULT_PARAMS, docsDelayPct: 30 } }),
    )
    const hasDocs = result.recommendations.some((r) => r.type === 'docs_preclear')
    expect(hasDocs).toBe(true)
  })

  it('docs_preclear recommendation absent when docsDelayPct ≤ 15', () => {
    const result = computeForecast(
      makeInput({ params: { ...DEFAULT_PARAMS, docsDelayPct: 10 } }),
    )
    const hasDocs = result.recommendations.some((r) => r.type === 'docs_preclear')
    expect(hasDocs).toBe(false)
  })
})

// ── Model assumptions ─────────────────────────────────────────────────────────

describe('computeForecast — model assumptions', () => {
  it('returns at least 8 assumption strings', () => {
    const result = computeForecast(makeInput())
    expect(result.modelAssumptions.length).toBeGreaterThanOrEqual(8)
  })

  it('generatedAt is a valid ISO-8601 string', () => {
    const result = computeForecast(makeInput())
    expect(() => new Date(result.generatedAt).toISOString()).not.toThrow()
  })

  it('currentState reflects the input values', () => {
    const result = computeForecast(
      makeInput({
        currentBayOccupancy: 7,
        currentInsideYard: 3,
        currentOutsideQueue: 5,
      }),
    )
    expect(result.currentState.baysOccupied).toBe(7)
    expect(result.currentState.trucksInside).toBe(3)
    expect(result.currentState.trucksOutside).toBe(5)
  })

  it('derivedStats.avgBaseTurnaroundMin is positive', () => {
    const result = computeForecast(makeInput())
    expect(result.derivedStats.avgBaseTurnaroundMin).toBeGreaterThan(0)
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('computeForecast — edge cases', () => {
  it('handles zero scheduled trucks without throwing', () => {
    expect(() => computeForecast(makeInput())).not.toThrow()
  })

  it('handles maximum-stress scenario without throwing', () => {
    const trucks = Array.from({ length: 100 }, (_, i) =>
      makeTruck({ bookingId: `b${i}`, slotStartMinutesFromNow: 0, slotEndMinutesFromNow: 10 }),
    )
    expect(() =>
      computeForecast(
        makeInput({
          scheduledTrucks: trucks,
          currentBayOccupancy: 18,
          currentInsideYard: 8,
          currentOutsideQueue: 15,
          params: { ...DEFAULT_PARAMS, rejectionPct: 0, slotAdherencePct: 100 },
        }),
      ),
    ).not.toThrow()
  })

  it('handles negative slotStart (slot already started) without throwing', () => {
    const trucks = [makeTruck({ slotStartMinutesFromNow: -60, slotEndMinutesFromNow: -30 })]
    expect(() => computeForecast(makeInput({ scheduledTrucks: trucks }))).not.toThrow()
  })

  it('custom totalBays override is respected', () => {
    const result = computeForecast(
      makeInput({
        currentBayOccupancy: 10,
        totalBays: 10,
      }),
    )
    for (const b of result.buckets) {
      expect(b.baysOccupied).toBeLessThanOrEqual(10)
    }
  })
})
