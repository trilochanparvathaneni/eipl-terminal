"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { statusColor, formatDate, formatDateTime } from "@/lib/utils"
import { Truck, Plus, QrCode, Download } from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import Link from "next/link"

export default function TransporterTripsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const bookingIdParam = searchParams.get("bookingId")

  const [showAdd, setShowAdd] = useState(false)
  const [bookingId, setBookingId] = useState(bookingIdParam || "")
  const [truckNumber, setTruckNumber] = useState("")
  const [driverName, setDriverName] = useState("")
  const [driverPhone, setDriverPhone] = useState("")

  const { data: trips, isLoading } = useQuery({
    queryKey: ["my-trips"],
    queryFn: async () => {
      const res = await fetch("/api/truck-trips")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: bookings } = useQuery({
    queryKey: ["transporter-bookings"],
    queryFn: async () => {
      const res = await fetch("/api/bookings?status=OPS_SCHEDULED&limit=50")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/truck-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Trip created", description: `QR issued for ${data.truckNumber}` })
      setShowAdd(false)
      setTruckNumber("")
      setDriverName("")
      setDriverPhone("")
      setBookingId("")
      queryClient.invalidateQueries({ queryKey: ["my-trips"] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({ bookingId, truckNumber, driverName, driverPhone })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold inline-flex items-center gap-1.5">My Trips <HelpTooltip description="What it is: Trips created for your assigned bookings. Why it matters: Track truck progress and QR readiness." /></h1>
        <Button onClick={() => { setShowAdd(true); if (bookingIdParam) setBookingId(bookingIdParam) }} title="Create a truck trip and issue QR for gate processing.">
          <Plus className="h-4 w-4 mr-2" /> Add Truck Trip
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        <div className="space-y-3">
          {trips?.map((trip: any) => (
            <Card key={trip.id}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{trip.truckNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {trip.driverName} ({trip.driverPhone})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trip.booking?.bookingNo} | {trip.booking?.product?.name} | {trip.booking?.client?.name} | {formatDate(trip.booking?.date)}
                      </p>
                      {trip.booking?.bayAllocations?.[0] && (
                        <p className="text-xs text-muted-foreground">
                          Bay: {trip.booking.bayAllocations[0].bay.gantry?.name} / {trip.booking.bayAllocations[0].bay.uniqueCode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <Badge className={statusColor(trip.status)}>{trip.status.replace(/_/g, " ")}</Badge>
                      <HelpTooltip description="What it is: Trip stage. Why it matters: Shows whether this truck is ready, inside, or completed." />
                    </span>
                    {trip.qrToken && (
                      <Link href={`/transporter/trips/${trip.id}/qr`}>
                        <Button variant="outline" size="sm" title="Open printable QR for gate scan.">
                          <QrCode className="h-3 w-3 mr-1" /> View QR
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!trips || trips.length === 0) && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No trips yet</CardContent></Card>
          )}
        </div>
      )}

      {/* Add Trip Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Truck Trip</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Booking <HelpTooltip description="What it is: Booking this truck belongs to. Why it matters: Links trip to approved order details." /></Label>
              {bookingIdParam ? (
                <Input value={bookingId} readOnly className="bg-muted" />
              ) : (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  required
                >
                  <option value="">Select booking</option>
                  {bookings?.bookings?.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.bookingNo} - {b.product?.name} - {b.client?.name} ({formatDate(b.date)})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Truck Number * <HelpTooltip description="What it is: Vehicle identifier. Why it matters: Used at gate and throughout tracking." /></Label>
              <Input
                value={truckNumber}
                onChange={(e) => setTruckNumber(e.target.value.toUpperCase())}
                placeholder="e.g. MH12AB1234"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Driver Name * <HelpTooltip description="What it is: Person driving the truck. Why it matters: Required for identity and contact at gate." /></Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Full name" required />
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Driver Phone * <HelpTooltip description="What it is: Driver contact number. Why it matters: Enables quick coordination for delays or issues." /></Label>
              <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="10-digit phone" required />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create & Issue QR"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
