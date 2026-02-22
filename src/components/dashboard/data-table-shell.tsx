import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Download, Settings2 } from "lucide-react"
import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { HelpTooltip } from "@/components/ui/help-tooltip"

interface DataTableShellProps {
  title: string
  description?: string
  rowCount?: number
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onExport?: () => void
  columns?: Array<{ id: string; label: string }>
  children: ReactNode
  className?: string
}

export function DataTableShell({
  title,
  description,
  rowCount = 0,
  loading,
  emptyTitle = "No results",
  emptyDescription = "Try changing filters to view data.",
  onExport,
  columns,
  children,
  className,
}: DataTableShellProps) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => columns?.map((c) => c.id) ?? [])
  const hasColumnSelector = Boolean(columns?.length)
  const hiddenCount = useMemo(() => Math.max((columns?.length ?? 0) - visibleColumns.length, 0), [columns, visibleColumns])

  return (
    <div className={cn("luxury-surface overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {hasColumnSelector && (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-white/15 bg-white/[0.02] px-2 py-1 text-xs text-slate-300 transition-all duration-300 ease-in-out hover:bg-white/[0.06]">
                <Settings2 className="h-3.5 w-3.5" />
                Columns
                <HelpTooltip description="Choose which columns to show. Hide fields that are not useful for this view." label="Columns help" />
                {hiddenCount > 0 && <span className="rounded bg-white/15 px-1 text-[10px] text-slate-100">{hiddenCount}</span>}
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-white/15 bg-slate-900/95 p-2 shadow-md backdrop-blur-md">
                {columns?.map((col) => {
                  const checked = visibleColumns.includes(col.id)
                  return (
                    <label key={col.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVisibleColumns((prev) => [...prev, col.id])
                          } else {
                            setVisibleColumns((prev) => prev.filter((id) => id !== col.id))
                          }
                        }}
                      />
                      <span>{col.label}</span>
                    </label>
                  )
                })}
              </div>
            </details>
          )}
          {onExport && (
            <span className="inline-flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={onExport} className="h-8 text-xs">
                <Download className="mr-1 h-3.5 w-3.5" /> Export
              </Button>
              <HelpTooltip description="Download this table as a CSV file so you can share or analyze it offline." label="Export help" />
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-9 animate-pulse rounded bg-white/[0.08]" />
          ))}
        </div>
      ) : rowCount === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-100">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-400">{emptyDescription}</p>
        </div>
      ) : (
        <div className="overflow-x-auto [&_table]:text-[13px] [&_tbody_tr:hover]:bg-white/[0.04] [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-slate-900/80 [&_th]:h-10 [&_th]:px-3 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-2.5">
          {children}
        </div>
      )}
    </div>
  )
}
