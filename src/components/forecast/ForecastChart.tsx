"use client"

import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import type { ForecastBucket } from "@/lib/forecast/types"

interface Props {
  buckets: ForecastBucket[]
  /** Outside queue limit (default 15) */
  outsideLimit?: number
  /** Inside yard limit (default 8) */
  insideLimit?: number
  /** Total bays (default 18) */
  totalBays?: number
}

interface ChartRow {
  label: string
  outside: number
  inside: number
  bays: number
  turnaround: number
  arrivals: number
  outsideOverflow: boolean
  insideOverflow: boolean
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: p.color }}
          />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-medium text-slate-800">
            {typeof p.value === "number"
              ? p.name.includes("Occupancy") || p.name.includes("occupancy")
                ? `${p.value}%`
                : p.value.toFixed(1)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ForecastChart({
  buckets,
  outsideLimit = 15,
  insideLimit = 8,
  totalBays = 18,
}: Props) {
  const data: ChartRow[] = buckets.map((b) => ({
    label: b.label,
    outside: b.queueOutside,
    inside: b.queueInside,
    bays: b.baysOccupied,
    turnaround: b.avgTurnaroundMinutes,
    arrivals: b.expectedArrivals,
    outsideOverflow: b.outsideOverflow,
    insideOverflow: b.insideOverflow,
  }))

  return (
    <div className="space-y-6">
      {/* Queue chart */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Queue Forecast — Outside &amp; Inside Yard
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 8 }}
            />
            {/* Danger reference lines */}
            <ReferenceLine
              y={outsideLimit}
              stroke="#ef4444"
              strokeDasharray="4 3"
              label={{ value: `Limit ${outsideLimit}`, fontSize: 10, fill: "#ef4444", position: "right" }}
            />
            <ReferenceLine
              y={insideLimit}
              stroke="#f97316"
              strokeDasharray="4 3"
              label={{ value: `Limit ${insideLimit}`, fontSize: 10, fill: "#f97316", position: "right" }}
            />
            <Area
              type="monotone"
              dataKey="outside"
              name="Outside queue"
              fill="#fca5a5"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={0.35}
            />
            <Area
              type="monotone"
              dataKey="inside"
              name="Inside yard"
              fill="#fdba74"
              stroke="#f97316"
              strokeWidth={2}
              fillOpacity={0.35}
            />
            <Bar
              dataKey="arrivals"
              name="Expected arrivals"
              fill="#a5b4fc"
              opacity={0.7}
              radius={[3, 3, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bay occupancy + turnaround chart */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Bay Occupancy &amp; Avg Turnaround
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="bays"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={28}
              domain={[0, totalBays]}
              label={{
                value: "Bays",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 9, fill: "#94a3b8" },
              }}
            />
            <YAxis
              yAxisId="time"
              orientation="right"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={36}
              label={{
                value: "Min",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 9, fill: "#94a3b8" },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 8 }}
            />
            <ReferenceLine
              yAxisId="bays"
              y={totalBays}
              stroke="#6366f1"
              strokeDasharray="4 3"
              label={{ value: `${totalBays} bays`, fontSize: 10, fill: "#6366f1", position: "right" }}
            />
            <Bar
              yAxisId="bays"
              dataKey="bays"
              name="Bays occupied"
              fill="#6366f1"
              opacity={0.75}
              radius={[3, 3, 0, 0]}
            />
            <Area
              yAxisId="time"
              type="monotone"
              dataKey="turnaround"
              name="Avg turnaround (min)"
              stroke="#10b981"
              fill="#6ee7b7"
              strokeWidth={2}
              fillOpacity={0.25}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
