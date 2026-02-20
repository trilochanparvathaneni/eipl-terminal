"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { getNavItems } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import {
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
} from "lucide-react"

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
  "Forecast": TrendingUp,
  "Live Ops": MonitorDot,
  "Communications": MessageSquare,
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()

  if (!session?.user) return null

  const navItems = getNavItems(session.user.role as any)

  const nav = (
    <div className="flex flex-col h-full">
      {/* Nav list — pt-14 clears the fixed h-14 header */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-14 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.label] || LayoutDashboard
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3 shrink-0">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Terminal Ops
          </p>
          <p className="text-[11px] text-muted-foreground">Operations Console</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile sidebar — full-screen overlay with slide-in panel */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-background border-r shadow-xl overflow-hidden">
            {nav}
          </div>
        </div>
      )}

      {/* Desktop sidebar — fixed, full height */}
      <div
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-background"
        data-tour="sidebar"
      >
        {nav}
      </div>
    </>
  )
}
