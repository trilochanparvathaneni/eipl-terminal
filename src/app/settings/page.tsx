"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Settings, Save, Wrench, Building2 } from "lucide-react"

const STORAGE_KEYS = {
  sidebarCollapsed: "tm_sidebar_collapsed",
  defaultRoute: "tm_default_route",
  tooltipEnabled: "tm_tooltips_enabled",
  compactDensity: "tm_compact_density",
  dateFormat: "tm_date_format",
  desktopAlerts: "tm_desktop_alerts",
  alertSound: "tm_alert_sound",
  emailDigest: "tm_email_digest",
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [defaultRoute, setDefaultRoute] = useState("/dashboard")
  const [tooltipEnabled, setTooltipEnabled] = useState(true)
  const [compactDensity, setCompactDensity] = useState(false)
  const [dateFormat, setDateFormat] = useState("DD-MMM-YYYY")
  const [desktopAlerts, setDesktopAlerts] = useState(true)
  const [alertSound, setAlertSound] = useState(true)
  const [emailDigest, setEmailDigest] = useState(false)
  const [selectedBayId, setSelectedBayId] = useState("")
  const [selectedAction, setSelectedAction] = useState("maintenance")

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1")
    setDefaultRoute(localStorage.getItem(STORAGE_KEYS.defaultRoute) || "/dashboard")
    setTooltipEnabled(localStorage.getItem(STORAGE_KEYS.tooltipEnabled) !== "0")
    setCompactDensity(localStorage.getItem(STORAGE_KEYS.compactDensity) === "1")
    setDateFormat(localStorage.getItem(STORAGE_KEYS.dateFormat) || "DD-MMM-YYYY")
    setDesktopAlerts(localStorage.getItem(STORAGE_KEYS.desktopAlerts) !== "0")
    setAlertSound(localStorage.getItem(STORAGE_KEYS.alertSound) !== "0")
    setEmailDigest(localStorage.getItem(STORAGE_KEYS.emailDigest) === "1")
  }, [])

  const role = (session?.user as any)?.role as string | undefined
  const canManageInfra = ["SUPER_ADMIN", "TERMINAL_ADMIN", "TRAFFIC_CONTROLLER"].includes(role || "")

  const { data: baysData, refetch: refetchBays, isFetching: baysLoading } = useQuery({
    queryKey: ["settings-bays"],
    queryFn: async () => {
      const r = await fetch("/api/lookup/bays")
      if (!r.ok) throw new Error("Failed to load bays")
      return r.json()
    },
    enabled: canManageInfra,
  })
  const bays = baysData?.bays || []
  const selectedBay = bays.find((b: any) => b.id === selectedBayId)
  const gantrySummary = Object.values(
    bays.reduce((acc: Record<string, { name: string; count: number }>, bay: any) => {
      const key = bay.gantry?.id || "unknown"
      if (!acc[key]) acc[key] = { name: bay.gantry?.name || "Unknown", count: 0 }
      acc[key].count += 1
      return acc
    }, {})
  ) as Array<{ name: string; count: number }>

  const bayActionMutation = useMutation({
    mutationFn: async (payload: { bayId: string; action: string }) => {
      const r = await fetch("/api/controller/bay-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error?.message || "Bay action failed")
      return data
    },
    onSuccess: (data) => {
      toast({ title: "Bay updated", description: `Action "${data.action}" applied.` })
      refetchBays()
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" })
    },
  })

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, sidebarCollapsed ? "1" : "0")
    localStorage.setItem(STORAGE_KEYS.defaultRoute, defaultRoute)
    localStorage.setItem(STORAGE_KEYS.tooltipEnabled, tooltipEnabled ? "1" : "0")
    localStorage.setItem(STORAGE_KEYS.compactDensity, compactDensity ? "1" : "0")
    localStorage.setItem(STORAGE_KEYS.dateFormat, dateFormat)
    localStorage.setItem(STORAGE_KEYS.desktopAlerts, desktopAlerts ? "1" : "0")
    localStorage.setItem(STORAGE_KEYS.alertSound, alertSound ? "1" : "0")
    localStorage.setItem(STORAGE_KEYS.emailDigest, emailDigest ? "1" : "0")

    toast({
      title: "Settings saved",
      description: "Your preferences were saved for this browser.",
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6 text-blue-600" />
          Settings
        </h1>
        <Button onClick={saveSettings}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Defaults for how your dashboard opens and behaves.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="inline-flex items-center gap-1">
              Default Landing Page
              <HelpTooltip description="What it is: Page to open first after sign-in. Why it matters: Gets you to your most-used workspace faster." />
            </Label>
            <Select value={defaultRoute} onValueChange={setDefaultRoute}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/dashboard">Dashboard</SelectItem>
                <SelectItem value="/bookings">Bookings</SelectItem>
                <SelectItem value="/schedule">Schedule</SelectItem>
                <SelectItem value="/reports">Reports</SelectItem>
                <SelectItem value="/notifications">Notifications</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="sidebar_collapsed"
              checked={sidebarCollapsed}
              onCheckedChange={(v) => setSidebarCollapsed(Boolean(v))}
            />
            <Label htmlFor="sidebar_collapsed" className="font-normal">
              Start with collapsed sidebar
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Readability and information density preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="tooltips_enabled"
              checked={tooltipEnabled}
              onCheckedChange={(v) => setTooltipEnabled(Boolean(v))}
            />
            <Label htmlFor="tooltips_enabled" className="font-normal">
              Show help tooltips
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="compact_density"
              checked={compactDensity}
              onCheckedChange={(v) => setCompactDensity(Boolean(v))}
            />
            <Label htmlFor="compact_density" className="font-normal">
              Compact table density
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label>Date format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Control alert behavior in this browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="desktop_alerts"
              checked={desktopAlerts}
              onCheckedChange={(v) => setDesktopAlerts(Boolean(v))}
            />
            <Label htmlFor="desktop_alerts" className="font-normal">Desktop pop-up alerts</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="alert_sound"
              checked={alertSound}
              onCheckedChange={(v) => setAlertSound(Boolean(v))}
            />
            <Label htmlFor="alert_sound" className="font-normal">Play notification sound</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="email_digest"
              checked={emailDigest}
              onCheckedChange={(v) => setEmailDigest(Boolean(v))}
            />
            <Label htmlFor="email_digest" className="font-normal">Email digest summary</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Basic profile details from your sign-in session.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input value={session?.user?.name || ""} readOnly className="bg-slate-50" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={session?.user?.email || ""} readOnly className="bg-slate-50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600" />
            Infrastructure Intake
          </CardTitle>
          <CardDescription>Bay and gantry operational controls for admin/controller roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManageInfra ? (
            <p className="text-sm text-slate-500">You do not have permission to modify bay or gantry operations.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="inline-flex items-center gap-1">
                    Select Bay
                    <HelpTooltip description="What it is: Bay to update. Why it matters: Actions below apply to this selected bay." />
                  </Label>
                  <Select value={selectedBayId} onValueChange={setSelectedBayId}>
                    <SelectTrigger>
                      <SelectValue placeholder={baysLoading ? "Loading bays..." : "Pick a bay"} />
                    </SelectTrigger>
                    <SelectContent>
                      {bays.map((bay: any) => (
                        <SelectItem key={bay.id} value={bay.id}>
                          {bay.gantry?.name} / {bay.uniqueCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="inline-flex items-center gap-1">
                    Bay Action
                    <HelpTooltip description="What it is: State transition for the selected bay. Why it matters: Controls availability for assignment." />
                  </Label>
                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Set Maintenance</SelectItem>
                      <SelectItem value="end_maintenance">End Maintenance</SelectItem>
                      <SelectItem value="set_ready_changeover">Mark Ready Changeover</SelectItem>
                      <SelectItem value="lock">Lock Bay</SelectItem>
                      <SelectItem value="unlock">Unlock Bay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => selectedBayId && bayActionMutation.mutate({ bayId: selectedBayId, action: selectedAction })}
                  disabled={!selectedBayId || bayActionMutation.isPending}
                  title="Apply selected action to the selected bay."
                >
                  {bayActionMutation.isPending ? "Applying..." : "Apply Bay Action"}
                </Button>
                <Button variant="outline" onClick={() => refetchBays()} title="Reload current bay and gantry state.">
                  Refresh Bay Data
                </Button>
                <Button asChild variant="outline" title="Open yard console for detailed bay and arm controls.">
                  <Link href="/controller/yard-console">Open Bay Console</Link>
                </Button>
                <Button asChild variant="outline" title="Open controller console for queue and gantry-linked decisions.">
                  <Link href="/controller/console">Open Gantry Controls</Link>
                </Button>
              </div>

              {selectedBay && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-800">{selectedBay.gantry?.name} / {selectedBay.uniqueCode}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Status: {selectedBay.status}</Badge>
                    <Badge variant="outline">Changeover: {selectedBay.changeoverState}</Badge>
                    {selectedBay.currentProduct?.name && <Badge variant="outline">Product: {selectedBay.currentProduct.name}</Badge>}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="inline-flex items-center gap-1 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  Gantry Overview
                  <HelpTooltip description="What it is: Bay counts grouped by gantry. Why it matters: Helps spot uneven capacity distribution." />
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {gantrySummary.map((g) => (
                    <div key={g.name} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{g.name}</span>
                      <span className="ml-2 text-slate-500">{g.count} bays</span>
                    </div>
                  ))}
                  {gantrySummary.length === 0 && (
                    <p className="text-sm text-slate-500">No gantry data found for your current scope.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
