"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { getNavItems } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import {
  ChevronsLeft,
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Truck,
  Shield,
  HardHat,
  BarChart3,
  FileText,
  Radio,
  FolderOpen,
  FileCheck,
  Crosshair,
  TrendingUp,
  MonitorDot,
  MessageSquare,
  Settings,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const iconMap: Record<string, any> = {
  Dashboard: LayoutDashboard,
  Bookings: ClipboardList,
  Schedule: CalendarDays,
  "My Trips": Truck,
  "Gate Ops": Shield,
  HSE: HardHat,
  Reports: BarChart3,
  "Audit Logs": FileText,
  Controller: Radio,
  Documents: FolderOpen,
  "Doc Review": FileCheck,
  "Yard Console": Crosshair,
  Forecast: TrendingUp,
  "Live Ops": MonitorDot,
  Communications: MessageSquare,
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

const navGroups: Array<{ label: string; items: string[] }> = [
  { label: "Operations", items: ["Dashboard", "Bookings", "Schedule", "My Trips", "Gate Ops", "HSE"] },
  { label: "Monitors", items: ["Yard Console", "Controller", "Forecast", "Live Ops"] },
  { label: "Insights", items: ["Reports", "Audit Logs", "Doc Review", "Documents", "Forms", "Communications"] },
]

export function Sidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()

  if (!session?.user) return null

  const navItems = getNavItems(session.user.role as any)
  const grouped = navGroups
    .map((group) => ({
      ...group,
      links: navItems.filter((item) => group.items.includes(item.label)),
    }))
    .filter((group) => group.links.length > 0)
  const groupedLabels = new Set(grouped.flatMap((group) => group.links.map((item) => item.label)))
  const ungrouped = navItems.filter((item) => !groupedLabels.has(item.label))
  if (ungrouped.length) grouped.push({ label: "More", items: [], links: ungrouped })

  const linkClass = (isActive: boolean) =>
    cn(
      "group relative flex items-center rounded-lg border border-transparent px-3 py-2 text-[13px] font-medium transition-all",
      collapsed ? "justify-center px-2" : "gap-3",
      isActive
        ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
        : "text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
    )

  const nav = (
    <div className="flex h-full flex-col bg-[#0f172a] text-slate-200">
      <div className={cn("flex h-14 items-center border-b border-slate-800", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Terminal Ops</p>
            <p className="text-[11px] text-slate-500">Operations Console</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-100 lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-3 pt-3">
        {grouped.map((group) => (
          <div key={group.label} className="space-y-1.5">
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{group.label}</p>
            )}
            {group.links.map((item) => {
              const Icon = iconMap[item.label] || LayoutDashboard
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
              const content = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={linkClass(isActive)}
                >
                  {isActive && <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-blue-600" />}
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )

              if (!collapsed) return content

              return (
                <TooltipProvider key={item.href} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-800 p-2">
        <button
          type="button"
          className={cn(
            "flex w-full items-center rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100",
            collapsed ? "justify-center px-2" : "gap-2"
          )}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
      <div className="shrink-0 border-t border-slate-800 p-2">
        <div className={cn("rounded-md px-2 py-2", collapsed ? "text-center" : "") }>
          {!collapsed && <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Workspace</p>}
          <p className="text-[11px] text-slate-400">EIPL Terminal</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 top-0 w-72 overflow-hidden border-r border-slate-800 shadow-xl">
            {nav}
          </div>
        </div>
      )}

      <div
        className={cn(
          "hidden border-r border-slate-800 lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-200",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
        data-tour="sidebar"
      >
        {nav}
      </div>
    </>
  )
}
