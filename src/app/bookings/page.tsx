"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { statusColor, formatDate } from "@/lib/utils"
import { Plus, Search, X, Package, Clock, Truck, CheckCircle, XCircle, CalendarCheck } from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"

const ALL_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "CLIENT_APPROVED", label: "Client Approved" },
  { value: "OPS_SCHEDULED", label: "Ops Scheduled" },
  { value: "TRUCK_DETAILS_PENDING", label: "Truck Details Pending" },
  { value: "QR_ISSUED", label: "QR Issued" },
  { value: "ARRIVED_GATE", label: "Arrived Gate" },
  { value: "IN_TERMINAL", label: "In Terminal" },
  { value: "LOADED", label: "Loaded" },
  { value: "EXITED", label: "Exited" },
  { value: "CLOSED", label: "Closed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "STOP_WORK", label: "Stop Work" },
]

export default function BookingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [clientId, setClientId] = useState("")
  const [page, setPage] = useState(1)

  const role = session?.user?.role
  const isAdmin = role === "TERMINAL_ADMIN" || role === "SUPER_ADMIN"

  const params = new URLSearchParams()
  if (status && status !== "ALL") params.set("status", status)
  if (dateFrom) params.set("dateFrom", dateFrom)
  if (dateTo) params.set("dateTo", dateTo)
  if (search) params.set("search", search)
  if (clientId && clientId !== "ALL") params.set("clientId", clientId)
  params.set("page", page.toString())
  params.set("limit", "15")

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", status, dateFrom, dateTo, search, clientId, page],
    queryFn: async () => {
      const res = await fetch(`/api/bookings?${params}`)
      if (!res.ok) throw new Error("Failed to fetch bookings")
      return res.json()
    },
  })

  const { data: stats } = useQuery({
    queryKey: ["bookings-stats"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/stats")
      if (!res.ok) throw new Error("Failed to fetch stats")
      return res.json()
    },
  })

  const { data: clients } = useQuery({
    queryKey: ["lookup-clients"],
    queryFn: async () => {
      const res = await fetch("/api/lookup/clients")
      const data = await res.json()
      return data.clients
    },
    enabled: isAdmin,
  })

  const canCreate = role === "CLIENT" || role === "TERMINAL_ADMIN" || role === "SUPER_ADMIN"
  const hasFilters = status || dateFrom || dateTo || search || clientId

  const clearFilters = () => {
    setStatus("")
    setDateFrom("")
    setDateTo("")
    setSearch("")
    setClientId("")
    setPage(1)
  }

  const statCards = [
    { label: "Total", value: stats?.total ?? 0, icon: Package, color: "text-foreground" },
    { label: "Pending", value: (stats?.byStatus?.SUBMITTED ?? 0) + (stats?.byStatus?.CLIENT_APPROVED ?? 0), icon: Clock, color: "text-sky-700" },
    { label: "Scheduled", value: stats?.byStatus?.OPS_SCHEDULED ?? 0, icon: CalendarCheck, color: "text-violet-700" },
    { label: "In Progress", value: (stats?.byStatus?.IN_TERMINAL ?? 0) + (stats?.byStatus?.LOADED ?? 0) + (stats?.byStatus?.ARRIVED_GATE ?? 0), icon: Truck, color: "text-amber-700" },
    { label: "Completed", value: (stats?.byStatus?.EXITED ?? 0) + (stats?.byStatus?.CLOSED ?? 0), icon: CheckCircle, color: "text-emerald-700" },
    { label: "Cancelled", value: (stats?.byStatus?.CANCELLED ?? 0) + (stats?.byStatus?.REJECTED ?? 0), icon: XCircle, color: "text-red-700" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold inline-flex items-center gap-1.5">
          Bookings
          <HelpTooltip description="What it is: Full booking list. Why it matters: Track progress from request to completion." />
        </h1>
        {canCreate && (
          <Link href="/bookings/new">
            <Button title="Create a new dispatch booking request."><Plus className="h-4 w-4 mr-2" /> New Booking</Button>
          </Link>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-sm text-slate-400">{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search booking number..."
                title="Search by booking number to quickly find one record."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger title="Filter bookings by lifecycle stage.">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setPage(1) }}>
                <SelectTrigger title="Filter to one client account.">
                  <SelectValue placeholder="Filter by client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Clients</SelectItem>
                  {clients?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} placeholder="From date" title="Start date for results." />
            <div className="flex gap-2">
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} placeholder="To date" className="flex-1" title="End date for results." />
              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear all active filters and reset the list.">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><span className="inline-flex items-center gap-1">Booking No <HelpTooltip description="What it is: Unique booking code. Why it matters: Fast way to find one booking." /></span></TableHead>
                      <TableHead><span className="inline-flex items-center gap-1">Client <HelpTooltip description="What it is: Customer account. Why it matters: Compare bookings by client." /></span></TableHead>
                      <TableHead><span className="inline-flex items-center gap-1">Product <HelpTooltip description="What it is: Product requested. Why it matters: Helps plan resource load by product." /></span></TableHead>
                      <TableHead><span className="inline-flex items-center gap-1">Qty <HelpTooltip description="What it is: Requested quantity. Why it matters: Higher quantity can affect slot time." /></span></TableHead>
                      <TableHead><span className="inline-flex items-center gap-1">Date <HelpTooltip description="What it is: Booking date. Why it matters: Helps track daily demand." /></span></TableHead>
                      <TableHead><span className="inline-flex items-center gap-1">Slot <HelpTooltip description="What it is: Planned time window. Why it matters: Missing slot means scheduling is pending." /></span></TableHead>
                      <TableHead><span className="inline-flex items-center gap-1">Transporter <HelpTooltip description="What it is: Assigned carrier. Why it matters: Shows who will move the load." /></span></TableHead>
                      <TableHead><span className="inline-flex items-center gap-1">Status <HelpTooltip description="What it is: Current booking stage. Why it matters: Tells what action is next." /></span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.bookings?.map((b: any) => (
                      <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/bookings/${b.id}`)}>
                        <TableCell className="font-medium">{b.bookingNo}</TableCell>
                        <TableCell>{b.client?.name}</TableCell>
                        <TableCell>{b.product?.name}</TableCell>
                        <TableCell>{b.quantityRequested}</TableCell>
                        <TableCell>{formatDate(b.date)}</TableCell>
                        <TableCell>{b.timeSlot ? `${b.timeSlot.startTime}-${b.timeSlot.endTime}` : "TBD"}</TableCell>
                        <TableCell>{b.transporter?.name || "-"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <Badge className={statusColor(b.status)}>
                              {b.status.replace(/_/g, " ")}
                            </Badge>
                            <HelpTooltip description="What it is: Booking progress label. Why it matters: Use non-final states to prioritize follow-up." />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Empty State */}
              {(!data?.bookings || data.bookings.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Package className="mb-4 h-12 w-12 text-slate-500" />
                  <p className="mb-1 text-lg font-medium text-slate-700">No bookings found</p>
                  <p className="mb-4 text-sm text-slate-400">
                    {hasFilters ? "Try adjusting your filters" : "Get started by creating your first booking"}
                  </p>
                  {hasFilters ? (
                    <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
                  ) : canCreate ? (
                    <Link href="/bookings/new">
                      <Button><Plus className="h-4 w-4 mr-2" /> New Booking</Button>
                    </Link>
                  ) : null}
                </div>
              )}

              {/* Pagination */}
              {data?.total > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200 p-4">
                  <p className="text-sm text-slate-400">
                    Showing {((page - 1) * 15) + 1}-{Math.min(page * 15, data.total)} of {data.total}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} title="Go to the previous page of bookings.">Previous</Button>
                    <Button variant="outline" size="sm" disabled={page * 15 >= data.total} onClick={() => setPage(page + 1)} title="Go to the next page of bookings.">Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
