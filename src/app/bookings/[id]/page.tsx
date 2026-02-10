"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { statusColor, formatDate, formatDateTime } from "@/lib/utils"
import { ArrowLeft, Truck, QrCode, MapPin, Clock, ShieldAlert, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function BookingDetailPage() {
  const { id } = useParams()
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${id}`)
      if (!res.ok) throw new Error("Failed to fetch booking")
      return res.json()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Booking cancelled" })
      queryClient.invalidateQueries({ queryKey: ["booking", id] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/bookings/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Booking scheduled" })
      queryClient.invalidateQueries({ queryKey: ["booking", id] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  if (!booking) {
    return <div className="text-center py-8 text-muted-foreground">Booking not found</div>
  }

  const role = session?.user?.role
  const isAdmin = role === "TERMINAL_ADMIN" || role === "SUPER_ADMIN"
  const isClient = role === "CLIENT"
  const canCancel = isClient && ["SUBMITTED", "CLIENT_APPROVED"].includes(booking.status)
  const canSchedule = isAdmin && ["SUBMITTED", "CLIENT_APPROVED"].includes(booking.status)
  const hasActiveStopWork = booking.stopWorkOrders?.some((s: any) => s.active)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{booking.bookingNo}</h1>
            <Badge className={statusColor(booking.status)}>{booking.status.replace(/_/g, " ")}</Badge>
            {booking.isBulk && <Badge variant="secondary">Bulk</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Created {formatDateTime(booking.createdAt)} by {booking.createdBy?.name}</p>
        </div>
      </div>

      {hasActiveStopWork && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-4 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Active Stop Work Order</p>
              <p className="text-sm text-muted-foreground">{booking.stopWorkOrders.find((s: any) => s.active)?.reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Booking Details */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Booking Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{booking.client?.name}</span>
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium">{booking.product?.name} ({booking.product?.category})</span>
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">{booking.quantityRequested}</span>
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{formatDate(booking.date)}</span>
              <span className="text-muted-foreground">Time Slot</span>
              <span className="font-medium">{booking.timeSlot ? `${booking.timeSlot.startTime} - ${booking.timeSlot.endTime}` : "TBD"}</span>
              <span className="text-muted-foreground">Transporter</span>
              <span className="font-medium">{booking.transporter?.name || "Not assigned"}</span>
              <span className="text-muted-foreground">Terminal</span>
              <span className="font-medium">{booking.terminal?.name}</span>
            </div>
            {booking.additionalRequests && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Additional Requests</p>
                <p className="text-sm">{booking.additionalRequests}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bay Allocation */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Bay Allocation</CardTitle></CardHeader>
          <CardContent>
            {booking.bayAllocations?.length > 0 ? (
              <div className="space-y-2">
                {booking.bayAllocations.map((ba: any) => (
                  <div key={ba.id} className="flex items-center gap-3 p-2 bg-muted rounded-md">
                    <MapPin className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{ba.bay.gantry?.name} / {ba.bay.name} ({ba.bay.uniqueCode})</p>
                      <p className="text-xs text-muted-foreground">Allocated by {ba.allocatedBy?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No bay allocated yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Truck Trips */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Truck Trips</CardTitle>
          {role === "TRANSPORTER" && ["OPS_SCHEDULED", "TRUCK_DETAILS_PENDING", "QR_ISSUED"].includes(booking.status) && (
            <Link href={`/transporter/trips?bookingId=${booking.id}`}>
              <Button size="sm"><Truck className="h-4 w-4 mr-2" /> Add Truck</Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {booking.truckTrips?.length > 0 ? (
            <div className="space-y-3">
              {booking.truckTrips.map((trip: any) => (
                <div key={trip.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4" />
                      <div>
                        <p className="font-medium text-sm">{trip.truckNumber}</p>
                        <p className="text-xs text-muted-foreground">{trip.driverName} - {trip.driverPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColor(trip.status)}>{trip.status.replace(/_/g, " ")}</Badge>
                      {trip.qrToken && (
                        <Link href={`/transporter/trips/${trip.id}/qr`}>
                          <Button variant="outline" size="sm"><QrCode className="h-3 w-3 mr-1" /> QR</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  {/* Gate Events */}
                  {trip.gateEvents?.length > 0 && (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      {trip.gateEvents.map((ge: any) => (
                        <div key={ge.id} className="flex items-center gap-2 text-xs">
                          {ge.type === "CHECK_IN" ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <CheckCircle className="h-3 w-3 text-blue-500" />
                          )}
                          <span className="font-medium">{ge.type.replace("_", " ")}</span>
                          <span className="text-muted-foreground">{formatDateTime(ge.timestamp)}</span>
                          <span className="text-muted-foreground">by {ge.security?.name}</span>
                          {ge.weighmentTare && <span>Tare: {ge.weighmentTare}</span>}
                          {ge.weighmentGross && <span>Gross: {ge.weighmentGross}</span>}
                          {ge.netQuantity && <span>Net: {ge.netQuantity}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No truck trips yet</p>
          )}
        </CardContent>
      </Card>

      {/* Safety Checklists */}
      {booking.safetyChecklists?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Safety Checklists</CardTitle></CardHeader>
          <CardContent>
            {booking.safetyChecklists.map((sc: any) => (
              <div key={sc.id} className="flex items-center justify-between p-2 border rounded-md mb-2">
                <div>
                  <Badge className={statusColor(sc.status)}>{sc.status}</Badge>
                  <span className="text-xs text-muted-foreground ml-2">by {sc.createdBy?.name} on {formatDateTime(sc.createdAt)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {canCancel && (
          <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
            Cancel Booking
          </Button>
        )}
        {canSchedule && (
          <Button onClick={() => scheduleMutation.mutate({})} disabled={scheduleMutation.isPending}>
            Schedule (OPS)
          </Button>
        )}
      </div>
    </div>
  )
}
