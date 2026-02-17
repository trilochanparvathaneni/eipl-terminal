"use client"

import { createContext, useContext, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { statusColor } from "@/lib/utils"
import Link from "next/link"
import { Activity, ArrowRight, BarChart3, Calendar, CirclePause, Clock, MapPin, RefreshCw, Truck, Wrench } from "lucide-react"
import { BayHeatmap } from "@/components/dashboard/BayHeatmap"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type PeriodKey = "week" | "month" | "quarter" | "year" | "ytd"
type Role =
  | "SUPER_ADMIN"
  | "TERMINAL_ADMIN"
  | "CLIENT"
  | "TRANSPORTER"
  | "SECURITY"
  | "SURVEYOR"
  | "HSE_OFFICER"
  | "AUDITOR"
  | "TRAFFIC_CONTROLLER"

const periods: Record<PeriodKey, { labels: string[]; f: number; text: string }> = {
  week: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], f: 0.25, text: "This week" },
  month: { labels: ["W1", "W2", "W3", "W4"], f: 1, text: "This month" },
  quarter: { labels: ["Jan", "Feb", "Mar"], f: 3, text: "This quarter" },
  year: { labels: ["Q1", "Q2", "Q3", "Q4"], f: 12, text: "This year" },
  ytd: { labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"], f: 10, text: "Year to date" },
}

const PeriodContext = createContext<{ per: PeriodKey }>({ per: "month" })

