"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Hourglass,
  LogOut,
  PackageCheck,
  RefreshCw,
  Scale,
  Shield,
  ShieldCheck,
  Truck,
  TrendingUp,
  Zap,
  XCircle,
  Activity,
} from "lucide-react"
import { computeForecast } from "@/lib/forecast/engine"
import { DEFAULT_PARAMS } from "@/lib/forecast/types"
import type { ScheduledTruck } from "@/lib/forecast/types"

// ── Types ─────────────────────────────────────────────────────────────────────

type BayStatus = "active" | "near_complete" | "overdue" | "free"
type ProductType = "POL" | "CHEMICAL" | "LPG"

interface BayState {
  bayNo: number
  status: BayStatus
  product?: ProductType
  truckId?: string
  minutesInBay?: number
  estMinRemaining?: number
}

interface GantryState {
  id: "G1" | "G2" | "G3"
  label: string
  product: string
  totalBays: number
  bays: BayState[]
  avgLoadingMin: number
  utilPct: number
  isLPG: boolean
}

interface WeighbridgeState {
  id: number
  queue: number
  currentTruck: string
  elapsedSec: number
  avgTimeMin: number
  status: "smooth" | "busy"
}

interface LiveState {
  waitingOutside: number
  insideTerminal: number
  atWeighbridge: number
  atInspection: number
  atLoading: number
  completedToday: number
  rejectedToday: number
  avgTurnaroundMin: number
  gantries: GantryState[]
  weighbridges: WeighbridgeState[]
}

// ── Deterministic demo data ────────────────────────────────────────────────────

function pr(seed: number, salt: number): number {
  const x = Math.sin(seed * 9301 + salt * 49297 + 233) * 10000
  return x - Math.floor(x)
}

function vary(base: number, range: number, seed: number, salt: number): number {
  return Math.max(0, Math.round(base + (pr(seed, salt) - 0.5) * 2 * range))
}

const DEMO_TRUCKS = [
  "MH12AX7234", "AP29TB4821", "TS14HK3019", "AP21MN5512", "KA05MN9012",
  "TN22AB1234", "MH31CD5678", "GJ15EF9012", "RJ14GH3456", "DL08IJ7890",
  "UP32KL1234", "WB23MN5678", "HR26OP9012", "MP09QR4567", "CG22ST8901",
]

function makeBays(
  count: number,
  product: ProductType,
  utilPct: number,
  seed: number,
  gantryIdx: number,
): BayState[] {
  return Array.from({ length: count }, (_, i) => {
    const r = pr(seed + i * 7, gantryIdx * 13 + i)
    if (r >= utilPct / 100) return { bayNo: i + 1, status: "free" }

    const minIn = Math.round(pr(seed + i * 3, gantryIdx + 100) * 65 + 5)
    const status: BayStatus =
      minIn > 60 ? "overdue" : minIn > 45 ? "near_complete" : "active"

    return {
      bayNo: i + 1,
      status,
      product,
      truckId: DEMO_TRUCKS[(seed * 3 + gantryIdx * 5 + i * 7) % DEMO_TRUCKS.length],
      minutesInBay: minIn,
      estMinRemaining: Math.max(0, 52 - minIn),
    }
  })
}

