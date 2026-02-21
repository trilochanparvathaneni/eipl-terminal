"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Sidebar } from "./sidebar"
import { NotificationBell } from "./notification-bell"
import { ChatbotWidget } from "./chatbot-widget"
import { BrandMark } from "@/components/brand/BrandMark"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Menu, Settings, LogOut, User, PlayCircle, ChevronRight } from "lucide-react"
import { GlobalSearch } from "./global-search"
import { ProductTour } from "@/components/onboarding/product-tour"
import { useProductTour } from "@/hooks/use-product-tour"
import { cn } from "@/lib/utils"
import { DisplayArea } from "@/components/layout/display-area"

function getUserInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getPageLabel(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0] ?? "dashboard"
  return first
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const PUBLIC_PATHS = ["/login", "/live-ops"]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchRef = useRef<HTMLInputElement>(null)
  const role = (session?.user as any)?.role as any
  const userId = (session?.user as any)?.id as string | undefined
  const { shouldShow: tourActive, completeTour, resetTour } = useProductTour(userId)

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated" && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/login")
    }
  }, [status, pathname, router])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    const stored = window.localStorage.getItem("tm_sidebar_collapsed")
    if (stored === "1") setSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    window.localStorage.setItem("tm_sidebar_collapsed", sidebarCollapsed ? "1" : "0")
  }, [sidebarCollapsed])

  useEffect(() => {
    function handleGlobalSlashShortcut(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable

      if (e.key === "/" && !isTypingTarget) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleGlobalSlashShortcut)
    return () => window.removeEventListener("keydown", handleGlobalSlashShortcut)
  }, [])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (pathname === "/login" || pathname === "/live-ops") {
    return <>{children}</>
  }

  if (!session) return null

  const userName = session.user.name || "User"
  const userRole = (session.user as any).role?.replace(/_/g, " ") || "User"
  const initials = getUserInitials(userName)
  const pageLabel = getPageLabel(pathname)
  const sidebarWidth = sidebarCollapsed ? "lg:w-20" : "lg:w-64"
  const mainOffset = sidebarCollapsed ? "lg:pl-28" : "lg:pl-72"

  return (
    <div className="min-h-screen">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
      />

      <header className="fixed left-0 right-0 top-0 z-30 border-b border-white/10 bg-[#0f172a]/85 shadow-[0_16px_40px_-30px_rgba(2,6,23,0.9)] backdrop-blur-[14px]">
        <div className="flex h-14 items-stretch">
          <div className={cn("hidden shrink-0 items-center border-r border-white/10 px-4 lg:flex", sidebarWidth)}>
            {!sidebarCollapsed ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-xs font-medium text-slate-400">Terminal Ops</span>
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />
                <span className="truncate text-sm font-semibold text-slate-100">{pageLabel}</span>
              </div>
            ) : (
              <span className="mx-auto text-[11px] font-semibold uppercase tracking-wide text-slate-300">Ops</span>
            )}
          </div>

          <div className="flex flex-1 items-center gap-4 px-4 lg:gap-6 lg:px-8">
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 transition-all duration-300 ease-in-out hover:bg-white/[0.08] hover:text-slate-50 lg:hidden"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="hidden min-w-0 flex-1 justify-center px-4 lg:px-8 xl:px-16 md:flex">
              {role && <GlobalSearch ref={searchRef} role={role} onTour={resetTour} />}
            </div>

            <div className="flex-1 md:hidden" />

            <div className="ml-auto flex shrink-0 items-center gap-5">
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-sm font-semibold text-slate-100 transition-all duration-300 ease-in-out hover:bg-white/[0.1] hover:ring-2 hover:ring-white/25 hover:ring-offset-1 hover:ring-offset-slate-900/70"
                    data-tour="profile"
                    title={userName}
                  >
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div>
                      <p className="font-medium">{userName}</p>
                      <p className="text-xs font-normal text-muted-foreground">{session.user.email}</p>
                      <p className="text-xs font-normal capitalize text-muted-foreground">
                        {userRole.toLowerCase()}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => resetTour()}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Take a Tour
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="hidden h-8 w-20 shrink-0 overflow-hidden opacity-90 lg:block">
                <BrandMark />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={cn("overflow-x-hidden pt-16 lg:pt-20", mainOffset)}>
        <DisplayArea>{children}</DisplayArea>
      </main>

      <div data-tour="chatbot">
        <ChatbotWidget role={role} />
      </div>

      {role && (
        <ProductTour
          active={tourActive}
          role={role}
          onComplete={completeTour}
        />
      )}
    </div>
  )
}
