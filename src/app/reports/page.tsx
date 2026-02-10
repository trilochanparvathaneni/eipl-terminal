"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { statusColor, formatDate, formatDateTime } from "@/lib/utils"
import { Download } from "lucide-react"

function exportCSV(data: any[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","))
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const qp = new URLSearchParams()
  if (dateFrom) qp.set("dateFrom", dateFrom)
  if (dateTo) qp.set("dateTo", dateTo)

  const { data: bookingsReport } = useQuery({
    queryKey: ["report-bookings", dateFrom, dateTo],
    queryFn: async () => { const r = await fetch(`/api/reports/bookings?${qp}`); return r.json() },
  })

  const { data: movementsReport } = useQuery({
    queryKey: ["report-movements", dateFrom, dateTo],
    queryFn: async () => {
      const r = await fetch(`/api/reports/movements?${qp}`)
      const data = await r.json()
      return data.movements ?? []
    },
  })

  const { data: bayReport } = useQuery({
    queryKey: ["report-bays", dateFrom, dateTo],
    queryFn: async () => {
      const r = await fetch(`/api/reports/bay-utilization?${qp}`)
      const data = await r.json()
      return data.utilization ?? []
    },
  })

  const { data: safetyReport } = useQuery({
    queryKey: ["report-safety", dateFrom, dateTo],
    queryFn: async () => {
      const r = await fetch(`/api/reports/safety?${qp}`)
      const data = await r.json()
      return {
        checklistsPassed: data.checklists?.PASSED ?? 0,
        checklistsFailed: data.checklists?.FAILED ?? 0,
        stopWorkOrders: data.stopWorkOrders?.total ?? 0,
        totalIncidents: Object.values(data.incidents ?? {}).reduce((sum: number, n: any) => sum + n, 0),
        incidentsBySeverity: data.incidents ?? {},
      }
    },
  })

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

      <Tabs defaultValue="bookings">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="movements">Truck Movements</TabsTrigger>
          <TabsTrigger value="bays">Bay Utilization</TabsTrigger>
          <TabsTrigger value="safety">Safety/Compliance</TabsTrigger>
        </TabsList>

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
                    CheckIn: m.checkInTime ? formatDateTime(m.checkInTime) : "", CheckOut: m.checkOutTime ? formatDateTime(m.checkOutTime) : "",
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
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>TAT (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsReport?.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.truckNumber}</TableCell>
                        <TableCell>{m.driverName}</TableCell>
                        <TableCell>{m.booking?.bookingNo}</TableCell>
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
            <CardHeader><CardTitle className="text-lg">Bay Utilization</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bay Code</TableHead>
                      <TableHead>Gantry</TableHead>
                      <TableHead>Allocations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bayReport?.map((b: any) => (
                      <TableRow key={b.bayId || b.id}>
                        <TableCell className="font-medium">{b.uniqueCode}</TableCell>
                        <TableCell>{b.gantry?.name}</TableCell>
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
            <CardHeader><CardTitle className="text-lg">Safety & Compliance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {safetyReport && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
