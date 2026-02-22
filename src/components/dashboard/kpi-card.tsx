import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { HelpTooltip } from "@/components/ui/help-tooltip"

interface KpiCardProps {
  title: string
  value: string
  delta?: string
  deltaTone?: "positive" | "negative" | "neutral"
  tooltip?: string
  valueTooltip?: string
  deltaTooltip?: string
  supportingText?: string
}

export function KpiCard({
  title,
  value,
  delta,
  deltaTone = "neutral",
  tooltip,
  valueTooltip,
  deltaTooltip,
  supportingText,
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span>{title}</span>
          {tooltip && <HelpTooltip description={tooltip} label={`${title} help`} />}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 text-2xl font-semibold leading-none text-slate-50">
            <span>{value}</span>
            {valueTooltip && <HelpTooltip description={valueTooltip} label={`${title} value help`} />}
          </div>
          {delta && (
            <span className="inline-flex items-center gap-1">
              <Badge
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                  deltaTone === "positive" && "bg-emerald-500/15 text-emerald-200",
                  deltaTone === "negative" && "bg-red-500/15 text-red-200",
                  deltaTone === "neutral" && "bg-white/10 text-slate-200"
                )}
              >
                {delta}
              </Badge>
              {deltaTooltip && <HelpTooltip description={deltaTooltip} label={`${title} delta help`} />}
            </span>
          )}
        </div>
        {supportingText && <p className="text-xs text-slate-400">{supportingText}</p>}
      </CardContent>
    </Card>
  )
}

export function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.15]" />
        <div className="h-7 w-20 animate-pulse rounded bg-white/[0.15]" />
        <div className="h-3 w-28 animate-pulse rounded bg-white/[0.15]" />
      </CardContent>
    </Card>
  )
}
