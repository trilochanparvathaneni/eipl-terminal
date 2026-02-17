"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { getNavItems } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BrandLockup } from "@/components/brand/BrandLockup"
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Truck,
  Shield,
  HardHat,
  BarChart3,
  FileText,
  Menu,
  X,
  Radio,
  FolderOpen,
  FileCheck,
  Crosshair,
} from "lucide-react"
import { useState } from "react"

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
}

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!session?.user) return null

  const navItems = getNavItems(session.user.role as any)

  const nav = (
    <div className="flex flex-col h-full">
      <div className="mt-8 mb-2 mx-3 px-3 py-3 rounded-lg bg-gray-50 border border-gray-200">
        <BrandLockup variant="sidebar" />
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.label] || LayoutDashboard
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Terminal Ops</p>
          <p className="text-[11px] text-muted-foreground">Operations Console</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-3">
        <Button variant="outline" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-background border-r">
            {nav}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-background" data-tour="sidebar">
        {nav}
      </div>
    </>
  )
}
