"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sliders, RotateCcw } from "lucide-react"
import type { ForecastParams } from "@/lib/forecast/types"
import { DEFAULT_PARAMS } from "@/lib/forecast/types"

interface SliderDef {
  key: keyof ForecastParams
  label: string
  min: number
  max: number
  step: number
  unit: string
  description: string
}

const SLIDERS: SliderDef[] = [
  {
    key: "slotAdherencePct",
    label: "Slot Adherence",
    min: 20,
    max: 100,
    step: 5,
    unit: "%",
    description: "% of trucks arriving within their booked slot window",
  },
  {
    key: "rejectionPct",
    label: "Gate Rejection Rate",
    min: 0,
    max: 50,
    step: 5,
    unit: "%",
    description: "% of arriving trucks turned away (docs/licence issues)",
  },
  {
    key: "docsDelayPct",
    label: "Docs Delay Rate",
    min: 0,
    max: 60,
    step: 5,
    unit: "%",
    description: "% of trucks that face document verification hold inside yard",
  },
  {
    key: "avgLoadingMinutes",
    label: "Avg Loading Time",
    min: 30,
    max: 90,
    step: 5,
    unit: "min",
    description: "Average loading time per truck at bay (range 45–60 min typical)",
  },
]

interface Props {
  params: ForecastParams
  onChange: (params: ForecastParams) => void
  /** Whether the forecast is currently recalculating */
  isComputing?: boolean
}

export function SimulationPanel({ params, onChange, isComputing }: Props) {
  function handleChange(key: keyof ForecastParams, value: number) {
    onChange({ ...params, [key]: value })
  }

  function reset() {
    onChange({ ...DEFAULT_PARAMS })
  }

  const isModified = (Object.keys(DEFAULT_PARAMS) as (keyof ForecastParams)[]).some(
    (k) => params[k] !== DEFAULT_PARAMS[k],
  )

  return (
    <Card className="shadow-sm border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-indigo-600" />
          <CardTitle className="text-base text-indigo-900">
            Simulation Mode
          </CardTitle>
          {isModified && (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0 bg-indigo-100 text-indigo-700 border-indigo-300"
            >
              Modified
            </Badge>
          )}
          {isComputing && (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0 bg-slate-100 text-slate-500 border-slate-200 animate-pulse"
            >
              Recalculating…
            </Badge>
          )}
        </div>
        {isModified && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to live
          </button>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-xs text-slate-500">
          Adjust parameters below — the forecast recomputes instantly in your
          browser (no server round-trip) so you can explore &ldquo;what-if&rdquo; scenarios.
        </p>

        {SLIDERS.map((s) => {
          const value = params[s.key] as number
          const pct = ((value - s.min) / (s.max - s.min)) * 100
          const isChanged = value !== DEFAULT_PARAMS[s.key]

          return (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`sim-${s.key}`}
                  className={`text-xs font-medium ${
                    isChanged ? "text-indigo-700" : "text-slate-700"
                  }`}
                >
                  {s.label}
                  {isChanged && (
                    <span className="ml-1.5 text-[10px] text-indigo-500">
                      (was {DEFAULT_PARAMS[s.key]}
                      {s.unit})
                    </span>
                  )}
                </label>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    isChanged ? "text-indigo-700" : "text-slate-800"
                  }`}
                >
                  {value}
                  {s.unit}
                </span>
              </div>

              {/* Custom range slider */}
              <div className="relative">
                <input
                  id={`sim-${s.key}`}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={value}
                  onChange={(e) =>
                    handleChange(s.key, Number(e.target.value))
                  }
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  style={{
                    background: `linear-gradient(to right, #6366f1 ${pct}%, #e2e8f0 ${pct}%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>
                    {s.min}
                    {s.unit}
                  </span>
                  <span>
                    {s.max}
                    {s.unit}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                {s.description}
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
