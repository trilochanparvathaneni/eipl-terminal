"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CongestionDriver, ForecastResult } from "@/lib/forecast/types"

interface Props {
  result: ForecastResult
}

function scoreLevel(score: number): {
  label: string
  color: string
  ring: string
  bg: string
  icon: typeof CheckCircle
} {
  if (score < 30)
    return {
      label: "Low",
      color: "text-emerald-600",
      ring: "stroke-emerald-500",
      bg: "bg-emerald-50 border-emerald-200",
      icon: CheckCircle,
    }
  if (score < 55)
    return {
      label: "Moderate",
      color: "text-amber-600",
      ring: "stroke-amber-500",
      bg: "bg-amber-50 border-amber-200",
      icon: AlertTriangle,
    }
  if (score < 75)
    return {
      label: "High",
      color: "text-orange-600",
      ring: "stroke-orange-500",
      bg: "bg-orange-50 border-orange-200",
      icon: AlertTriangle,
    }
  return {
    label: "Critical",
    color: "text-red-600",
    ring: "stroke-red-500",
    bg: "bg-red-50 border-red-200",
    icon: XCircle,
  }
}

/** SVG arc-based gauge */
function Gauge({ score }: { score: number }) {
  const radius = 42
  const circumference = Math.PI * radius // half-circle
  const filled = circumference * (score / 100)
  const gap = circumference - filled
  const level = scoreLevel(score)

  return (
    <svg viewBox="0 0 100 56" className="w-36 h-20 mx-auto">
      {/* Background track */}
      <path
        d="M 8 50 A 42 42 0 0 1 92 50"
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <path
        d="M 8 50 A 42 42 0 0 1 92 50"
        fill="none"
        className={level.ring}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
      />
      {/* Score text */}
      <text
        x="50"
        y="48"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        className={level.color}
        fill="currentColor"
      >
        {score}
      </text>
    </svg>
  )
}

function DriverBar({ driver }: { driver: CongestionDriver }) {
  const pct = Math.min(100, driver.contributionPct)
  const color =
    pct >= 80
      ? "bg-red-500"
      : pct >= 55
      ? "bg-orange-400"
      : pct >= 35
      ? "bg-amber-400"
      : "bg-emerald-400"

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{driver.factor}</span>
        <span className="text-slate-500">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">{driver.detail}</p>
    </div>
  )
}

export function RiskScoreCard({ result }: Props) {
  const [showAssumptions, setShowAssumptions] = useState(false)
  const level = scoreLevel(result.congestionScore)
  const Icon = level.icon

  return (
    <>
      <Card className={`border ${level.bg} shadow-sm`}>
        <CardHeader className="pb-2 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">Congestion Risk Score</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Next 2-hour forecast</p>
          </div>
          <button
            onClick={() => setShowAssumptions(true)}
            className="rounded-full p-1 hover:bg-slate-100 transition-colors"
            aria-label="Model assumptions"
          >
            <Info className="h-4 w-4 text-slate-400" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Gauge + level badge */}
          <div className="text-center">
            <Gauge score={result.congestionScore} />
            <Badge
              variant="outline"
              className={`mt-1 gap-1.5 ${level.color} border-current`}
            >
              <Icon className="h-3 w-3" />
              {level.label} Risk
            </Badge>
          </div>

          {/* Current state chips */}
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              { label: "Outside", value: result.currentState.trucksOutside, limit: 15 },
              { label: "In Yard", value: result.currentState.trucksInside, limit: 8 },
              { label: "At Bay", value: result.currentState.baysOccupied, limit: 18 },
              { label: "In Docs", value: result.currentState.trucksInDocs, limit: null },
            ].map(({ label, value, limit }) => {
              const warn = limit !== null && value >= limit * 0.8
              return (
                <div
                  key={label}
                  className={`rounded-lg p-2 border ${
                    warn
                      ? "bg-red-50 border-red-200"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <p
                    className={`text-lg font-bold ${
                      warn ? "text-red-600" : "text-slate-800"
                    }`}
                  >
                    {value}
                    {limit && (
                      <span className="text-xs font-normal text-slate-400">
                        /{limit}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500">{label}</p>
                </div>
              )
            })}
          </div>

          {/* Peak stats */}
          <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5 text-xs">
            <p className="font-semibold text-slate-600 mb-1">2-Hour Peaks</p>
            {[
              { label: "Peak outside queue", value: `${result.derivedStats.peakOutsideQueue} trucks` },
              { label: "Peak inside yard", value: `${result.derivedStats.peakInsideQueue} trucks` },
              { label: "Peak bay occupancy", value: `${result.derivedStats.peakBayOccupancyPct}%` },
              { label: "Base turnaround", value: `${result.derivedStats.avgBaseTurnaroundMin} min` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-500">{label}</span>
                <span className="font-medium text-slate-800">{value}</span>
              </div>
            ))}
          </div>

          {/* Top 3 congestion drivers */}
          {result.congestionDrivers.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600">
                Top Congestion Drivers
              </p>
              {result.congestionDrivers.map((d) => (
                <DriverBar key={d.factor} driver={d} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model assumptions dialog */}
      <Dialog open={showAssumptions} onOpenChange={setShowAssumptions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Model Assumptions</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-slate-500 text-xs">
              This forecast uses a deterministic discrete-time queue simulation
              (5-min ticks, 30-min buckets). No randomness — same inputs always
              produce the same result.
            </p>
            <ul className="space-y-1.5 mt-3">
              {result.modelAssumptions.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700">
                  <span className="shrink-0 text-indigo-400 font-bold">·</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
