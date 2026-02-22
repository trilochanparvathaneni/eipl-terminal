import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { HelpTooltip } from "@/components/ui/help-tooltip"

interface DashboardTabItem {
  label: string
  value: string
  tooltip?: string
}

interface DashboardTabsProps {
  items: DashboardTabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function DashboardTabs({ items, value, onValueChange, className }: DashboardTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList className="h-auto w-full justify-start rounded-none border-b border-white/10 bg-transparent p-0">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className={cn(
              "relative rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium text-slate-400",
              "data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:text-slate-50 data-[state=active]:shadow-none"
            )}
          >
            <span className="inline-flex items-center gap-1">
              <span>{item.label}</span>
              {item.tooltip && <HelpTooltip description={item.tooltip} label={`${item.label} tab help`} />}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
