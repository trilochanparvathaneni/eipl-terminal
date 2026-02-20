"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { statusColor, formatDateTime } from "@/lib/utils"
import { QrCode, LogIn, LogOut, Truck, ShieldAlert, Search } from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"

export default function SecurityGatePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [qrInput, setQrInput] = useState("")
  const [scannedTrip, setScannedTrip] = useState<any>(null)
  const [checkInDialog, setCheckInDialog] = useState(false)
  const [checkOutDialog, setCheckOutDialog] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<any>(null)
  const [weighmentTare, setWeighmentTare] = useState("")
  const [weighmentGross, setWeighmentGross] = useState("")
  const [netQuantity, setNetQuantity] = useState("")

  const { data: todayTrips, isLoading } = useQuery({
    queryKey: ["today-arrivals"],
    queryFn: async () => {
      const res = await fetch("/api/gate/today")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    refetchInterval: 30000,
  })

  const scanMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/gate/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: (data) => {
      setScannedTrip(data)
      toast({ title: "QR Scanned", description: `Truck: ${data.truckNumber}` })
    },
    onError: (err: Error) => {
      toast({ title: "Scan Failed", description: err.message, variant: "destructive" })
    },
  })

  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/gate/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Check-in successful" })
      setCheckInDialog(false)
      setSelectedTrip(null)
      setScannedTrip(null)
      setWeighmentTare("")
      queryClient.invalidateQueries({ queryKey: ["today-arrivals"] })
    },
    onError: (err: Error) => {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" })
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/gate/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Check-out successful" })
      setCheckOutDialog(false)
      setSelectedTrip(null)
      setWeighmentGross("")
      setNetQuantity("")
      queryClient.invalidateQueries({ queryKey: ["today-arrivals"] })
    },
    onError: (err: Error) => {
      toast({ title: "Check-out failed", description: err.message, variant: "destructive" })
    },
  })

  const handleScan = () => {
    if (!qrInput.trim()) return
    // Try to parse JSON QR data
    let token = qrInput.trim()
    try {
      const parsed = JSON.parse(token)
      token = parsed.token || token
    } catch {}
    scanMutation.mutate(token)
  }

  const handleCheckIn = () => {
    if (!selectedTrip) return
    checkInMutation.mutate({
      truckTripId: selectedTrip.id,
      weighmentTare: weighmentTare ? parseFloat(weighmentTare) : undefined,
    })
  }

  const handleCheckOut = () => {
    if (!selectedTrip) return
    checkOutMutation.mutate({
      truckTripId: selectedTrip.id,
      weighmentGross: weighmentGross ? parseFloat(weighmentGross) : undefined,
      netQuantity: netQuantity ? parseFloat(netQuantity) : undefined,
    })
  }

  const awaitingEntry = todayTrips?.filter((t: any) => t.status === "QR_ISSUED") || []
  const inTerminal = todayTrips?.filter((t: any) => ["ARRIVED", "IN_TERMINAL", "LOADED"].includes(t.status)) || []
  const completed = todayTrips?.filter((t: any) => ["EXITED", "COMPLETED"].includes(t.status)) || []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold inline-flex items-center gap-1.5">
        Gate Operations
        <HelpTooltip description="What it is: Entry and exit control for trucks. Why it matters: Accurate gate updates keep trip status reliable." />
      </h1>

      {/* QR Scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Scanner <HelpTooltip description="What it is: QR token reader. Why it matters: Fast way to validate truck identity and stage." /></CardTitle>
          <CardDescription>Scan or enter QR token manually</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Paste or scan QR token..."
              title="Paste the truck QR token or scan from a handheld device."
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
            <Button onClick={handleScan} disabled={scanMutation.isPending} title="Validate token and fetch truck trip details.">
              <Search className="h-4 w-4 mr-2" /> Scan
            </Button>
          </div>
          {scannedTrip && (
            <div className="mt-4 p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{scannedTrip.truckNumber} - {scannedTrip.driverName}</p>
                  <p className="text-sm text-muted-foreground">
                    Booking: {scannedTrip.booking?.bookingNo} | {scannedTrip.booking?.product?.name} | {scannedTrip.booking?.client?.name}
                  </p>
                  {scannedTrip.booking?.stopWorkOrders?.length > 0 && (
                    <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                      <ShieldAlert className="h-3 w-3" /> Active Stop Work Order
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {scannedTrip.status === "QR_ISSUED" && (
                    <Button
                      onClick={() => { setSelectedTrip(scannedTrip); setCheckInDialog(true) }}
                      disabled={scannedTrip.booking?.stopWorkOrders?.length > 0}
                    >
                      <LogIn className="h-4 w-4 mr-1" /> Check In
                    </Button>
                  )}
                  {["IN_TERMINAL", "LOADED"].includes(scannedTrip.status) && (
                    <Button
                      variant="secondary"
                      onClick={() => { setSelectedTrip(scannedTrip); setCheckOutDialog(true) }}
                    >
                      <LogOut className="h-4 w-4 mr-1" /> Check Out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's arrivals */}
      <Tabs defaultValue="awaiting">
        <TabsList>
          <TabsTrigger value="awaiting"><span className="inline-flex items-center gap-1">Awaiting ({awaitingEntry.length}) <HelpTooltip description="What it is: Trucks with valid QR waiting to enter. Why it matters: Process these to keep gate flow moving." /></span></TabsTrigger>
          <TabsTrigger value="inside"><span className="inline-flex items-center gap-1">In Terminal ({inTerminal.length}) <HelpTooltip description="What it is: Trucks currently inside terminal. Why it matters: Use this list for check-out readiness." /></span></TabsTrigger>
          <TabsTrigger value="completed"><span className="inline-flex items-center gap-1">Completed ({completed.length}) <HelpTooltip description="What it is: Trucks finished and exited. Why it matters: Historical view for audit and throughput." /></span></TabsTrigger>
        </TabsList>

        <TabsContent value="awaiting">
          <TripList
            trips={awaitingEntry}
            action="checkin"
            onAction={(trip: any) => { setSelectedTrip(trip); setCheckInDialog(true) }}
          />
        </TabsContent>
        <TabsContent value="inside">
          <TripList
            trips={inTerminal}
            action="checkout"
            onAction={(trip: any) => { setSelectedTrip(trip); setCheckOutDialog(true) }}
          />
        </TabsContent>
        <TabsContent value="completed">
          <TripList trips={completed} />
        </TabsContent>
      </Tabs>

      {/* Check-In Dialog */}
      <Dialog open={checkInDialog} onOpenChange={setCheckInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-In: {selectedTrip?.truckNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <p>Driver: {selectedTrip?.driverName} ({selectedTrip?.driverPhone})</p>
              <p>Booking: {selectedTrip?.booking?.bookingNo}</p>
              <p>Product: {selectedTrip?.booking?.product?.name}</p>
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Tare Weight (optional) <HelpTooltip description="What it is: Empty truck weight. Why it matters: Helps compute loaded net quantity accurately." /></Label>
              <Input type="number" value={weighmentTare} onChange={(e) => setWeighmentTare(e.target.value)} placeholder="Enter tare weight" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInDialog(false)}>Cancel</Button>
            <Button onClick={handleCheckIn} disabled={checkInMutation.isPending}>
              {checkInMutation.isPending ? "Processing..." : "Confirm Check-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-Out Dialog */}
      <Dialog open={checkOutDialog} onOpenChange={setCheckOutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-Out: {selectedTrip?.truckNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Gross Weight <HelpTooltip description="What it is: Loaded truck weight. Why it matters: Used for quantity reconciliation." /></Label>
              <Input type="number" value={weighmentGross} onChange={(e) => setWeighmentGross(e.target.value)} placeholder="Enter gross weight" />
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Net Quantity <HelpTooltip description="What it is: Product actually moved. Why it matters: Final dispatch quantity for records and billing." /></Label>
              <Input type="number" value={netQuantity} onChange={(e) => setNetQuantity(e.target.value)} placeholder="Enter net quantity" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckOutDialog(false)}>Cancel</Button>
            <Button onClick={handleCheckOut} disabled={checkOutMutation.isPending}>
              {checkOutMutation.isPending ? "Processing..." : "Confirm Check-Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TripList({ trips, action, onAction }: { trips: any[]; action?: string; onAction?: (trip: any) => void }) {
  if (trips.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">No trips</CardContent></Card>
  }
  return (
    <div className="space-y-2 mt-2">
      {trips.map((trip: any) => (
        <Card key={trip.id}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{trip.truckNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {trip.driverName} | {trip.booking?.bookingNo} | {trip.booking?.product?.name} | {trip.booking?.client?.name}
                  </p>
                  {trip.booking?.timeSlot && (
                    <p className="text-xs text-muted-foreground">
                      Slot: {trip.booking.timeSlot.startTime} - {trip.booking.timeSlot.endTime}
                    </p>
                  )}
                  {trip.booking?.bayAllocations?.[0] && (
                    <p className="text-xs text-muted-foreground">
                      Bay: {trip.booking.bayAllocations[0].bay.uniqueCode}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <Badge className={statusColor(trip.status)}>{trip.status.replace(/_/g, " ")}</Badge>
                  <HelpTooltip description="What it is: Trip stage at gate. Why it matters: Decides whether check-in or check-out is allowed." />
                </span>
                {trip.booking?.stopWorkOrders?.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Badge className="bg-red-200 text-red-800">STOP WORK</Badge>
                    <HelpTooltip description="What it is: Safety hold. Why it matters: Truck cannot proceed until resolved." />
                  </span>
                )}
                {action === "checkin" && onAction && (
                  <Button
                    size="sm"
                    onClick={() => onAction(trip)}
                    disabled={trip.booking?.stopWorkOrders?.length > 0}
                    title="Check truck into terminal entry workflow."
                  >
                    <LogIn className="h-3 w-3 mr-1" /> In
                  </Button>
                )}
                {action === "checkout" && onAction && (
                  <Button size="sm" variant="secondary" onClick={() => onAction(trip)} title="Check truck out after loading and clearance.">
                    <LogOut className="h-3 w-3 mr-1" /> Out
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
