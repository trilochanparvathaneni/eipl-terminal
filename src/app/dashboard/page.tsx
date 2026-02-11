"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { statusColor } from "@/lib/utils"
import Link from "next/link"
import {
  ClipboardList,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
} from "lucide-react"
import { BayHeatmap } from "@/components/dashboard/BayHeatmap"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"

// ─── Demo data constant — swap with real API calls later ────────────────────
const DEMO_DATA = {
  stats: {
    totalBookings: 247,
    todayTrips: 18,
    inTerminal: 7,
    openIncidents: 3,
  },
  trends: {
    totalBookings: { value: 12, up: true },
    todayTrips: { value: 8, up: true },
    inTerminal: { value: 2, up: false },
    openIncidents: { value: 1, up: false },
  },
  bookingsTrend: [
    { day: "Mon", bookings: 32 },
    { day: "Tue", bookings: 38 },
    { day: "Wed", bookings: 41 },
    { day: "Thu", bookings: 35 },
    { day: "Fri", bookings: 44 },
    { day: "Sat", bookings: 39 },
    { day: "Sun", bookings: 18 },
  ],
  tripStatus: [
    { name: "Completed", value: 142, color: "#22c55e" },
    { name: "In Progress", value: 38, color: "#3b82f6" },
    { name: "Scheduled", value: 52, color: "#eab308" },
    { name: "Cancelled", value: 15, color: "#ef4444" },
  ],
  occupancy: [
    { hour: "06", in: 2, out: 0 },
    { hour: "07", in: 3, out: 1 },
    { hour: "08", in: 5, out: 2 },
    { hour: "09", in: 8, out: 3 },
    { hour: "10", in: 7, out: 5 },
    { hour: "11", in: 6, out: 6 },
    { hour: "12", in: 9, out: 4 },
    { hour: "13", in: 8, out: 7 },
    { hour: "14", in: 10, out: 6 },
    { hour: "15", in: 7, out: 8 },
    { hour: "16", in: 5, out: 9 },
    { hour: "17", in: 3, out: 7 },
  ],
  topTransporters: [
    { name: "SafeHaul Logistics", trips: 64 },
    { name: "SpeedTankers Pvt Ltd", trips: 51 },
    { name: "Vizag Carriers", trips: 43 },
    { name: "AP Transport Co", trips: 37 },
    { name: "Coastal Haulers", trips: 28 },
  ],
  recentBookings: [
    { id: "1", bookingNo: "BK25-01078", client: "Trident Chemphar", transporter: "SafeHaul Logistics", truck: "AP29TB4821", status: "CLOSED", product: "Methanol", qty: 24, unit: "KL", date: "2025-01-31" },
    { id: "2", bookingNo: "BK25-01076", client: "Reliance Industries", transporter: "SpeedTankers Pvt Ltd", truck: "TS14HK3019", status: "IN_TERMINAL", product: "LPG", qty: 16, unit: "MT", date: "2025-01-31" },
    { id: "3", bookingNo: "BK25-01074", client: "Kanoria Chemicals", transporter: "Vizag Carriers", truck: "MH12AX7234", status: "QR_ISSUED", product: "HSD", qty: 30, unit: "KL", date: "2025-01-31" },
    { id: "4", bookingNo: "BK25-01071", client: "Akin Chemicals", transporter: "SafeHaul Logistics", truck: "AP21MN5512", status: "REJECTED", product: "Methanol", qty: 18, unit: "KL", date: "2025-01-30" },
    { id: "5", bookingNo: "BK25-01069", client: "Dr Reddys", transporter: "Vizag Carriers", truck: "KA05JP8891", status: "CLOSED", product: "HSD", qty: 35, unit: "KL", date: "2025-01-30" },
    { id: "6", bookingNo: "BK25-01065", client: "Trident Chemphar", transporter: "SpeedTankers Pvt Ltd", truck: "TS09RK2210", status: "CLOSED", product: "Methanol", qty: 22, unit: "KL", date: "2025-01-30" },
    { id: "7", bookingNo: "BK25-01062", client: "Jupiter Dyechem", transporter: "SafeHaul Logistics", truck: "GJ06WN4478", status: "CANCELLED", product: "LPG", qty: 12, unit: "MT", date: "2025-01-29" },
    { id: "8", bookingNo: "BK25-01058", client: "Aryann Chemicals", transporter: "Vizag Carriers", truck: "RJ14CD6690", status: "CLOSED", product: "Methanol", qty: 28, unit: "KL", date: "2025-01-29" },
  ],
}

// ─── Stat card config ───────────────────────────────────────────────────────
const STAT_CARDS = [
  {
    key: "totalBookings" as const,
    title: "Total Bookings",
    subtitle: "Active bookings",
    icon: ClipboardList,
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-600",
    badgeBg: "bg-blue-100",
    href: "/bookings",
  },
  {
    key: "todayTrips" as const,
    title: "Today's Trips",
    subtitle: "Scheduled today",
    icon: Truck,
    bg: "bg-green-50",
    border: "border-green-200",
    iconColor: "text-green-600",
    badgeBg: "bg-green-100",
    href: "/schedule",
  },
  {
    key: "inTerminal" as const,
    title: "In Terminal",
    subtitle: "Trucks currently inside",
    icon: ShieldCheck,
    bg: "bg-purple-50",
    border: "border-purple-200",
    iconColor: "text-purple-600",
    badgeBg: "bg-purple-100",
    href: "/schedule?filter=in-terminal",
  },
  {
    key: "openIncidents" as const,
    title: "Open Incidents",
    subtitle: "Requiring attention",
    icon: AlertTriangle,
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-600",
    badgeBg: "bg-red-100",
    href: "/hse",
  },
]

