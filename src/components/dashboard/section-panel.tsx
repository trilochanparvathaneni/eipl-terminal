import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"

interface SectionPanelProps {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function SectionPanel({
  title,
  action,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
}: SectionPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 px-4 py-3">
        <CardTitle className="text-sm font-semibold tracking-wide text-slate-100">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {action}
          {collapsible && (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-md border border-white/15 p-1 text-slate-400 transition-all duration-300 ease-in-out hover:bg-white/[0.08] hover:text-slate-200"
              aria-label={collapsed ? "Expand section" : "Collapse section"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
            </button>
          )}
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="p-4">{children}</CardContent>}
    </Card>
  )
}