function generateState(tick: number): LiveState {
  const seed = tick
  const hour = new Date().getHours()
  const isPeak = hour >= 9 && hour <= 15
  const m = isPeak ? 1.0 : 0.6

  const atLoading     = vary(Math.round(12 * m), 2, seed, 2)
  const atWeighbridge = vary(2, 1, seed, 4)

  const g1Util = vary(Math.round(82 * m), 8, seed, 10)
  const g2Util = vary(Math.round(75 * m), 10, seed, 11)
  const g3Util = vary(Math.round(68 * m), 12, seed, 12)

  return {
    waitingOutside:   vary(Math.round(8 * m), 3, seed, 1),
    insideTerminal:   vary(Math.round(6 * m), 2, seed, 5),
    atWeighbridge,
    atInspection:     vary(Math.round(3 * m), 1, seed, 3),
    atLoading,
    completedToday:   vary(96, 5, seed, 6),
    rejectedToday:    vary(14, 2, seed, 7),
    avgTurnaroundMin: vary(88, 8, seed, 20),
    gantries: [
      {
        id: "G1",
        label: "Gantry 1",
        product: "POL / Chemical",
        totalBays: 8,
        bays: makeBays(8, "POL", g1Util, seed, 1),
        avgLoadingMin: vary(51, 4, seed, 30),
        utilPct: g1Util,
        isLPG: false,
      },
      {
        id: "G2",
        label: "Gantry 2",
        product: "POL / Chemical",
        totalBays: 4,
        bays: makeBays(4, "CHEMICAL", g2Util, seed, 2),
        avgLoadingMin: vary(49, 4, seed, 31),
        utilPct: g2Util,
        isLPG: false,
      },
      {
        id: "G3",
        label: "Gantry 3 — LPG",
        product: "LPG",
        totalBays: 6,
        bays: makeBays(6, "LPG", g3Util, seed, 3),
        avgLoadingMin: vary(54, 4, seed, 32),
        utilPct: g3Util,
        isLPG: true,
      },
    ],
    weighbridges: [
      {
        id: 1,
        queue: vary(2, 1, seed, 40),
        currentTruck: DEMO_TRUCKS[(seed * 2) % DEMO_TRUCKS.length],
        elapsedSec: vary(105, 60, seed, 41),
        avgTimeMin: +(2.5 + pr(seed, 42) * 0.6).toFixed(1),
        status: atWeighbridge > 3 ? "busy" : "smooth",
      },
      {
        id: 2,
        queue: vary(1, 1, seed, 50),
        currentTruck: DEMO_TRUCKS[(seed * 3 + 1) % DEMO_TRUCKS.length],
        elapsedSec: vary(70, 40, seed, 51),
        avgTimeMin: +(2.8 + pr(seed, 52) * 0.6).toFixed(1),
        status: "smooth",
      },
    ],
  }
}

function makeScheduledTrucks(seed: number): ScheduledTruck[] {
  return Array.from({ length: 28 }, (_, i) => ({
    bookingId: `live-${seed}-${i}`,
    slotStartMinutesFromNow: i * 5 - 15,
    slotEndMinutesFromNow: i * 5 + 15,
    isAlreadyInTerminal: i < 10,
    productCategory: (i % 3 === 0 ? "LPG" : i % 2 === 0 ? "POL" : "CHEMICAL") as ProductType,
  }))
}

// ── Sub-components ────────────────────────────────────────────────────────────

const BAY_COLORS: Record<BayStatus, string> = {
  active:        "bg-emerald-500 border-emerald-400",
  near_complete: "bg-amber-400 border-amber-300",
  overdue:       "bg-red-500 border-red-400",
  free:          "bg-gray-700 border-gray-600",
}

const BAY_LABELS: Record<BayStatus, string> = {
  active:        "Loading",
  near_complete: "Near done",
  overdue:       "Overdue",
  free:          "Free",
}

