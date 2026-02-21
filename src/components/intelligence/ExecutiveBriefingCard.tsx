"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Loader2, TrafficCone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { shortTip } from "@/lib/ui/tooltipCopy"
import { guardAssistAction } from "@/lib/assist/action-route-guard"

type BriefingStatus = "CRITICAL" | "BOTTLENECKED" | "STABLE"

interface ExecutiveBriefing {
  status: BriefingStatus
  headline: string
  key_metrics: string[]
  primary_action: {
    label: string
    action_url: string
  }
}

function statusStyles(status: BriefingStatus) {
  if (status === "CRITICAL") {
    return {
      border: "border-red-500",
      badge: "bg-red-100 text-red-700 border-red-300",
      icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
    }
  }
  if (status === "BOTTLENECKED") {
    return {
      border: "border-amber-500",
      badge: "bg-amber-100 text-amber-700 border-amber-300",
      icon: <TrafficCone className="h-4 w-4 text-amber-600" />,
    }
  }
  return {
    border: "border-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-300",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  }
}

export function ExecutiveBriefingCard() {
  const [data, setData] = useState<ExecutiveBriefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setError("")
        const res = await fetch("/api/intelligence/executive-briefing", { cache: "no-store" })
        if (!res.ok) throw new Error(`Failed to fetch briefing (${res.status})`)
        const payload = (await res.json()) as ExecutiveBriefing
        if (active) setData(payload)
      } catch (e: any) {
        if (active) setError(e?.message ?? "Failed to load executive briefing")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const styles = useMemo(
    () => statusStyles(data?.status ?? "STABLE"),
    [data?.status]
  )

  const compactMetrics = data?.key_metrics?.slice(0, 2) ?? []
  const primaryActionHref = data
    ? guardAssistAction({ label: data.primary_action.label, url: data.primary_action.action_url }).href
    : "/dashboard"

  return (
    <Card className={`border ${styles.border} bg-slate-900 text-slate-100`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            {styles.icon}
            Start-of-Day Executive Briefing
          </span>
          {data && (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>
              {data.status}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building terminal briefing...
          </div>
        )}
        {!loading && error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && data && (
          <>
            <p className="text-sm font-medium text-slate-100">{data.headline}</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {compactMetrics.map((metric) => (
                <li key={metric} title={shortTip(metric)} className="truncate">
                  - {metric}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={primaryActionHref}>
                <Button className="w-full sm:w-auto">{data.primary_action.label}</Button>
              </Link>
              <Link href="/reports" className="text-xs text-sky-300 hover:underline">
                View details
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
