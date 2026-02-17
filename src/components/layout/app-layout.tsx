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
import { Search, Plus, Settings, LogOut, User } from "lucide-react"

type SearchTarget = {
  id: string
  label: string
  subtitle: string
  href?: string
  action?: "signout"
}

function getUserInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const theme = resolveTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const role = (session?.user as any)?.role as any

  const searchTargets = useMemo<SearchTarget[]>(() => {
    const navTargets = role
      ? getNavItems(role).map((item) => ({
          id: item.href,
          label: item.label,
          subtitle: item.href,
          href: item.href,
        }))
      : []

    return [
      ...navTargets,
      { id: "/notifications", label: "Notifications", subtitle: "/notifications", href: "/notifications" },
      { id: "signout", label: "Sign out", subtitle: "End current session", action: "signout" },
    ]
  }, [role])

  const filteredTargets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const source = q
      ? searchTargets.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        )
      : searchTargets

    return source.slice(0, 8)
  }, [searchTargets, searchQuery])

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.replace("/login")
    }
  }, [status, pathname, router])

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

  if (pathname === "/login") {
    return <>{children}</>
  }

  if (!session) return null

  const userName = session.user.name || "User"
  const userRole = (session.user as any).role?.replace(/_/g, " ") || "User"
  const initials = getUserInitials(userName)
  function runSearchTarget(target: SearchTarget) {
    setSearchOpen(false)
    setSearchQuery("")

    if (target.action === "signout") {
      signOut({ callbackUrl: "/login" })
      return
    }

    if (target.href) {
      router.push(target.href)
    }
  }

  return (
    <div className="min-h-screen">
      <Sidebar />

      <header className="fixed top-0 right-0 left-0 z-30 bg-white border-b border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:pl-64">
        <div className="flex h-12 items-center gap-3 px-3 lg:px-5">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <BrandMark theme={theme} size={28} variant="icon" />
            <span className="hidden sm:inline truncate font-semibold tracking-tight text-[15px] text-slate-800">
              {theme.productName}
            </span>
          </div>

          <div className="hidden md:flex flex-1 justify-center px-2 xl:px-6">
            <div className="relative w-full max-w-[560px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredTargets.length > 0) {
                    e.preventDefault()
                    runSearchTarget(filteredTargets[0])
                  }
                }}
                placeholder="Search pages and actions ( / )"
                className="h-8 w-full rounded-full border border-transparent bg-slate-100 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              />

              {searchOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {filteredTargets.length === 0 ? (
                    <div className="px-3 py-2.5 text-sm text-slate-500">No matching pages or actions.</div>
                  ) : (
                    <div className="py-1">
                      {filteredTargets.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => runSearchTarget(target)}
                          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-100"
                        >
                          <span className="text-sm font-medium text-slate-700">{target.label}</span>
                          <span className="text-xs text-slate-400">{target.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 md:hidden" />

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <div className="hidden xl:flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {theme.productName}
            </div>

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
                    <p className="text-xs text-muted-foreground font-normal capitalize">{userRole.toLowerCase()}</p>
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

      <main className="lg:pl-64">
        <div className="p-4 lg:p-8 pt-20 lg:pt-20">{children}</div>
      </main>
      <ChatbotWidget role={role} />
    </div>
  )
}