function BayDot({ bay }: { bay: BayState }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative flex flex-col items-center gap-0.5">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center cursor-default transition-all
          ${BAY_COLORS[bay.status]}
          ${bay.status !== "free" ? "shadow-lg" : "opacity-40"}`}
      >
        {bay.status !== "free" && <Truck className="h-4 w-4 text-white" />}
      </div>
      <span className="text-[9px] text-gray-500">B{bay.bayNo}</span>

      {hovered && bay.status !== "free" && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 rounded-lg px-2.5 py-2 text-[11px] w-40 shadow-xl whitespace-nowrap">
          <p className="font-bold text-white mb-1">{bay.truckId}</p>
          <p className="text-gray-300">{bay.product} · Bay {bay.bayNo}</p>
          <p className="text-gray-300">{bay.minutesInBay} min in bay</p>
          <p className={bay.status === "overdue" ? "text-red-400 font-semibold" : "text-amber-400"}>
            {bay.status === "overdue" ? "Overdue!" : `~${bay.estMinRemaining} min left`}
          </p>
          <p className="text-gray-500 text-[10px] mt-0.5">{BAY_LABELS[bay.status]}</p>
        </div>
      )}
    </div>
  )
}

function GantryPanel({ g }: { g: GantryState }) {
  const active = g.bays.filter((b) => b.status === "active").length
  const nearDone = g.bays.filter((b) => b.status === "near_complete").length
  const overdue = g.bays.filter((b) => b.status === "overdue").length
  const free = g.bays.filter((b) => b.status === "free").length

  const headerColor = g.isLPG
    ? "from-purple-900/60 to-purple-900/20 border-purple-700/50"
    : "from-blue-900/60 to-blue-900/20 border-blue-700/50"

  const accentColor = g.isLPG ? "text-purple-400" : "text-blue-400"
  const utilColor =
    g.utilPct >= 90 ? "text-red-400" : g.utilPct >= 75 ? "text-amber-400" : "text-emerald-400"

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${headerColor} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${accentColor}`}>
              {g.id}
            </span>
            {g.isLPG && (
              <span className="text-[9px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                LPG · Expanding
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-200 mt-0.5">{g.label}</p>
          <p className="text-[11px] text-gray-400">{g.product} · {g.totalBays} bays</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${utilColor}`}>{g.utilPct}%</p>
          <p className="text-[10px] text-gray-400">utilisation</p>
        </div>
      </div>

      {/* Bay grid */}
      <div className="flex gap-1.5 flex-wrap">
        {g.bays.map((b) => (
          <BayDot key={b.bayNo} bay={b} />
        ))}
      </div>

      {/* Stats row */}
      <div className="flex gap-2 pt-1">
        {[
          { label: "Loading", count: active, color: "text-emerald-400" },
          { label: "Near done", count: nearDone, color: "text-amber-400" },
          { label: "Overdue", count: overdue, color: "text-red-400" },
          { label: "Free", count: free, color: "text-gray-400" },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex-1 text-center bg-gray-900/50 rounded-lg py-1.5">
            <p className={`text-base font-bold ${color}`}>{count}</p>
            <p className="text-[9px] text-gray-500">{label}</p>
          </div>
        ))}
        <div className="flex-1 text-center bg-gray-900/50 rounded-lg py-1.5">
          <p className="text-base font-bold text-gray-300">{g.avgLoadingMin}m</p>
          <p className="text-[9px] text-gray-500">Avg load</p>
        </div>
      </div>
    </div>
  )
}

function WeighbridgePanel({ wb }: { wb: WeighbridgeState }) {
  const [elapsed, setElapsed] = useState(wb.elapsedSec)

  // Live timer — ticks every second
  useEffect(() => {
    setElapsed(wb.elapsedSec)
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [wb.elapsedSec])

  const mins = Math.floor(elapsed / 60)
  const secs = String(elapsed % 60).padStart(2, "0")
  const isOverTime = elapsed > wb.avgTimeMin * 60

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-gray-200">Weighbridge {wb.id}</span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            wb.status === "smooth"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
          }`}
        >
          {wb.status === "smooth" ? "Smooth" : "Busy"}
        </span>
      </div>

      {/* Current truck timer */}
      <div className="bg-gray-800/60 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400">Current truck</p>
          <p className="text-sm font-mono font-semibold text-white">{wb.currentTruck}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400">Elapsed</p>
          <p className={`text-xl font-bold font-mono ${isOverTime ? "text-red-400" : "text-emerald-400"}`}>
            {mins}:{secs}
          </p>
        </div>
      </div>

      <div className="flex gap-3 text-center">
        <div className="flex-1 bg-gray-800/40 rounded-lg py-2">
          <p className="text-lg font-bold text-amber-400">{wb.queue}</p>
          <p className="text-[9px] text-gray-500">Queue</p>
        </div>
        <div className="flex-1 bg-gray-800/40 rounded-lg py-2">
          <p className="text-lg font-bold text-gray-300">{wb.avgTimeMin}m</p>
          <p className="text-[9px] text-gray-500">Avg time</p>
        </div>
      </div>
    </div>
  )
}

