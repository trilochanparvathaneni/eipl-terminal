"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { statusColor, formatDate } from "@/lib/utils"
import { Plus, Search } from "lucide-react"

export default function BookingsPage() {
  const { data: session } = useSession()
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)

  const params = new URLSearchParams()
  if (status && status !== "ALL") params.set("status", status)
  if (dateFrom) params.set("dateFrom", dateFrom)
  if (dateTo) params.set("dateTo", dateTo)
  params.set("page", page.toString())
  params.set("limit", "15")

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", status, dateFrom, dateTo, page],
    queryFn: async () => {
      const res = await fetch(`/api/bookings?${params}`)
      if (!res.ok) throw new Error("Failed to fetch bookings")
      return res.json()
    },
  })

  const canCreate = session?.user?.role === "CLIENT" || session?.user?.role === "TERMINAL_ADMIN" || session?.user?.role === "SUPER_ADMIN"

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Bookings</h1>
        {canCreate && (
          <Link href="/bookings/new">
            <Button><Plus className="h-4 w-4 mr-2" /> New Booking</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="CLIENT_APPROVED">Client Approved</SelectItem>
                <SelectItem value="OPS_SCHEDULED">Ops Scheduled</SelectItem>
                <SelectItem value="QR_ISSUED">QR Issued</SelectItem>
                <SelectItem value="IN_TERMINAL">In Terminal</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From date" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To date" />
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
                      <TableHead>Booking No</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Transporter</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.bookings?.map((b: any) => (
                      <TableRow key={b.id} className="cursor-pointer" onClick={() => window.location.href = `/bookings/${b.id}`}>
                        <TableCell className="font-medium">{b.bookingNo}</TableCell>
                        <TableCell>{b.client?.name}</TableCell>
                        <TableCell>{b.product?.name}</TableCell>
                        <TableCell>{b.quantityRequested}</TableCell>
                        <TableCell>{formatDate(b.date)}</TableCell>
                        <TableCell>{b.timeSlot ? `${b.timeSlot.startTime}-${b.timeSlot.endTime}` : "TBD"}</TableCell>
                        <TableCell>{b.transporter?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge className={statusColor(b.status)}>
                            {b.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!data?.bookings || data.bookings.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No bookings found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data?.total > 0 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((page - 1) * 15) + 1}-{Math.min(page * 15, data.total)} of {data.total}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page * 15 >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
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
