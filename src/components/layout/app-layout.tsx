"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Sidebar } from "./sidebar"
import { NotificationBell } from "./notification-bell"
import { ChatbotWidget } from "./chatbot-widget"
import { BrandMark } from "@/components/brand/BrandMark"
import { resolveTheme } from "@/lib/brand/theme"
import { getNavItems } from "@/lib/rbac"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Menu, Plus, Settings, LogOut, User, PlayCircle } from "lucide-react"
import { GlobalSearch } from "./global-search"
import { ProductTour } from "@/components/onboarding/product-tour"
import { useProductTour } from "@/hooks/use-product-tour"

function getUserInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const PUBLIC_PATHS = ["/login", "/live-ops"]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const theme = resolveTheme()
  const searchRef = useRef<HTMLInputElement>(null)
  const role = (session?.user as any)?.role as any
  const userId = (session?.user as any)?.id as string | undefined
  const { shouldShow: tourActive, completeTour, resetTour } = useProductTour(userId)

  // Mobile sidebar state lives here so the hamburger can live inside the header
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated" && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/login")
    }
  }, [status, pathname, router])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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

  return (
    <div className="min-h-screen">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/*
        Header spans full width on all screen sizes.
        On mobile (< lg): left section starts at pl-2, with hamburger button first,
          then brand mark — no more overlap.
        On desktop (lg+): left 256px is occupied by the fixed sidebar, so we
          add lg:pl-64 to push header content right of the sidebar.
      */}
      <header className="fixed top-0 right-0 left-0 z-30 bg-white border-b border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:pl-64">
        <div className="flex h-12 items-center gap-2 px-2 lg:gap-3 lg:px-5">

          {/* Hamburger — only visible on mobile (below lg) */}
          <button
            className="lg:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => setMobileSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Brand mark */}
          <div className="flex items-center shrink-0">
            <BrandMark theme={theme} size={28} variant="icon" />
          </div>

          {/* Global search — centered on md+ */}
          <div className="hidden md:flex flex-1 justify-center px-2 xl:px-6">
            {role && <GlobalSearch ref={searchRef} role={role} onTour={resetTour} />}
          </div>

          <div className="flex-1 md:hidden" />

          {/* Right controls */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => searchRef.current?.focus()}
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm transition-colors hover:bg-indigo-600"
              title="Quick search"
            >
              <Plus className="h-4 w-4" />
            </button>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 transition-all hover:ring-2 hover:ring-indigo-200"
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
                    <p className="text-xs text-muted-foreground font-normal">{session.user.email}</p>
                    <p className="text-xs text-muted-foreground font-normal capitalize">
                      {userRole.toLowerCase()}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => resetTour()}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Take a Tour
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/*
        Main content area.
        - lg:pl-64 offsets for the fixed 256px sidebar on desktop.
        - overflow-x-hidden prevents wide page content from causing body-level
          horizontal scroll, which would let content slide under the fixed sidebar.
        - pt-12 (48px) always clears the fixed header regardless of breakpoint.
        - Additional p-4 / lg:p-8 provides breathing room around page content.
      */}
      <main className="lg:pl-64 overflow-x-hidden">
        <div className="p-4 lg:p-8 pt-16 lg:pt-20">{children}</div>
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
