"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { statusColor, formatDate, formatDateTime } from "@/lib/utils"
import { RotateCcw } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { KpiCard, KpiCardSkeleton } from "@/components/dashboard/kpi-card"
import { DataTableShell } from "@/components/dashboard/data-table-shell"
import { HelpTooltip } from "@/components/ui/help-tooltip"

function exportCSV(data: any[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function toParams(input: Record<string, string | number | undefined | null | boolean>) {
  const qp = new URLSearchParams()
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue
    if (typeof v === "string" && !v.trim()) continue
    qp.set(k, String(v))
  }
  return qp.toString()
}

const reportTabs = [
  { value: "bookings", label: "Bookings", tooltip: "What it is: Booking records. Why it matters: Shows order flow and bottlenecks. Next: Filter by date and status." },
  { value: "movements", label: "Truck Movements", tooltip: "What it is: Truck journey updates. Why it matters: Tracks delays and turnaround. Next: Check ETA and status." },
  { value: "bays", label: "Bay Utilization", tooltip: "What it is: Bay usage counts. Why it matters: Highlights capacity pressure. Next: Balance load across bays." },
  { value: "safety", label: "Safety & Compliance", tooltip: "What it is: Safety checks and incidents. Why it matters: Reduces risk. Next: Review failed checks first." },
]

function FilterLabel({ text, tooltip }: { text: string; tooltip: string }) {
  return (
    <Label className="inline-flex items-center gap-1 text-xs">
      <span>{text}</span>
      <HelpTooltip description={tooltip} label={`${text} help`} />
    </Label>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState("bookings")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [bookingStatus, setBookingStatus] = useState("ALL")
  const [bookingClientId, setBookingClientId] = useState("ALL")
  const [bookingProductId, setBookingProductId] = useState("ALL")
  const [bookingNo, setBookingNo] = useState("")

  const [tripStatus, setTripStatus] = useState("ALL")
  const [truckNumber, setTruckNumber] = useState("")
  const [moveTransporterId, setMoveTransporterId] = useState("ALL")

  const [bayGantryId, setBayGantryId] = useState("ALL")
  const [bayId, setBayId] = useState("ALL")
  const [bayProductId, setBayProductId] = useState("ALL")
  const [minAllocations, setMinAllocations] = useState("")

  const [checklistStatus, setChecklistStatus] = useState("ALL")
  const [incidentSeverity, setIncidentSeverity] = useState("ALL")
  const [incidentStatus, setIncidentStatus] = useState("ALL")
  const [stopWorkActiveOnly, setStopWorkActiveOnly] = useState("ALL")

  const common = { dateFrom, dateTo }

  const { data: clientsData } = useQuery({
    queryKey: ["report-filter-clients"],
    queryFn: async () => {
      const r = await fetch("/api/lookup/clients")
      return r.ok ? r.json() : { clients: [] }
    },
  })
  const { data: productsData } = useQuery({
    queryKey: ["report-filter-products"],
    queryFn: async () => {
      const r = await fetch("/api/lookup/products")
      return r.ok ? r.json() : { products: [] }
    },
  })
  const { data: transportersData } = useQuery({
    queryKey: ["report-filter-transporters"],
    queryFn: async () => {
      const r = await fetch("/api/lookup/transporters")
      return r.ok ? r.json() : { transporters: [] }
    },
  })
  const { data: baysData } = useQuery({
    queryKey: ["report-filter-bays", bayProductId],
    queryFn: async () => {
      const qp = toParams({ productId: bayProductId !== "ALL" ? bayProductId : undefined })
      const r = await fetch(`/api/lookup/bays?${qp}`)
      return r.ok ? r.json() : { bays: [] }
    },
  })

  const clients = clientsData?.clients || []
  const products = productsData?.products || []
  const transporters = transportersData?.transporters || []
  const bays = useMemo(() => baysData?.bays || [], [baysData])
  const gantries = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const b of bays) {
      if (b.gantry?.id && !map.has(b.gantry.id)) {
        map.set(b.gantry.id, { id: b.gantry.id, name: b.gantry.name })
      }
    }
    return Array.from(map.values())
  }, [bays])

  const bookingsQuery = toParams({
    ...common,
    status: bookingStatus !== "ALL" ? bookingStatus : undefined,
    clientId: bookingClientId !== "ALL" ? bookingClientId : undefined,
    productId: bookingProductId !== "ALL" ? bookingProductId : undefined,
    bookingNo: bookingNo || undefined,
  })
  const movementsQuery = toParams({
    ...common,
    tripStatus: tripStatus !== "ALL" ? tripStatus : undefined,
    truckNumber: truckNumber || undefined,
    transporterId: moveTransporterId !== "ALL" ? moveTransporterId : undefined,
  })
  const baysQuery = toParams({
    ...common,
    gantryId: bayGantryId !== "ALL" ? bayGantryId : undefined,
    bayId: bayId !== "ALL" ? bayId : undefined,
    productId: bayProductId !== "ALL" ? bayProductId : undefined,
    minAllocations: minAllocations || undefined,
  })
  const safetyQuery = toParams({
    ...common,
    checklistStatus: checklistStatus !== "ALL" ? checklistStatus : undefined,
    incidentSeverity: incidentSeverity !== "ALL" ? incidentSeverity : undefined,
    incidentStatus: incidentStatus !== "ALL" ? incidentStatus : undefined,
    stopWorkActiveOnly: stopWorkActiveOnly === "YES" ? "true" : undefined,
  })

  const { data: bookingsReport, isFetching: bookingsLoading } = useQuery({
    queryKey: ["report-bookings", bookingsQuery],
    queryFn: async () => {
      const r = await fetch(`/api/reports/bookings?${bookingsQuery}`)
      return r.json()
    },
  })
  const { data: movementsReport, isFetching: movementsLoading } = useQuery({
    queryKey: ["report-movements", movementsQuery],
    queryFn: async () => {
      const r = await fetch(`/api/reports/movements?${movementsQuery}`)
      const data = await r.json()
      return data.movements ?? []
    },
  })
  const { data: bayReport, isFetching: baysLoading } = useQuery({
    queryKey: ["report-bays", baysQuery],
    queryFn: async () => {
      const r = await fetch(`/api/reports/bay-utilization?${baysQuery}`)
      const data = await r.json()
      return data.utilization ?? []
    },
  })
  const { data: safetyReport, isFetching: safetyLoading } = useQuery({
    queryKey: ["report-safety", safetyQuery],
    queryFn: async () => {
      const r = await fetch(`/api/reports/safety?${safetyQuery}`)
      const data = await r.json()
      return {
        checklistsPassed: data.checklists?.PASSED ?? 0,
        checklistsFailed: data.checklists?.FAILED ?? 0,
        stopWorkOrders: data.stopWorkOrders?.total ?? 0,
        activeStopWorkOrders: data.stopWorkOrders?.active ?? 0,
        totalIncidents: Object.values(data.incidents ?? {}).reduce((sum: number, n: any) => sum + n, 0),
        incidentsBySeverity: data.incidents ?? {},
      }
    },
  })

  function resetCurrentTabFilters() {
    if (tab === "bookings") {
      setBookingStatus("ALL")
      setBookingClientId("ALL")
      setBookingProductId("ALL")
      setBookingNo("")
      return
    }
    if (tab === "movements") {
      setTripStatus("ALL")
      setTruckNumber("")
      setMoveTransporterId("ALL")
      return
    }
    if (tab === "bays") {
      setBayGantryId("ALL")
      setBayId("ALL")
      setBayProductId("ALL")
      setMinAllocations("")
      return
    }
    setChecklistStatus("ALL")
    setIncidentSeverity("ALL")
    setIncidentStatus("ALL")
    setStopWorkActiveOnly("ALL")
  }

  const activeFilterCount = [
    dateFrom,
    dateTo,
    bookingStatus !== "ALL",
    bookingClientId !== "ALL",
    bookingProductId !== "ALL",
    bookingNo,
    tripStatus !== "ALL",
    truckNumber,
    moveTransporterId !== "ALL",
    bayGantryId !== "ALL",
    bayId !== "ALL",
    bayProductId !== "ALL",
    minAllocations,
    checklistStatus !== "ALL",
    incidentSeverity !== "ALL",
    incidentStatus !== "ALL",
    stopWorkActiveOnly !== "ALL",
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      <DashboardHeader title="Reports" subtitle="Operational monitoring, analytics, and export views" />

      <DashboardTabs items={reportTabs} value={tab} onValueChange={setTab} />

      <FilterBar
        left={
          <>
            <div className="space-y-1">
              <FilterLabel text="From" tooltip="What it is: Start date. Why it matters: Includes records from this day onward." />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[170px]" />
            </div>
            <div className="space-y-1">
              <FilterLabel text="To" tooltip="What it is: End date. Why it matters: Limits records up to this day." />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[170px]" />
            </div>

            {tab === "bookings" && (
              <>
                <div className="space-y-1 min-w-[170px]">
                  <FilterLabel text="Status" tooltip="What it is: Current booking stage. Why it matters: Helps find stalled or completed bookings." />
                  <Select value={bookingStatus} onValueChange={setBookingStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {["DRAFT","SUBMITTED","CLIENT_APPROVED","OPS_SCHEDULED","TRUCK_DETAILS_PENDING","QR_ISSUED","ARRIVED_GATE","IN_TERMINAL","LOADED","EXITED","CLOSED","REJECTED","CANCELLED","STOP_WORK"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[190px]">
                  <FilterLabel text="Client" tooltip="What it is: Customer account. Why it matters: Focuses results to one customer." />
                  <Select value={bookingClientId} onValueChange={setBookingClientId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[190px]">
                  <FilterLabel text="Product" tooltip="What it is: Material being moved. Why it matters: Compares flow by product type." />
                  <Select value={bookingProductId} onValueChange={setBookingProductId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[180px]">
                  <FilterLabel text="Booking No" tooltip="What it is: Unique booking reference. Why it matters: Finds one specific order fast." />
                  <Input value={bookingNo} onChange={(e) => setBookingNo(e.target.value)} placeholder="BK..." className="h-9" />
                </div>
              </>
            )}

            {tab === "movements" && (
              <>
                <div className="space-y-1 min-w-[170px]">
                  <FilterLabel text="Trip Status" tooltip="What it is: Truck progress stage. Why it matters: Shows where delays happen." />
                  <Select value={tripStatus} onValueChange={setTripStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {["PENDING","QR_ISSUED","ARRIVED","IN_TERMINAL","LOADED","EXITED","COMPLETED"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[180px]">
                  <FilterLabel text="Truck Number" tooltip="What it is: Vehicle identifier. Why it matters: Track a single truck's journey." />
                  <Input value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} placeholder="AP29..." className="h-9" />
                </div>
                <div className="space-y-1 min-w-[210px]">
                  <FilterLabel text="Transporter" tooltip="What it is: Logistics provider. Why it matters: Compare carrier performance." />
                  <Select value={moveTransporterId} onValueChange={setMoveTransporterId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {transporters.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {tab === "bays" && (
              <>
                <div className="space-y-1 min-w-[180px]">
                  <FilterLabel text="Gantry" tooltip="What it is: Loading gantry group. Why it matters: Narrows data to one equipment area." />
                  <Select value={bayGantryId} onValueChange={setBayGantryId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {gantries.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[180px]">
                  <FilterLabel text="Bay" tooltip="What it is: Specific loading bay. Why it matters: Check utilization at bay level." />
                  <Select value={bayId} onValueChange={setBayId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {bays.filter((b: any) => bayGantryId === "ALL" || b.gantry?.id === bayGantryId)
                        .map((b: any) => <SelectItem key={b.id} value={b.id}>{b.uniqueCode}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[200px]">
                  <FilterLabel text="Product" tooltip="What it is: Product assigned to bay. Why it matters: Find product-specific bottlenecks." />
                  <Select value={bayProductId} onValueChange={setBayProductId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[120px]">
                  <FilterLabel text="Min Allocations" tooltip="What it is: Minimum usage threshold. Why it matters: Hides low-activity bays." />
                  <Input type="number" min={0} value={minAllocations} onChange={(e) => setMinAllocations(e.target.value)} placeholder="0" className="h-9" />
                </div>
              </>
            )}

            {tab === "safety" && (
              <>
                <div className="space-y-1 min-w-[180px]">
                  <FilterLabel text="Checklist" tooltip="What it is: Safety checklist result. Why it matters: Surfaces failures quickly." />
                  <Select value={checklistStatus} onValueChange={setChecklistStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {["PASSED", "FAILED", "PENDING"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[150px]">
                  <FilterLabel text="Severity" tooltip="What it is: Incident impact level. Why it matters: Prioritize high-risk cases first." />
                  <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {["LOW","MED","HIGH"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[150px]">
                  <FilterLabel text="Incident Status" tooltip="What it is: Open or closed incident. Why it matters: Tracks unresolved risk." />
                  <Select value={incidentStatus} onValueChange={setIncidentStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {["OPEN","CLOSED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[150px]">
                  <FilterLabel text="Stop Work" tooltip="What it is: Work-stoppage orders. Why it matters: Shows active operational blockers." />
                  <Select value={stopWorkActiveOnly} onValueChange={setStopWorkActiveOnly}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="YES">Active only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </>
        }
        right={
          <>
            <span className="inline-flex items-center gap-1">
              <Badge variant="secondary" className="border border-slate-200 bg-slate-50 text-slate-700">Active filters: {activeFilterCount}</Badge>
              <HelpTooltip description="What it is: Number of filters now applied. Why it matters: More filters narrow your results." label="Active filters help" />
            </span>
            <Button variant="outline" onClick={resetCurrentTabFilters} className="h-9 text-xs" title="Clear filters for the current tab only.">
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset Tab Filters
            </Button>
          </>
        }
      />

      {tab === "bookings" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {bookingsLoading && Array.from({ length: 4 }).map((_, idx) => <KpiCardSkeleton key={idx} />)}
            {!bookingsLoading && (
              <>
                <KpiCard title="Bookings" value={String(bookingsReport?.bookings?.length ?? 0)} tooltip="What it is: Total bookings in this view. Why it matters: Shows overall booking volume." />
                <KpiCard title="Closed" value={String(bookingsReport?.statusDistribution?.CLOSED ?? 0)} deltaTone="positive" tooltip="What it is: Completed bookings. Why it matters: Measures completed throughput." />
                <KpiCard title="In Terminal" value={String(bookingsReport?.statusDistribution?.IN_TERMINAL ?? 0)} tooltip="What it is: Trucks currently inside terminal. Why it matters: Indicates live operational load." />
                <KpiCard title="Rejected" value={String(bookingsReport?.statusDistribution?.REJECTED ?? 0)} deltaTone="negative" tooltip="What it is: Rejected bookings. Why it matters: Higher values may signal compliance or data issues." />
              </>
            )}
          </div>

          {bookingsReport?.statusDistribution && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(bookingsReport.statusDistribution).map(([status, count]: any) => (
                <Badge key={status} className={statusColor(status)}>{status}: {count}</Badge>
              ))}
            </div>
          )}

          <DataTableShell
            title="Bookings Report"
            description="Latest matching booking records"
            rowCount={bookingsReport?.bookings?.length ?? 0}
            loading={bookingsLoading}
            onExport={() => bookingsReport?.bookings && exportCSV(
              bookingsReport.bookings.map((b: any) => ({
                BookingNo: b.bookingNo, Client: b.client?.name, Product: b.product?.name,
                Quantity: b.quantityRequested, Date: formatDate(b.date), Status: b.status,
              })),
              "bookings-report"
            )}
            emptyTitle="No bookings"
            emptyDescription="No bookings matched the current report filters."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><span className="inline-flex items-center gap-1">Booking No <HelpTooltip description="What it is: Unique order reference. Why it matters: Use it to track one booking quickly." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Client <HelpTooltip description="What it is: Customer name. Why it matters: Helps compare activity by customer." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Product <HelpTooltip description="What it is: Material requested. Why it matters: Reveals demand by product." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Qty <HelpTooltip description="What it is: Requested quantity. Why it matters: Larger values affect capacity planning." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Date <HelpTooltip description="What it is: Booking date. Why it matters: Useful for trend and backlog checks." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Status <HelpTooltip description="What it is: Current booking stage. Why it matters: Shows where work is stuck or complete." /></span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookingsReport?.bookings?.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.bookingNo}</TableCell>
                    <TableCell>{b.client?.name}</TableCell>
                    <TableCell>{b.product?.name}</TableCell>
                    <TableCell>{b.quantityRequested}</TableCell>
                    <TableCell>{formatDate(b.date)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <Badge className={statusColor(b.status)}>{b.status}</Badge>
                        <HelpTooltip description="What it is: Booking progress label. Why it matters: Review non-final states to take action sooner." />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableShell>
        </>
      )}

      {tab === "movements" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {movementsLoading && Array.from({ length: 4 }).map((_, idx) => <KpiCardSkeleton key={idx} />)}
            {!movementsLoading && (
              <>
                <KpiCard title="Trips" value={String(movementsReport?.length ?? 0)} tooltip="What it is: Total trips found. Why it matters: Baseline for movement analysis." />
                <KpiCard title="In Terminal" value={String((movementsReport || []).filter((m: any) => m.status === "IN_TERMINAL").length)} tooltip="What it is: Trips currently in process. Why it matters: Helps monitor real-time congestion." />
                <KpiCard title="Completed" value={String((movementsReport || []).filter((m: any) => m.status === "COMPLETED").length)} deltaTone="positive" tooltip="What it is: Trips finished end-to-end. Why it matters: Reflects operational output." />
                <KpiCard title="Avg TAT (min)" value={String(Math.round(((movementsReport || []).reduce((sum: number, m: any) => sum + (m.turnaroundTimeMinutes || 0), 0) / Math.max((movementsReport || []).filter((m: any) => m.turnaroundTimeMinutes).length, 1)) || 0))} tooltip="What it is: Average turnaround time in minutes. Why it matters: Lower time usually means faster operations." />
              </>
            )}
          </div>

          <DataTableShell
            title="Truck Movements"
            description="Gate and terminal lifecycle events"
            rowCount={movementsReport?.length ?? 0}
            loading={movementsLoading}
            onExport={() => movementsReport && exportCSV(
              movementsReport.map((m: any) => ({
                Truck: m.truckNumber, Driver: m.driverName, BookingNo: m.booking?.bookingNo,
                Status: m.status,
                CheckIn: m.checkInTime ? formatDateTime(m.checkInTime) : "",
                CheckOut: m.checkOutTime ? formatDateTime(m.checkOutTime) : "",
                TAT_Minutes: m.turnaroundTimeMinutes ?? "",
              })),
              "movements-report"
            )}
            emptyTitle="No truck movements"
            emptyDescription="No trips matched the selected movement filters."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><span className="inline-flex items-center gap-1">Truck <HelpTooltip description="What it is: Vehicle identifier. Why it matters: Track one truck across stages." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Driver <HelpTooltip description="What it is: Driver name. Why it matters: Helpful for operational follow-up." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Booking <HelpTooltip description="What it is: Linked booking number. Why it matters: Connects movement to order details." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Status <HelpTooltip description="What it is: Trip stage. Why it matters: Spot delays and queue buildup quickly." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Check In <HelpTooltip description="What it is: Gate entry time. Why it matters: Start point for turnaround tracking." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Check Out <HelpTooltip description="What it is: Exit time. Why it matters: Confirms trip completion timing." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">TAT (min) <HelpTooltip description="What it is: Total turnaround minutes. Why it matters: Lower values improve throughput." /></span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsReport?.map((m: any) => (
                  <TableRow key={m.truckTripId}>
                    <TableCell className="font-medium">{m.truckNumber}</TableCell>
                    <TableCell>{m.driverName}</TableCell>
                    <TableCell>{m.booking?.bookingNo}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <Badge className={statusColor(m.status)}>{m.status}</Badge>
                        <HelpTooltip description="What it is: Trip status label. Why it matters: Use it to decide next operational step." />
                      </span>
                    </TableCell>
                    <TableCell>{m.checkInTime ? formatDateTime(m.checkInTime) : "-"}</TableCell>
                    <TableCell>{m.checkOutTime ? formatDateTime(m.checkOutTime) : "-"}</TableCell>
                    <TableCell>{m.turnaroundTimeMinutes ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableShell>
        </>
      )}

      {tab === "bays" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {baysLoading && Array.from({ length: 4 }).map((_, idx) => <KpiCardSkeleton key={idx} />)}
            {!baysLoading && (
              <>
                <KpiCard title="Bays" value={String(bayReport?.length ?? 0)} tooltip="What it is: Bays included in the report. Why it matters: Scope of utilization analysis." />
                <KpiCard title="Total Allocations" value={String((bayReport || []).reduce((sum: number, b: any) => sum + (b.allocationCount || 0), 0))} tooltip="What it is: Sum of assignments across bays. Why it matters: Overall bay workload." />
                <KpiCard title="Avg / Bay" value={String(Math.round(((bayReport || []).reduce((sum: number, b: any) => sum + (b.allocationCount || 0), 0) / Math.max(bayReport?.length || 0, 1)) || 0))} tooltip="What it is: Average assignments per bay. Why it matters: Shows balance of bay usage." />
                <KpiCard title="Gantry Count" value={String(new Set((bayReport || []).map((b: any) => b.gantry?.id).filter(Boolean)).size)} tooltip="What it is: Number of gantries represented. Why it matters: Indicates spread across equipment zones." />
              </>
            )}
          </div>

          <DataTableShell
            title="Bay Utilization"
            description="Allocation counts by bay"
            rowCount={bayReport?.length ?? 0}
            loading={baysLoading}
            onExport={() => bayReport && exportCSV(
              bayReport.map((b: any) => ({
                Bay: b.uniqueCode,
                Gantry: b.gantry?.name,
                Terminal: b.gantry?.terminal?.name,
                Allocations: b.allocationCount,
              })),
              "bay-utilization-report"
            )}
            emptyTitle="No bay utilization data"
            emptyDescription="No bay rows matched the current filters."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><span className="inline-flex items-center gap-1">Bay Code <HelpTooltip description="What it is: Bay identifier. Why it matters: Compare activity by specific bay." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Gantry <HelpTooltip description="What it is: Gantry group name. Why it matters: Shows where load is concentrated." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Terminal <HelpTooltip description="What it is: Terminal location label. Why it matters: Supports multi-terminal reporting." /></span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1">Allocations <HelpTooltip description="What it is: Assignment count for this bay. Why it matters: High count may signal pressure." /></span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bayReport?.map((b: any) => (
                  <TableRow key={b.bayId || b.id}>
                    <TableCell className="font-medium">{b.uniqueCode}</TableCell>
                    <TableCell>{b.gantry?.name}</TableCell>
                    <TableCell>{b.gantry?.terminal?.name || "-"}</TableCell>
                    <TableCell>{b.allocationCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableShell>
        </>
      )}

      {tab === "safety" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {safetyLoading && Array.from({ length: 5 }).map((_, idx) => <KpiCardSkeleton key={idx} />)}
            {!safetyLoading && safetyReport && (
              <>
                <KpiCard title="Checklists Passed" value={String(safetyReport.checklistsPassed ?? 0)} deltaTone="positive" tooltip="What it is: Successful safety checks. Why it matters: Higher means better compliance." />
                <KpiCard title="Checklists Failed" value={String(safetyReport.checklistsFailed ?? 0)} deltaTone="negative" tooltip="What it is: Failed safety checks. Why it matters: Needs follow-up to reduce risk." />
                <KpiCard title="Stop Work Orders" value={String(safetyReport.stopWorkOrders ?? 0)} tooltip="What it is: Work stoppage directives issued. Why it matters: Signals serious safety concerns." />
                <KpiCard title="Active Stop Work" value={String(safetyReport.activeStopWorkOrders ?? 0)} deltaTone="negative" tooltip="What it is: Stop-work orders not yet cleared. Why it matters: Blocks operations until resolved." />
                <KpiCard title="Total Incidents" value={String(safetyReport.totalIncidents ?? 0)} tooltip="What it is: Total incidents reported. Why it matters: Tracks overall safety exposure." />
              </>
            )}
          </div>

          {safetyReport?.incidentsBySeverity && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(safetyReport.incidentsBySeverity).map(([sev, count]: any) => (
                <Badge key={sev} className={statusColor(sev)}>{sev}: {count}</Badge>
              ))}
            </div>
          )}

          <DataTableShell
            title="Safety & Compliance"
            description="Summary export of current safety metrics"
            rowCount={safetyReport ? 1 : 0}
            loading={safetyLoading}
            onExport={() => safetyReport && exportCSV(
              [{
                ChecklistsPassed: safetyReport.checklistsPassed,
                ChecklistsFailed: safetyReport.checklistsFailed,
                StopWorkOrders: safetyReport.stopWorkOrders,
                ActiveStopWorkOrders: safetyReport.activeStopWorkOrders,
                TotalIncidents: safetyReport.totalIncidents,
                IncidentsLOW: safetyReport.incidentsBySeverity?.LOW ?? 0,
                IncidentsMED: safetyReport.incidentsBySeverity?.MED ?? 0,
                IncidentsHIGH: safetyReport.incidentsBySeverity?.HIGH ?? 0,
              }],
              "safety-compliance-report"
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell>Checklists Passed</TableCell><TableCell>{safetyReport?.checklistsPassed ?? 0}</TableCell></TableRow>
                <TableRow><TableCell>Checklists Failed</TableCell><TableCell>{safetyReport?.checklistsFailed ?? 0}</TableCell></TableRow>
                <TableRow><TableCell>Stop Work Orders</TableCell><TableCell>{safetyReport?.stopWorkOrders ?? 0}</TableCell></TableRow>
                <TableRow><TableCell>Active Stop Work Orders</TableCell><TableCell>{safetyReport?.activeStopWorkOrders ?? 0}</TableCell></TableRow>
                <TableRow><TableCell>Total Incidents</TableCell><TableCell>{safetyReport?.totalIncidents ?? 0}</TableCell></TableRow>
              </TableBody>
            </Table>
          </DataTableShell>
        </>
      )}
    </div>
  )
}
