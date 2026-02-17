"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"

// ─── Demo data — swap with real API later ──────────────────────────────────
const DEMO_NOTIFICATIONS = [
  { id: "1", message: "New booking #BK-1247 created", time: "5 min ago", type: "booking" as const, read: false },
  { id: "2", message: "Truck TN-01-AB-1234 entered terminal", time: "12 min ago", type: "trip" as const, read: false },
  { id: "3", message: "Incident #INC-003 escalated", time: "1 hour ago", type: "incident" as const, read: false },
  { id: "4", message: "Trip #TR-0891 completed", time: "2 hours ago", type: "trip" as const, read: false },
  { id: "5", message: "Driver document expired — Rajesh Kumar", time: "3 hours ago", type: "alert" as const, read: false },
]

const DOT_COLORS: Record<string, string> = {
  booking: "bg-blue-500",
  trip: "bg-green-500",
  incident: "bg-red-500",
  alert: "bg-amber-500",
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px] text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-background border rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-accent/50 ${
                  !n.read ? "bg-primary/[0.03]" : ""
                }`}
              >
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${DOT_COLORS[n.type]}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.read ? "font-medium" : "text-muted-foreground"}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                </div>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
