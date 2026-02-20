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
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {hasColumnSelector && (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                <Settings2 className="h-3.5 w-3.5" />
                Columns
                <HelpTooltip description="Choose which columns to show. Hide fields that are not useful for this view." label="Columns help" />
                {hiddenCount > 0 && <span className="rounded bg-slate-200 px-1 text-[10px]">{hiddenCount}</span>}
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-slate-200 bg-white p-2 shadow-md">
                {columns?.map((col) => {
                  const checked = visibleColumns.includes(col.id)
                  return (
                    <label key={col.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
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
            <div key={idx} className="h-9 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : rowCount === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="overflow-x-auto [&_table]:text-[13px] [&_tbody_tr:hover]:bg-slate-50/80 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-slate-50/90 [&_th]:h-10 [&_th]:px-3 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:px-3 [&_td]:py-2.5">
          {children}
        </div>
      )}
    </div>
  )
}