function spark(base: number, variation: number, per: PeriodKey) {
  return periods[per].labels.map((l) => ({
    label: l,
    val: Math.round(base * periods[per].f + (Math.random() - 0.4) * variation * periods[per].f),
  }))
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\\.0$/, "")}K` : String(n)
}

function MiniTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  suffix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md bg-gray-900 px-2 py-1 shadow-lg">
      <p className="text-[11px] font-semibold text-white">
        {label}: {payload[0].value.toLocaleString()}
        {suffix}
      </p>
    </div>
  )
}

const colors5 = ["#4F8EF7", "#34C759", "#AF6EE8", "#F5A623", "#2DC8D9"]
const clientRaw = [
  { r: 1, n: "Bharat Petroleum Corp", t: 72, v: 1840 },
  { r: 2, n: "Indian Oil Corporation", t: 58, v: 1520 },
  { r: 3, n: "Hindustan Petroleum", t: 46, v: 1180 },
  { r: 4, n: "Reliance Industries", t: 39, v: 960 },
  { r: 5, n: "Mangalore Refinery", t: 31, v: 740 },
]
const prodRaw = [
  { r: 1, n: "High Speed Diesel (HSD)", t: 84, v: 2260 },
  { r: 2, n: "Motor Spirit (Petrol)", t: 61, v: 1640 },
  { r: 3, n: "Liquefied Petroleum Gas", t: 47, v: 1190 },
  { r: 4, n: "Aviation Turbine Fuel", t: 33, v: 870 },
  { r: 5, n: "Bitumen", t: 22, v: 540 },
]

const recentBookings = [
  { id: "1", bookingNo: "BK25-01078", client: "Trident Chemphar", transporter: "SafeHaul Logistics", truck: "AP29TB4821", status: "CLOSED", date: "2025-01-31" },
  { id: "2", bookingNo: "BK25-01076", client: "Reliance Industries", transporter: "SpeedTankers Pvt Ltd", truck: "TS14HK3019", status: "IN_TERMINAL", date: "2025-01-31" },
  { id: "3", bookingNo: "BK25-01074", client: "Kanoria Chemicals", transporter: "Vizag Carriers", truck: "MH12AX7234", status: "QR_ISSUED", date: "2025-01-31" },
  { id: "4", bookingNo: "BK25-01071", client: "Akin Chemicals", transporter: "SafeHaul Logistics", truck: "AP21MN5512", status: "REJECTED", date: "2025-01-30" },
]

function Top5Card() {
  const { per } = useContext(PeriodContext)
  const [tab, setTab] = useState<"client" | "product">("client")
  const src = tab === "client" ? clientRaw : prodRaw
  const data = src.map((e, i) => ({
    ...e,
    c: colors5[i],
    trips: Math.round(e.t * periods[per].f),
    volume: Math.round(e.v * periods[per].f),
    sparkline: spark(e.v, e.v * 0.25, per),
  }))
  const mx = data[0].trips || 1

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-lg">Top 5 {tab === "client" ? "Clients" : "Products"}</CardTitle>
          <CardDescription>Trips & Volume · {periods[per].text}</CardDescription>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "client" | "product")}>
          <TabsList className="h-8">
            <TabsTrigger value="client" className="text-xs px-3 py-1">Client</TabsTrigger>
            <TabsTrigger value="product" className="text-xs px-3 py-1">Product</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {data.map((d) => (
          <div key={`${tab}-${per}-${d.r}`}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-800 truncate mr-2">{d.r}. {d.n}</span>
              <span className="text-sm font-bold text-gray-600 whitespace-nowrap">{d.trips} trips</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.trips / mx) * 100}%`, background: d.c }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">{d.volume.toLocaleString()} KL</span>
              <div className="w-[90px] h-[26px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.sparkline}>
                    <Tooltip content={<MiniTooltip suffix=" KL" />} cursor={false} />
                    <Line type="monotone" dataKey="val" stroke={d.c} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TripKPICard() {
  const { per } = useContext(PeriodContext)
  const f = periods[per].f
  const kpis = [
    { label: "Total Trips", value: Math.round(223 * f).toLocaleString(), delta: "+12%", up: true },
    { label: "On-Time Delivery", value: "94.2%", delta: "+2.1%", up: true },
    { label: "Avg Turnaround", value: `${(18 / Math.max(f, 1) + 4).toFixed(1)}h`, delta: "-8%", up: false },
    { label: "Total Distance", value: `${fmt(Math.round(34200 * f))} km`, delta: "+9%", up: true },
  ]
  const trend = periods[per].labels.map((l) => ({
    label: l,
    trips: Math.round((223 * f) / periods[per].labels.length + (Math.random() - 0.4) * 30),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Trip Summary</CardTitle>
        <CardDescription>Key metrics · {periods[per].text}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[Truck, Clock, RefreshCw, MapPin].map((Icon, i) => (
            <div key={kpis[i].label} className="rounded-xl bg-muted/50 p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11.5px] font-semibold text-muted-foreground">{kpis[i].label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold text-foreground">{kpis[i].value}</div>
              <span className={`text-[11px] font-semibold ${kpis[i].up ? "text-green-600" : "text-amber-500"}`}>{kpis[i].delta} vs prev</span>
            </div>
          ))}
        </div>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<MiniTooltip suffix=" trips" />} cursor={{ fill: "rgba(79,142,247,.06)" }} />
              <Bar dataKey="trips" fill="#4F8EF7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

const fleetStatusColor: Record<string, string> = { active: "#34C759", maintenance: "#F5A623", idle: "#E5484D" }
const fleetStatusIcon: Record<string, typeof Truck> = { active: Activity, maintenance: Wrench, idle: CirclePause }

function FleetCard() {
  const { per } = useContext(PeriodContext)
  const f = periods[per].f
  const vehicles = [
    { name: "Tanker 01", status: "active", trips: Math.round(18 * f), km: Math.round(4200 * f), util: 87 },
    { name: "Tanker 02", status: "active", trips: Math.round(15 * f), km: Math.round(3600 * f), util: 78 },
    { name: "Tanker 03", status: "maintenance", trips: Math.round(12 * f), km: Math.round(2900 * f), util: 62 },
    { name: "Tanker 04", status: "active", trips: Math.round(10 * f), km: Math.round(2400 * f), util: 71 },
    { name: "Tanker 05", status: "idle", trips: Math.round(6 * f), km: Math.round(1100 * f), util: 34 },
  ]
  const fleetUtil = Math.round(vehicles.reduce((a, v) => a + v.util, 0) / vehicles.length)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg">Fleet Overview</CardTitle>
        </div>
        <CardDescription>{vehicles.length} vehicles · {periods[per].text}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          {[{ l: "Active", v: vehicles.filter((v) => v.status === "active").length, c: "#34C759" }, { l: "Maint.", v: vehicles.filter((v) => v.status === "maintenance").length, c: "#F5A623" }, { l: "Idle", v: vehicles.filter((v) => v.status === "idle").length, c: "#E5484D" }, { l: "Avg Util", v: `${fleetUtil}%`, c: "#4F8EF7" }].map((s) => (
            <div key={s.l} className="flex-1 rounded-lg bg-muted/50 py-2.5 px-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[10.5px] font-semibold text-muted-foreground mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-0">
          {vehicles.map((v) => {
            const Icon = fleetStatusIcon[v.status] ?? Truck
            return (
              <div key={v.name} className="flex items-center gap-3 py-2 border-b last:border-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[13px] font-semibold text-gray-800 w-20 shrink-0">{v.name}</span>
                <span className="text-xs text-gray-500 flex-1 truncate">{v.trips} trips · {v.km.toLocaleString()} km</span>
                <div className="w-14 flex items-center gap-1.5 shrink-0">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${v.util}%`, background: v.util > 70 ? "#34C759" : v.util > 40 ? "#F5A623" : "#E5484D" }} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">{v.util}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [per, setPer] = useState<PeriodKey>("month")
  if (!session) return null

  const role = session.user.role as Role
  const showTop5 = ["SUPER_ADMIN", "TERMINAL_ADMIN", "AUDITOR", "TRAFFIC_CONTROLLER"].includes(role)
  const showTripKpi = ["SUPER_ADMIN", "TERMINAL_ADMIN", "AUDITOR", "SECURITY", "TRANSPORTER", "CLIENT", "TRAFFIC_CONTROLLER"].includes(role)
  const showFleet = ["SUPER_ADMIN", "TERMINAL_ADMIN", "SECURITY", "TRANSPORTER", "TRAFFIC_CONTROLLER"].includes(role)
  const showBayHeatmap = ["SUPER_ADMIN", "TERMINAL_ADMIN", "AUDITOR", "TRAFFIC_CONTROLLER"].includes(role)
  const topCardCount = [showTop5, showTripKpi, showFleet].filter(Boolean).length
  const showFleetCompanion = showFleet && topCardCount === 1
  const showTopGlance = role === "SUPER_ADMIN"
  const attentionCount = recentBookings.filter((b) => ["REJECTED", "IN_TERMINAL"].includes(b.status)).length
  const nextActions: Record<Role, Array<{ label: string; href: string }>> = {
    SUPER_ADMIN: [{ label: "Review Reports", href: "/reports" }, { label: "Open Schedule", href: "/schedule" }, { label: "Audit Logs", href: "/audit-logs" }],
    TERMINAL_ADMIN: [{ label: "Open Schedule", href: "/schedule" }, { label: "Review Reports", href: "/reports" }, { label: "Doc Review", href: "/admin/documents-review" }],
    CLIENT: [{ label: "New Booking", href: "/bookings/new" }, { label: "My Documents", href: "/client/documents" }, { label: "All Bookings", href: "/bookings" }],
    TRANSPORTER: [{ label: "My Trips", href: "/transporter/trips" }, { label: "All Bookings", href: "/bookings" }, { label: "Notifications", href: "/notifications" }],
    SECURITY: [{ label: "Gate Operations", href: "/security/gate" }, { label: "All Bookings", href: "/bookings" }, { label: "Notifications", href: "/notifications" }],
    SURVEYOR: [{ label: "Doc Review", href: "/admin/documents-review" }, { label: "Review Reports", href: "/reports" }, { label: "All Bookings", href: "/bookings" }],
    HSE_OFFICER: [{ label: "HSE Console", href: "/hse" }, { label: "Review Reports", href: "/reports" }, { label: "Notifications", href: "/notifications" }],
    AUDITOR: [{ label: "Audit Logs", href: "/audit-logs" }, { label: "Review Reports", href: "/reports" }, { label: "Notifications", href: "/notifications" }],
    TRAFFIC_CONTROLLER: [{ label: "Controller Console", href: "/controller/console" }, { label: "Yard Console", href: "/controller/yard-console" }, { label: "Review Reports", href: "/reports" }],
  }

  const renderTodayAtGlanceCard = () => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">Today at a Glance</CardTitle>
        <CardDescription>Operational pulse and next best actions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground">Recent Bookings</p>
            <p className="text-xl font-bold">{recentBookings.length}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5">
            <p className="text-[11px] font-semibold text-amber-700">Needs Attention</p>
            <p className="text-xl font-bold text-amber-800">{attentionCount}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5">
            <p className="text-[11px] font-semibold text-emerald-700">Closed Today</p>
            <p className="text-xl font-bold text-emerald-800">{recentBookings.filter((b) => b.status === "CLOSED").length}</p>
          </div>
        </div>
        <div className="space-y-2">
          {nextActions[role].map((action) => (
            <Link key={action.href} href={action.href}>
              <Button variant="outline" className="w-full justify-between group">
                {action.label}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <PeriodContext.Provider value={{ per }}>
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <span className="text-amber-500 text-base">&#x1f536;</span>
          <span className="font-medium">DEMO ENVIRONMENT</span>
          <span className="hidden sm:inline">— Sample data shown for demonstration purposes</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {session.user.name}</h1>
            <p className="text-muted-foreground">{role.replace(/_/g, " ")} Dashboard</p>
          </div>
          <Tabs value={per} onValueChange={(v) => setPer(v as PeriodKey)}>
            <TabsList>
              <TabsTrigger value="ytd" className="text-xs">YTD</TabsTrigger>
              <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
              <TabsTrigger value="quarter" className="text-xs">Quarter</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showTop5 && <Top5Card />}
          {showTripKpi && <TripKPICard />}
          {showFleet && <FleetCard />}
          {showTopGlance && renderTodayAtGlanceCard()}
          {showFleetCompanion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fleet Action Queue</CardTitle>
                <CardDescription>Suggested operational actions for today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/bookings">
                  <Button variant="outline" className="w-full justify-between group">
                    Review In-Terminal Trips
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/notifications">
                  <Button variant="outline" className="w-full justify-between group">
                    Check Alerts and Notifications
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/reports">
                  <Button variant="outline" className="w-full justify-between group">
                    Open Fleet Performance Reports
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {showBayHeatmap && <BayHeatmap />}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Bookings</CardTitle>
              <CardDescription>Latest booking activity</CardDescription>
            </div>
            <Link href="/bookings">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-left font-medium text-gray-500 px-4 py-2.5">Booking ID</th>
                    <th className="text-left font-medium text-gray-500 px-4 py-2.5 hidden sm:table-cell">Customer</th>
                    <th className="text-left font-medium text-gray-500 px-4 py-2.5 hidden md:table-cell">Transporter</th>
                    <th className="text-left font-medium text-gray-500 px-4 py-2.5 hidden lg:table-cell">Truck #</th>
                    <th className="text-left font-medium text-gray-500 px-4 py-2.5">Status</th>
                    <th className="text-left font-medium text-gray-500 px-4 py-2.5 hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{b.bookingNo}</div>
                        <div className="text-xs text-gray-500 sm:hidden">{b.client}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{b.client}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{b.transporter}</td>
                      <td className="px-4 py-3 hidden lg:table-cell"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{b.truck}</code></td>
                      <td className="px-4 py-3"><Badge className={statusColor(b.status)}>{b.status.replace(/_/g, " ")}</Badge></td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{b.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!showTopGlance && renderTodayAtGlanceCard()}

          {(role === "CLIENT" || role === "TERMINAL_ADMIN" || role === "SUPER_ADMIN") && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Link href="/bookings/new"><Button className="w-full justify-between group">New Booking<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></Button></Link>
                <Link href="/bookings"><Button variant="outline" className="w-full justify-between mt-2 group">View All Bookings<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></Button></Link>
              </CardContent>
            </Card>
          )}
          {(role === "TERMINAL_ADMIN" || role === "SUPER_ADMIN") && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader><CardTitle className="text-lg">Operations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Link href="/schedule"><Button variant="outline" className="w-full justify-between group"><span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Schedule View</span><ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></Button></Link>
                <Link href="/reports"><Button variant="outline" className="w-full justify-between mt-2 group"><span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Reports</span><ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></Button></Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PeriodContext.Provider>
  )
}
