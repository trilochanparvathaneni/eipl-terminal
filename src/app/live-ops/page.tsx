"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { Role } from "@prisma/client"
import { Activity, Clock, Loader2, PackageCheck, ShieldCheck, Truck, XCircle } from "lucide-react"
import { MovementsBoard, type MovementRowUi } from "@/components/live/MovementsBoard"
import { ExecutiveBriefingCard } from "@/components/intelligence/ExecutiveBriefingCard"
import { shortTip } from "@/lib/ui/tooltipCopy"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type LiveSnapshot = {
  rows: MovementRowUi[]
  alerts: MovementRowUi[]
  insights: Array<{ key: string; label: string }>
  metrics: {
    waitingOutside: number
    insideTerminal: number
    atWeighbridge: number
    atInspection: number
    atLoading: number
    completedToday: number
    rejectedToday: number
    avgTurnaroundMin: number
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function MetricCard(props: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  const Icon = props.icon
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{props.label}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p title={shortTip(props.title)} className="text-2xl font-semibold text-slate-100">
        {props.value}
      </p>
    </div>
  )
}

export default function LiveOpsPage() {
  const { data: session, status } = useSession()
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date())

  const role = (session?.user?.role || "CLIENT") as Role
  const canAccessLiveOps = role !== Role.CLIENT && role !== Role.TRANSPORTER

  useEffect(() => {
    if (!canAccessLiveOps) {
      setIsLoading(false)
      return
    }
    let isMounted = true

    async function pull(initial = false) {
      if (initial) setIsLoading(true)
      else setIsRefreshing(true)
      try {
        const res = await fetch("/api/live/movements", { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch live movements.")
        }
        if (!isMounted) return
        setSnapshot(data)
        setUpdatedAt(new Date())
        setError("")
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : "Failed to fetch live movements.")
      } finally {
        if (!isMounted) return
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }

    pull(true)
    const intervalId = setInterval(() => pull(false), 8000)
    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [canAccessLiveOps])

  const metrics = snapshot?.metrics
  const kpiCards = useMemo(
    () =>
      metrics
        ? [
            { label: "Waiting Outside", value: metrics.waitingOutside, icon: Clock, title: "Trucks waiting before gate entry." },
            { label: "Inside Terminal", value: metrics.insideTerminal, icon: Truck, title: "Trucks currently moving inside terminal." },
            { label: "At Weighbridge", value: metrics.atWeighbridge, icon: Activity, title: "Trucks in weighment stages." },
            { label: "At Inspection", value: metrics.atInspection, icon: ShieldCheck, title: "Trucks in safety/document checks." },
            { label: "At Loading", value: metrics.atLoading, icon: PackageCheck, title: "Trucks in active loading stages." },
            { label: "Completed Today", value: metrics.completedToday, icon: PackageCheck, title: "Trips completed and exited today." },
            { label: "Rejected Today", value: metrics.rejectedToday, icon: XCircle, title: "Trips blocked or rejected today." },
            { label: "Avg Turnaround", value: `${metrics.avgTurnaroundMin}m`, icon: Clock, title: "Average gate-in to gate-out cycle." },
          ]
        : [],
    [metrics]
  )

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading Live Ops...
      </div>
    )
  }

  if (!canAccessLiveOps) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not authorized</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Live Ops command panel is available to internal terminal roles only.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Live Ops</h1>
          <p className="text-xs text-slate-600">Compact live terminal view for movement decisions.</p>
        </div>
        <p className="text-xs text-slate-600">Updated {formatTime(updatedAt)}</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">AI Risk Analysis</p>
        <ExecutiveBriefingCard role={role} />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(snapshot?.insights || []).map((insight) => (
          <span
            key={insight.key}
            title={shortTip(insight.label)}
            className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs text-sky-700"
          >
            {insight.label}
          </span>
        ))}
      </div>

      <MovementsBoard
        role={role}
        rows={snapshot?.rows || []}
        alerts={snapshot?.alerts || []}
        updatedAtLabel={formatTime(updatedAt)}
        isRefreshing={isRefreshing}
      />
    </div>
  )
}
