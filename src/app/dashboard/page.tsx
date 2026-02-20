"use client"

import { createContext, useContext, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { statusColor } from "@/lib/utils"
import Link from "next/link"
import { ArrowRight, BarChart3, Calendar, Clock, FileText, Hourglass, LogIn, LogOut, PackageCheck, RefreshCw, Scale, Shield, ShieldCheck, Truck, XCircle } from "lucide-react"
import { BayHeatmap } from "@/components/dashboard/BayHeatmap"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { DataTableShell } from "@/components/dashboard/data-table-shell"
import { HelpTooltip } from "@/components/ui/help-tooltip"
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
    { label: "Slot Adherence", value: "87.3%", delta: "+2.1%", up: true },
    { label: "Avg Turnaround", value: `${(18 / Math.max(f, 1) + 4).toFixed(1)}h`, delta: "-8%", up: false },
    { label: "Trucks Loaded", value: Math.round(198 * f).toLocaleString(), delta: "+11%", up: true },
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
          {[Truck, Clock, RefreshCw, PackageCheck].map((Icon, i) => (
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

const movementStages = [
  { stage: "Outside Queue",  count: 8,  Icon: Clock,        bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   desc: "Waiting at gate"       },
  { stage: "Weighbridge",    count: 2,  Icon: Scale,        bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    desc: "Weigh-in (2 bridges)"  },
  { stage: "Safety Check",   count: 3,  Icon: ShieldCheck,  bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700",  desc: "HSE inspection"        },
  { stage: "Waiting Bay",    count: 4,  Icon: Hourglass,    bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   desc: "In yard, no bay yet"   },
  { stage: "At Bay",         count: 12, Icon: PackageCheck, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", desc: "Loading in progress"   },
  { stage: "Doc Clearance",  count: 3,  Icon: FileText,     bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    desc: "Weigh-out & docs"      },
  { stage: "Exiting",        count: 2,  Icon: LogOut,       bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-600",   desc: "Seal & exit gate"      },
]

function TruckMovementsCard() {
  const total = movementStages.reduce((s, st) => s + st.count, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Live Truck Movements</CardTitle>
          </div>
          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {total} trucks in terminal
          </span>
        </div>
        <CardDescription>Current position of every truck across all terminal stages</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Pipeline — horizontal scroll on small screens */}
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {movementStages.map(({ stage, count, Icon, bg, border, text, desc }, i) => (
            <div key={stage} className="flex items-center gap-1 shrink-0">
              <div className={`rounded-xl border ${bg} ${border} px-3 py-3 flex flex-col items-center gap-1.5 min-w-[88px]`}>
                <Icon className={`h-4 w-4 ${text}`} />
                <span className={`text-2xl font-bold ${text}`}>{count}</span>
                <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">{stage}</span>
                <span className="text-[10px] text-slate-400 text-center leading-tight">{desc}</span>
              </div>
              {i < movementStages.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Warning if outside queue or bay wait is elevated */}
        {(movementStages[0].count >= 8 || movementStages[3].count >= 4) && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-medium">
            Outside queue ({movementStages[0].count}) or yard wait ({movementStages[3].count}) is elevated — consider opening an additional gate lane or expediting bay turnover.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const hourlyGate = [
  { h: "07:00", in: 3, out: 1 },
  { h: "08:00", in: 7, out: 3 },
  { h: "09:00", in: 9, out: 6 },
  { h: "10:00", in: 6, out: 8 },
  { h: "11:00", in: 4, out: 7 },
  { h: "12:00", in: 2, out: 5 },
  { h: "13:00", in: 2, out: 3 },
  { h: "14:00", in: 1, out: 2 },
]

function GateActivityCard() {
  const stats = [
    { l: "Checked In", v: 34, c: "#34C759", Icon: LogIn },
    { l: "Checked Out", v: 28, c: "#4F8EF7", Icon: LogOut },
    { l: "In Yard", v: 6, c: "#F5A623", Icon: Truck },
    { l: "Rejected", v: 3, c: "#E5484D", Icon: XCircle },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg">Gate Activity</CardTitle>
        </div>
        <CardDescription>Today&apos;s gate throughput</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          {stats.map(({ l, v, c, Icon }) => (
            <div key={l} className="flex-1 rounded-lg bg-muted/50 py-2.5 px-3 text-center">
              <Icon className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: c }} />
              <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
              <div className="text-[10.5px] font-semibold text-muted-foreground mt-0.5">{l}</div>
            </div>
          ))}
        </div>
        <div className="h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyGate} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="h" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }}
                itemStyle={{ padding: 0 }}
                cursor={{ fill: "rgba(79,142,247,.06)" }}
              />
              <Bar dataKey="in" name="Check-in" fill="#34C759" radius={[3, 3, 0, 0]} />
              <Bar dataKey="out" name="Check-out" fill="#4F8EF7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-[#34C759]" />Check-in</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-[#4F8EF7]" />Check-out</span>
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
  const showMovements = ["SUPER_ADMIN", "TERMINAL_ADMIN", "TRAFFIC_CONTROLLER", "SECURITY"].includes(role)
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

        <DashboardHeader
          title={`Welcome, ${session.user.name}`}
          subtitle={`${role.replace(/_/g, " ")} Dashboard`}
          controls={(
            <FilterBar
              sticky={false}
              className="border-none bg-transparent p-0 shadow-none"
              right={(
                <Tabs value={per} onValueChange={(v) => setPer(v as PeriodKey)}>
                  <TabsList>
                    <TabsTrigger value="ytd" className="text-xs">YTD</TabsTrigger>
                    <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
                    <TabsTrigger value="quarter" className="text-xs">Quarter</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showTop5 && <Top5Card />}
          {showTripKpi && <TripKPICard />}
          {showFleet && <GateActivityCard />}
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

        {showMovements && <TruckMovementsCard />}

        {showBayHeatmap && <BayHeatmap />}

        <DataTableShell
          title="Recent Bookings"
          description="Latest booking activity"
          rowCount={recentBookings.length}
          emptyTitle="No bookings"
          emptyDescription="No recent booking activity available."
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left"><span className="inline-flex items-center gap-1">Booking ID <HelpTooltip description="What it is: Unique booking reference. Why it matters: Helps find one order quickly." /></span></th>
                <th className="text-left hidden sm:table-cell"><span className="inline-flex items-center gap-1">Customer <HelpTooltip description="What it is: Customer name. Why it matters: Compare activity by customer." /></span></th>
                <th className="text-left hidden md:table-cell"><span className="inline-flex items-center gap-1">Transporter <HelpTooltip description="What it is: Carrier handling the trip. Why it matters: Tracks carrier performance." /></span></th>
                <th className="text-left hidden lg:table-cell"><span className="inline-flex items-center gap-1">Truck # <HelpTooltip description="What it is: Vehicle identifier. Why it matters: Trace a truck across operations." /></span></th>
                <th className="text-left"><span className="inline-flex items-center gap-1">Status <HelpTooltip description="What it is: Booking stage. Why it matters: Shows what needs attention." /></span></th>
                <th className="text-left hidden sm:table-cell"><span className="inline-flex items-center gap-1">Date <HelpTooltip description="What it is: Booking date. Why it matters: Useful for daily trend checks." /></span></th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td>
                    <div className="font-medium text-slate-900">{b.bookingNo}</div>
                    <div className="text-xs text-slate-500 sm:hidden">{b.client}</div>
                  </td>
                  <td className="hidden sm:table-cell">{b.client}</td>
                  <td className="hidden md:table-cell">{b.transporter}</td>
                  <td className="hidden lg:table-cell">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{b.truck}</code>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <Badge className={statusColor(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                      <HelpTooltip description="What it is: Current booking stage. Why it matters: Use it to decide next action." />
                    </span>
                  </td>
                  <td className="hidden sm:table-cell text-slate-500">{b.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end border-t border-slate-100 px-4 py-2">
            <Link href="/bookings">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </DataTableShell>

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
