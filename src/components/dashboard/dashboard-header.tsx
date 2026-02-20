import type { ReactNode } from "react"
import { Clock3 } from "lucide-react"

interface DashboardHeaderProps {
  title: string
  subtitle?: string
  lastUpdated?: string
  controls?: ReactNode
}

export function DashboardHeader({ title, subtitle, lastUpdated, controls }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <div className="hidden items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 md:flex">
            <Clock3 className="h-3.5 w-3.5" />
            <span>Last updated {lastUpdated}</span>
          </div>
        )}
        {controls}
      </div>
    </div>
  )
}
