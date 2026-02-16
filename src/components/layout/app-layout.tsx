"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Sidebar } from "./sidebar"
import { NotificationBell } from "./notification-bell"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.replace("/login")
    }
  }, [status, pathname, router])

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

  return (
    <div className="min-h-screen">
      <Sidebar />

      {/* Top header bar */}
      <header className="lg:pl-64 fixed top-0 right-0 left-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-end h-14 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium leading-tight">{session.user.name}</p>
              <p className="text-xs text-muted-foreground leading-tight">{session.user.role.replace(/_/g, " ")}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 font-semibold"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="p-4 lg:p-8 pt-20 lg:pt-20">
          {children}
        </div>
      </main>
    </div>
  )
}
