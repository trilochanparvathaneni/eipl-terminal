import type { ReactNode } from "react"
import { Clock3 } from "lucide-react"

interface DashboardHeaderProps {
  title: string
  subtitle?: string
  lastUpdated?: string
  controls?: ReactNode
  variant?: "dark" | "light"
}

export function DashboardHeader({ title, subtitle, lastUpdated, controls, variant = "dark" }: DashboardHeaderProps) {
  const isLight = variant === "light"
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className={isLight ? "text-[22px] font-semibold tracking-tight text-slate-800" : "text-[22px] font-semibold tracking-tight text-slate-50"}>{title}</h1>
        {subtitle && <p className={isLight ? "mt-1 text-sm text-slate-500" : "mt-1 text-sm text-slate-400"}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <div className={isLight ? "hidden items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 md:flex" : "hidden items-center gap-1 rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 md:flex"}>
            <Clock3 className="h-3.5 w-3.5" />
            <span>Last updated {lastUpdated}</span>
          </div>
        )}
        {controls}
      </div>
    </div>
  )
}