function AIBottleneckPanel({ state, tick }: { state: LiveState; tick: number }) {
  const forecast = useMemo(() => {
    const trucks = makeScheduledTrucks(tick)
    return computeForecast({
      now: new Date(),
      params: DEFAULT_PARAMS,
      scheduledTrucks: trucks,
      currentBayOccupancy: state.atLoading,
      currentInsideYard: state.insideTerminal,
      currentOutsideQueue: state.waitingOutside,
      totalBays: 18,
    })
  }, [state, tick])

  const score = forecast.congestionScore
  const scoreColor =
    score >= 75 ? "text-red-400" : score >= 55 ? "text-amber-400" : score >= 30 ? "text-yellow-400" : "text-emerald-400"
  const scoreBg =
    score >= 75 ? "from-red-900/40 to-red-900/10 border-red-700/40" :
    score >= 55 ? "from-amber-900/40 to-amber-900/10 border-amber-700/40" :
    "from-emerald-900/30 to-emerald-900/5 border-emerald-700/30"

  const topRec = forecast.recommendations[0]
  const topDriver = forecast.congestionDrivers[0]

  // Estimate minutes to congestion from first bucket that crosses 55
  const congestBucket = forecast.buckets.find(
    (b) => b.outsideOverflow || b.insideOverflow || b.bayOccupancyPct >= 90,
  )
  const minsToCongest = congestBucket?.bucketStartMinutesFromNow ?? null

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${scoreBg} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-bold text-gray-200">AI Congestion Detector</span>
      </div>

      {/* Score gauge */}
      <div className="flex items-center justify-between bg-gray-900/50 rounded-xl px-4 py-3">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Risk Score</p>
          <p className={`text-4xl font-black ${scoreColor}`}>{score}</p>
          <p className={`text-xs font-semibold ${scoreColor}`}>
            {score >= 75 ? "Critical" : score >= 55 ? "High" : score >= 30 ? "Moderate" : "Low"}
          </p>
        </div>
        <div className="relative w-20 h-20">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#374151" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={score >= 75 ? "#ef4444" : score >= 55 ? "#f59e0b" : score >= 30 ? "#eab308" : "#10b981"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 201} 201`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-300">
            /100
          </span>
        </div>
      </div>

      {/* Congestion timing */}
      {minsToCongest !== null && score >= 30 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-900/30 border border-amber-700/30 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            Congestion pressure predicted in{" "}
            <span className="font-bold">{minsToCongest} min</span>
          </p>
        </div>
      )}

      {/* Top driver */}
      {topDriver && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Top Driver</p>
          <div className="bg-gray-900/50 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-gray-200">{topDriver.factor}</p>
            <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: `${Math.min(100, topDriver.contributionPct)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 leading-snug">{topDriver.detail}</p>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {topRec && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Suggested Action</p>
          <div className="bg-indigo-900/30 border border-indigo-700/30 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-indigo-300">{topRec.title}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{topRec.impact}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatDef {
  label: string
  value: number | string
  sub?: string
  icon: typeof Truck
  color: string
  bg: string
  warn?: boolean
}

function LiveStatCard({ s }: { s: StatDef }) {
  const Icon = s.icon
  return (
    <div className={`rounded-xl border p-3.5 flex flex-col gap-2 ${s.bg} ${s.warn ? "ring-1 ring-amber-500/50" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</span>
        <Icon className={`h-3.5 w-3.5 ${s.color}`} />
      </div>
      <div>
        <span className={`text-3xl font-black ${s.color}`}>{s.value}</span>
        {s.sub && <p className="text-[10px] text-gray-500 mt-0.5">{s.sub}</p>}
      </div>
      {s.warn && (
        <div className="flex items-center gap-1 text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3" /> Elevated
        </div>
      )}
    </div>
  )
}

// ── Funnel view ───────────────────────────────────────────────────────────────

