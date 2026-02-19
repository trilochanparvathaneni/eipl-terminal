"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Zap,
  ClipboardCheck,
  ArrowRightLeft,
  Fuel,
  TrendingDown,
} from "lucide-react"
import type { Recommendation, RecommendationType } from "@/lib/forecast/types"

const TYPE_CONFIG: Record<
  RecommendationType,
  { label: string; icon: typeof Zap; color: string }
> = {
  slot_cap:          { label: "Slot Cap",       icon: Zap,            color: "text-red-600 bg-red-50 border-red-200" },
  docs_preclear:     { label: "Doc Pre-clear",  icon: ClipboardCheck, color: "text-blue-600 bg-blue-50 border-blue-200" },
  shift_trucks:      { label: "Shift Trucks",   icon: ArrowRightLeft, color: "text-amber-600 bg-amber-50 border-amber-200" },
  bay_priority:      { label: "Bay Priority",   icon: Fuel,           color: "text-purple-600 bg-purple-50 border-purple-200" },
  offpeak_incentive: { label: "Off-peak",       icon: TrendingDown,   color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
}

const PRIORITY_BADGE: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low:    "bg-slate-100 text-slate-600 border-slate-200",
}

interface Props {
  recommendations: Recommendation[]
}

export function RecommendationList({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-slate-500">
            No recommendations — terminal is operating within normal parameters.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recommended Actions</CardTitle>
        <p className="text-xs text-slate-500">
          Sorted by priority · tap any action to copy details
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec) => {
          const cfg = TYPE_CONFIG[rec.type]
          const Icon = cfg.icon

          return (
            <div
              key={rec.id}
              className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 hover:bg-slate-50/50 transition-colors"
            >
              {/* Header row */}
              <div className="flex items-start gap-2">
                <div
                  className={`shrink-0 rounded-md p-1.5 border ${cfg.color}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                    {rec.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              </div>

              {/* Footer row: priority + impact */}
              <div className="flex items-center gap-2 pt-1">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0 capitalize ${PRIORITY_BADGE[rec.priority]}`}
                >
                  {rec.priority}
                </Badge>
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <TrendingDown className="h-3 w-3" />
                  {rec.impact}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
