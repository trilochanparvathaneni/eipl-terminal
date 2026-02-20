import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FilterBarProps {
  left?: ReactNode
  middle?: ReactNode
  right?: ReactNode
  sticky?: boolean
  className?: string
}

export function FilterBar({ left, middle, right, sticky = true, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm",
        "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
        sticky && "sticky top-16 z-20",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{left}</div>
      {middle && <div className="flex shrink-0 items-end gap-2">{middle}</div>}
      <div className="flex shrink-0 flex-wrap items-end justify-start gap-2 lg:justify-end">{right}</div>
    </div>
  )
}