export default function DashboardPage() {
  const { data: session } = useSession()

  // Real API calls — data supplements the demo overlay
  const { data: apiStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats")
      if (!res.ok) throw new Error("Failed to fetch stats")
      return res.json()
    },
  })

  const { data: apiBookings } = useQuery({
    queryKey: ["recent-bookings"],
    queryFn: async () => {
      const res = await fetch("/api/bookings?limit=5")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  if (!session) return null

  const role = session.user.role

  // Use demo data for display (swap to apiStats/apiBookings when ready)
  const stats = DEMO_DATA.stats
  const trends = DEMO_DATA.trends

  return (
    <div className="space-y-6">
      {/* Demo Banner */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
        <span className="text-amber-500 text-base">&#x1f536;</span>
        <span className="font-medium">DEMO ENVIRONMENT</span>
        <span className="hidden sm:inline">&mdash; Sample data shown for demonstration purposes</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Welcome, {session.user.name}</h1>
        <p className="text-muted-foreground">
          {role.replace(/_/g, " ")} Dashboard
        </p>
      </div>

      {/* ── Color-coded Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const trend = trends[card.key]
          return (
            <Link key={card.key} href={card.href}>
              <Card
                className={`${card.bg} ${card.border} border shadow-sm cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {card.title}
                  </CardTitle>
                  <div className={`${card.badgeBg} p-2 rounded-lg`}>
                    <Icon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats[card.key]}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">{card.subtitle}</p>
                    <span
                      className={`text-xs font-medium flex items-center gap-0.5 ${
                        trend.up ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {trend.up ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {trend.up ? "+" : "-"}{trend.value}% vs last week
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* ── Charts Row 1: Bookings Trend + Trip Status ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bookings Trend - Area Chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Bookings Trend</CardTitle>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={DEMO_DATA.bookingsTrend}>
                <defs>
                  <linearGradient id="bookingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bookings"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#bookingsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trip Status - Donut Chart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Trip Status</CardTitle>
            <p className="text-xs text-muted-foreground">Current month breakdown</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={DEMO_DATA.tripStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {DEMO_DATA.tripStatus.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              {DEMO_DATA.tripStatus.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: s.color }}
                  />
                  <span className="text-gray-600">{s.name}</span>
                  <span className="ml-auto font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2: Terminal Occupancy + Top Transporters ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Terminal Occupancy - Bar Chart */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Terminal Occupancy</CardTitle>
              <p className="text-xs text-muted-foreground">Trucks in/out per hour (last 24h)</p>
            </div>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={DEMO_DATA.occupancy}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(h) => `${h}:00`}
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  labelFormatter={(h) => `${h}:00`}
                />
                <Bar dataKey="in" name="Check-In" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="out" name="Check-Out" fill="#c4b5fd" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Transporters - Horizontal Bar */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Top 5 Transporters</CardTitle>
            <p className="text-xs text-muted-foreground">Trips this month</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2">
              {DEMO_DATA.topTransporters.map((t, i) => {
                const maxTrips = DEMO_DATA.topTransporters[0].trips
                const pct = Math.round((t.trips / maxTrips) * 100)
                const colors = [
                  "bg-blue-500",
                  "bg-green-500",
                  "bg-purple-500",
                  "bg-amber-500",
                  "bg-cyan-500",
                ]
                return (
                  <div key={t.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium truncate mr-2">
                        {i + 1}. {t.name}
                      </span>
                      <span className="text-gray-500 font-medium shrink-0">
                        {t.trips} trips
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`${colors[i]} h-2.5 rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bay Utilization Heatmap ──────────────────────────────────────── */}
      <BayHeatmap />

      {/* ── Recent Bookings Table ────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Bookings</CardTitle>
            <p className="text-xs text-muted-foreground">Latest booking activity</p>
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
                {DEMO_DATA.recentBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{b.bookingNo}</div>
                      <div className="text-xs text-gray-500 sm:hidden">{b.client}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{b.client}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{b.transporter}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                        {b.truck}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColor(b.status)}>
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{b.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Actions + Operations ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(role === "CLIENT" || role === "TERMINAL_ADMIN" || role === "SUPER_ADMIN") && (
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/bookings/new">
                <Button className="w-full justify-between group">
                  New Booking
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/bookings">
                <Button variant="outline" className="w-full justify-between mt-2 group">
                  View All Bookings
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {(role === "TERMINAL_ADMIN" || role === "SUPER_ADMIN") && (
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/schedule">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Schedule View
                  </span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" className="w-full justify-between mt-2 group">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Reports
                  </span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