function FunnelView({ state }: { state: LiveState }) {
  const stages = [
    { label: "Outside",   count: state.waitingOutside,  icon: Clock,         color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Weigh-in",  count: state.atWeighbridge,   icon: Scale,         color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Inspection",count: state.atInspection,    icon: ShieldCheck,   color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
    { label: "Yard Wait", count: state.insideTerminal,  icon: Hourglass,     color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Loading",   count: state.atLoading,       icon: PackageCheck,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Doc Clear", count: Math.max(0, Math.round(state.atLoading * 0.25)), icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Exiting",   count: Math.max(1, Math.round(state.completedToday / 48)), icon: LogOut, color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
  ]
  const max = Math.max(...stages.map((s) => s.count), 1)

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-bold text-gray-200">Live Terminal Funnel</span>
        <span className="text-[10px] text-gray-500 ml-1">— truck count at each stage right now</span>
      </div>

      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => {
          const Icon = s.icon
          const heightPct = Math.max(15, Math.round((s.count / max) * 100))
          return (
            <div key={s.label} className="flex items-center gap-1 shrink-0 flex-1 min-w-[90px]">
              <div className="flex-1 flex flex-col items-center gap-1.5">
                {/* Bar */}
                <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
                  <div
                    className={`w-full rounded-t-lg border transition-all ${s.bg}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                {/* Icon + count */}
                <div className={`w-full rounded-xl border ${s.bg} px-2 py-2 flex flex-col items-center gap-1`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                  <span className={`text-xl font-black ${s.color}`}>{s.count}</span>
                  <span className="text-[9px] text-gray-400 text-center leading-tight">{s.label}</span>
                </div>
              </div>
              {i < stages.length - 1 && (
                <ArrowRight className="h-3 w-3 text-gray-600 shrink-0 mb-8" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LiveOpsPage() {
  const { data: session } = useSession()
  const [tick, setTick] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [countdown, setCountdown] = useState(10)

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const refresh = setInterval(() => {
      setTick((t) => t + 1)
      setLastUpdated(new Date())
      setCountdown(10)
    }, 10_000)

    const counter = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)

    return () => {
      clearInterval(refresh)
      clearInterval(counter)
    }
  }, [])

  const state = useMemo(() => generateState(tick), [tick])

  if (!session) return null

  const totalInTerminal =
    state.insideTerminal + state.atWeighbridge + state.atInspection + state.atLoading

  const rejPct = state.completedToday + state.rejectedToday > 0
    ? Math.round((state.rejectedToday / (state.completedToday + state.rejectedToday)) * 100)
    : 0

  const stats: StatDef[] = [
    {
      label: "Waiting Outside",
      value: state.waitingOutside,
      sub: "Pre-gate queue",
      icon: Clock,
      color: state.waitingOutside >= 10 ? "text-red-400" : state.waitingOutside >= 7 ? "text-amber-400" : "text-emerald-400",
      bg: "bg-gray-800/60 border-gray-700",
      warn: state.waitingOutside >= 10,
    },
    {
      label: "Inside Terminal",
      value: totalInTerminal,
      sub: "Total on-site",
      icon: Truck,
      color: "text-blue-400",
      bg: "bg-gray-800/60 border-gray-700",
    },
    {
      label: "At Weighbridge",
      value: state.atWeighbridge,
      sub: "2 bridges",
      icon: Scale,
      color: "text-blue-400",
      bg: "bg-gray-800/60 border-gray-700",
    },
    {
      label: "At Inspection",
      value: state.atInspection,
      sub: "HSE check",
      icon: ShieldCheck,
      color: "text-purple-400",
      bg: "bg-gray-800/60 border-gray-700",
    },
    {
      label: "At Loading",
      value: state.atLoading,
      sub: `${Math.round((state.atLoading / 18) * 100)}% bay utilisation`,
      icon: PackageCheck,
      color: state.atLoading >= 16 ? "text-red-400" : state.atLoading >= 14 ? "text-amber-400" : "text-emerald-400",
      bg: "bg-gray-800/60 border-gray-700",
      warn: state.atLoading >= 16,
    },
    {
      label: "Completed Today",
      value: state.completedToday,
      sub: "Loaded & exited",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-gray-800/60 border-gray-700",
    },
    {
      label: "Rejected Today",
      value: state.rejectedToday,
      sub: `${rejPct}% rejection rate`,
      icon: XCircle,
      color: state.rejectedToday >= 18 ? "text-red-400" : "text-rose-400",
      bg: "bg-gray-800/60 border-gray-700",
    },
    {
      label: "Avg Turnaround",
      value: `${state.avgTurnaroundMin}m`,
      sub: "Gate-in to gate-out",
      icon: TrendingUp,
      color: state.avgTurnaroundMin > 100 ? "text-red-400" : state.avgTurnaroundMin > 90 ? "text-amber-400" : "text-emerald-400",
      bg: "bg-gray-800/60 border-gray-700",
    },
  ]

  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })

  return (
    <div className="bg-gray-950 -m-4 lg:-m-8 p-4 lg:p-6 min-h-screen space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-lg font-black text-white tracking-tight">
              EIPL Live Ops — Terminal Command Panel
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 ml-5">
            8AM–8PM operations · 18 bays (G1×8 + G2×4 + G3-LPG×6) · 2 weighbridges · Demo data
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>Updated {fmt(lastUpdated)}</span>
          <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full">
            <RefreshCw className="h-3 w-3 text-indigo-400" />
            <span className="text-gray-300">Refresh in {countdown}s</span>
          </div>
        </div>
      </div>

      {/* ── Section 1: Live stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {stats.map((s) => (
          <LiveStatCard key={s.label} s={s} />
        ))}
      </div>

      {/* ── Section 2 + 3: Gantries | AI + Weighbridges ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Gantries */}
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">
              Gantry Bay Status
            </span>
          </div>
          {state.gantries.map((g) => (
            <GantryPanel key={g.id} g={g} />
          ))}
        </div>

        {/* Right panel */}
        <div className="xl:col-span-2 space-y-3">
          {/* AI detector */}
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">
              AI Predictor
            </span>
          </div>
          <AIBottleneckPanel state={state} tick={tick} />

          {/* Weighbridges */}
          <div className="flex items-center gap-2 mt-1">
            <Scale className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">
              Weighbridges
            </span>
          </div>
          {state.weighbridges.map((wb) => (
            <WeighbridgePanel key={wb.id} wb={wb} />
          ))}
        </div>
      </div>

      {/* ── Section 4: Funnel ── */}
      <FunnelView state={state} />

      {/* ── Footer ── */}
      <p className="text-center text-[10px] text-gray-700 pb-2">
        EIPL Terminal Digital Twin · Deterministic simulation · Auto-refreshes every 10s · Demo data
      </p>
    </div>
  )
}
