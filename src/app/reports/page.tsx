"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { statusColor, formatDate, formatDateTime } from "@/lib/utils"
import { Download, RotateCcw } from "lucide-react"

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

  const { data: bookingsReport } = useQuery({
    queryKey: ["report-bookings", bookingsQuery],
    queryFn: async () => {
      const r = await fetch(`/api/reports/bookings?${bookingsQuery}`)
      return r.json()
    },
  })
  const { data: movementsReport } = useQuery({
    queryKey: ["report-movements", movementsQuery],
    queryFn: async () => {
      const r = await fetch(`/api/reports/movements?${movementsQuery}`)
      const data = await r.json()
      return data.movements ?? []
    },
  })
  const { data: bayReport } = useQuery({
    queryKey: ["report-bays", baysQuery],
    queryFn: async () => {
      const r = await fetch(`/api/reports/bay-utilization?${baysQuery}`)
      const data = await r.json()
      return data.utilization ?? []
    },
  })
  const { data: safetyReport } = useQuery({
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="bookings" value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="movements">Truck Movements</TabsTrigger>
          <TabsTrigger value="bays">Bay Utilization</TabsTrigger>
          <TabsTrigger value="safety">Safety/Compliance</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              {tab === "bookings" && (
                <>
                  <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">Status</Label>
                    <Select value={bookingStatus} onValueChange={setBookingStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {["DRAFT","SUBMITTED","CLIENT_APPROVED","OPS_SCHEDULED","TRUCK_DETAILS_PENDING","QR_ISSUED","ARRIVED_GATE","IN_TERMINAL","LOADED","EXITED","CLOSED","REJECTED","CANCELLED","STOP_WORK"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[200px]">
                    <Label className="text-xs">Client</Label>
                    <Select value={bookingClientId} onValueChange={setBookingClientId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[200px]">
                    <Label className="text-xs">Product</Label>
                    <Select value={bookingProductId} onValueChange={setBookingProductId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">Booking No</Label>
                    <Input value={bookingNo} onChange={(e) => setBookingNo(e.target.value)} placeholder="BK..." />
                  </div>
                </>
              )}

              {tab === "movements" && (
                <>
                  <div className="space-y-1 min-w-[170px]">
                    <Label className="text-xs">Trip Status</Label>
                    <Select value={tripStatus} onValueChange={setTripStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {["PENDING","QR_ISSUED","ARRIVED","IN_TERMINAL","LOADED","EXITED","COMPLETED"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">Truck Number</Label>
                    <Input value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} placeholder="AP29..." />
                  </div>
                  <div className="space-y-1 min-w-[220px]">
                    <Label className="text-xs">Transporter</Label>
                    <Select value={moveTransporterId} onValueChange={setMoveTransporterId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Label className="text-xs">Gantry</Label>
                    <Select value={bayGantryId} onValueChange={setBayGantryId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {gantries.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">Bay</Label>
                    <Select value={bayId} onValueChange={setBayId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {bays.filter((b: any) => bayGantryId === "ALL" || b.gantry?.id === bayGantryId)
                          .map((b: any) => <SelectItem key={b.id} value={b.id}>{b.uniqueCode}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[200px]">
                    <Label className="text-xs">Product</Label>
                    <Select value={bayProductId} onValueChange={setBayProductId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[130px]">
                    <Label className="text-xs">Min Allocations</Label>
                    <Input type="number" min={0} value={minAllocations} onChange={(e) => setMinAllocations(e.target.value)} placeholder="0" />
                  </div>
                </>
              )}

              {tab === "safety" && (
                <>
                  <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">Checklist Status</Label>
                    <Select value={checklistStatus} onValueChange={setChecklistStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {["PASSED", "FAILED", "PENDING"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[160px]">
                    <Label className="text-xs">Incident Severity</Label>
                    <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {["LOW","MED","HIGH"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[150px]">
                    <Label className="text-xs">Incident Status</Label>
                    <Select value={incidentStatus} onValueChange={setIncidentStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {["OPEN","CLOSED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[160px]">
                    <Label className="text-xs">Stop Work</Label>
                    <Select value={stopWorkActiveOnly} onValueChange={setStopWorkActiveOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="YES">Active only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button variant="outline" onClick={resetCurrentTabFilters}>
                <RotateCcw className="h-3 w-3 mr-1" /> Reset Tab Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="bookings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Bookings Report</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bookingsReport?.bookings && exportCSV(
                  bookingsReport.bookings.map((b: any) => ({
                    BookingNo: b.bookingNo, Client: b.client?.name, Product: b.product?.name,
                    Quantity: b.quantityRequested, Date: formatDate(b.date), Status: b.status,
                  })),
                  "bookings-report"
                )}
              >
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {bookingsReport?.statusDistribution && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(bookingsReport.statusDistribution).map(([status, count]: any) => (
                    <Badge key={status} className={statusColor(status)}>{status}: {count}</Badge>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking No</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
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
                        <TableCell><Badge className={statusColor(b.status)}>{b.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Truck Movements</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => movementsReport && exportCSV(
                  movementsReport.map((m: any) => ({
                    Truck: m.truckNumber, Driver: m.driverName, BookingNo: m.booking?.bookingNo,
                    Status: m.status,
                    CheckIn: m.checkInTime ? formatDateTime(m.checkInTime) : "",
                    CheckOut: m.checkOutTime ? formatDateTime(m.checkOutTime) : "",
                    TAT_Minutes: m.turnaroundTimeMinutes ?? "",
                  })),
                  "movements-report"
                )}
              >
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Truck</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>TAT (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsReport?.map((m: any) => (
                      <TableRow key={m.truckTripId}>
                        <TableCell className="font-medium">{m.truckNumber}</TableCell>
                        <TableCell>{m.driverName}</TableCell>
                        <TableCell>{m.booking?.bookingNo}</TableCell>
                        <TableCell><Badge className={statusColor(m.status)}>{m.status}</Badge></TableCell>
                        <TableCell>{m.checkInTime ? formatDateTime(m.checkInTime) : "-"}</TableCell>
                        <TableCell>{m.checkOutTime ? formatDateTime(m.checkOutTime) : "-"}</TableCell>
                        <TableCell>{m.turnaroundTimeMinutes ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bays">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Bay Utilization</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bayReport && exportCSV(
                  bayReport.map((b: any) => ({
                    Bay: b.uniqueCode,
                    Gantry: b.gantry?.name,
                    Terminal: b.gantry?.terminal?.name,
                    Allocations: b.allocationCount,
                  })),
                  "bay-utilization-report"
                )}
              >
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bay Code</TableHead>
                      <TableHead>Gantry</TableHead>
                      <TableHead>Terminal</TableHead>
                      <TableHead>Allocations</TableHead>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Safety & Compliance</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => safetyReport && exportCSV(
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
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {safetyReport && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{safetyReport.checklistsPassed ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Checklists Passed</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{safetyReport.checklistsFailed ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Checklists Failed</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{safetyReport.stopWorkOrders ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Stop Work Orders</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{safetyReport.activeStopWorkOrders ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Active Stop Work</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{safetyReport.totalIncidents ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total Incidents</p>
                  </div>
                </div>
              )}
              {safetyReport?.incidentsBySeverity && (
                <div className="flex gap-3">
                  {Object.entries(safetyReport.incidentsBySeverity).map(([sev, count]: any) => (
                    <Badge key={sev} className={statusColor(sev)}>{sev}: {count}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
