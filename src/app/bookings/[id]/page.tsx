"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { statusColor, formatDate, formatDateTime } from "@/lib/utils"
import { StatusTimeline } from "@/components/bookings/StatusTimeline"
import { ConfirmDialog } from "@/components/bookings/ConfirmDialog"
import { ScheduleDialog } from "@/components/bookings/ScheduleDialog"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import {
  ArrowLeft, Truck, QrCode, MapPin, Clock, ShieldAlert,
  CheckCircle, Pencil, Ban, ThumbsUp, ThumbsDown, CalendarCheck,
} from "lucide-react"
import Link from "next/link"

export default function BookingDetailPage() {
  const { id } = useParams()
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Dialog states
  const [cancelDialog, setCancelDialog] = useState(false)
  const [approveDialog, setApproveDialog] = useState(false)
  const [rejectDialog, setRejectDialog] = useState(false)
  const [scheduleDialog, setScheduleDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)

  // Edit form state
  const [editQuantity, setEditQuantity] = useState("")
  const [editTransporterId, setEditTransporterId] = useState("")
  const [editAdditionalRequests, setEditAdditionalRequests] = useState("")

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${id}`)
      if (!res.ok) throw new Error("Failed to fetch booking")
      return res.json()
    },
  })

  const { data: transporters } = useQuery({
    queryKey: ["lookup-transporters"],
    queryFn: async () => {
      const res = await fetch("/api/lookup/transporters")
      const data = await res.json()
      return data.transporters
    },
    enabled: editDialog,
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLIENT_APPROVED" }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Booking approved" })
      setApproveDialog(false)
      queryClient.invalidateQueries({ queryKey: ["booking", id] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Booking rejected" })
      setRejectDialog(false)
      queryClient.invalidateQueries({ queryKey: ["booking", id] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  // Cancel mutation
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
      setCancelDialog(false)
      queryClient.invalidateQueries({ queryKey: ["booking", id] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Booking updated" })
      setEditDialog(false)
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
  const isTransporter = role === "TRANSPORTER"

  const canApprove = isAdmin && booking.status === "SUBMITTED"
  const canReject = isAdmin && booking.status === "SUBMITTED"
  const canSchedule = isAdmin && ["SUBMITTED", "CLIENT_APPROVED"].includes(booking.status)
  const canEdit = (isClient || isAdmin) && ["SUBMITTED", "CLIENT_APPROVED"].includes(booking.status)
  const canCancel = isClient && ["SUBMITTED", "CLIENT_APPROVED"].includes(booking.status)
  const canAddTruck = isTransporter && ["OPS_SCHEDULED", "TRUCK_DETAILS_PENDING", "QR_ISSUED"].includes(booking.status)
  const hasActiveStopWork = booking.stopWorkOrders?.some((s: any) => s.active)

  const openEditDialog = () => {
    setEditQuantity(booking.quantityRequested?.toString() || "")
    setEditTransporterId(booking.transporterId || "")
    setEditAdditionalRequests(booking.additionalRequests || "")
    setEditDialog(true)
  }

  const handleEditSubmit = () => {
    const data: any = {}
    const qty = parseFloat(editQuantity)
    if (!isNaN(qty) && qty !== booking.quantityRequested) data.quantityRequested = qty
    if (editTransporterId && editTransporterId !== booking.transporterId) data.transporterId = editTransporterId
    if (editAdditionalRequests !== (booking.additionalRequests || "")) data.additionalRequests = editAdditionalRequests
    if (Object.keys(data).length === 0) {
      setEditDialog(false)
      return
    }
    editMutation.mutate(data)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold inline-flex items-center gap-1.5">{booking.bookingNo}<HelpTooltip description="What it is: Unique booking reference. Why it matters: Primary identifier across all workflows." /></h1>
            <span className="inline-flex items-center gap-1">
              <Badge className={statusColor(booking.status)}>{booking.status.replace(/_/g, " ")}</Badge>
              <HelpTooltip description="What it is: Current booking stage. Why it matters: Determines what actions are available." />
            </span>
            {booking.isBulk && <Badge variant="secondary">Bulk</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Created {formatDateTime(booking.createdAt)} by {booking.createdBy?.name}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openEditDialog} title="Edit eligible booking fields like quantity or transporter.">
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <StatusTimeline status={booking.status} />
        </CardContent>
      </Card>

      {/* Stop Work Alert */}
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

      {/* Tabbed Layout */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details"><span className="inline-flex items-center gap-1">Details <HelpTooltip description="What it is: Core booking fields. Why it matters: Confirms request accuracy." /></span></TabsTrigger>
          <TabsTrigger value="trucks"><span className="inline-flex items-center gap-1">Truck Trips ({booking.truckTrips?.length || 0}) <HelpTooltip description="What it is: Linked truck executions. Why it matters: Track physical movement progress." /></span></TabsTrigger>
          <TabsTrigger value="safety"><span className="inline-flex items-center gap-1">Safety <HelpTooltip description="What it is: Safety checks and stop-work data. Why it matters: Ensures compliant operations." /></span></TabsTrigger>
          <TabsTrigger value="timeline"><span className="inline-flex items-center gap-1">Timeline <HelpTooltip description="What it is: Event history for this booking. Why it matters: Helps audit sequence of actions." /></span></TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </TabsContent>

        {/* Truck Trips Tab */}
        <TabsContent value="trucks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Truck Trips</CardTitle>
              {canAddTruck && (
                <Link href={`/transporter/trips?bookingId=${booking.id}`}>
                  <Button size="sm" title="Create a truck trip tied to this booking."><Truck className="h-4 w-4 mr-2" /> Add Truck</Button>
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
                          <span className="inline-flex items-center gap-1">
                            <Badge className={statusColor(trip.status)}>{trip.status.replace(/_/g, " ")}</Badge>
                            <HelpTooltip description="What it is: Trip stage for this truck. Why it matters: Indicates readiness for next gate action." />
                          </span>
                          {trip.qrToken && (
                            <Link href={`/transporter/trips/${trip.id}/qr`}>
                              <Button variant="outline" size="sm" title="Open truck QR used for gate scan."><QrCode className="h-3 w-3 mr-1" /> QR</Button>
                            </Link>
                          )}
                        </div>
                      </div>
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
        </TabsContent>

        {/* Safety Tab */}
        <TabsContent value="safety">
          <Card>
            <CardHeader><CardTitle className="text-lg">Safety Checklists</CardTitle></CardHeader>
            <CardContent>
              {booking.safetyChecklists?.length > 0 ? (
                <div className="space-y-2">
                  {booking.safetyChecklists.map((sc: any) => (
                    <div key={sc.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <Badge className={statusColor(sc.status)}>{sc.status}</Badge>
                        <span className="text-xs text-muted-foreground ml-2">by {sc.createdBy?.name} on {formatDateTime(sc.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No safety checklists</p>
              )}

              {booking.stopWorkOrders?.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <h3 className="text-sm font-semibold mb-2">Stop Work Orders</h3>
                  <div className="space-y-2">
                    {booking.stopWorkOrders.map((swo: any) => (
                      <div key={swo.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div>
                          <Badge className={swo.active ? "bg-red-200 text-red-800" : "bg-gray-100 text-gray-700"}>
                            {swo.active ? "Active" : "Resolved"}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-2">{swo.reason}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">by {swo.issuedBy?.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle className="text-lg">Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="text-sm font-medium">Booking Created</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(booking.createdAt)} by {booking.createdBy?.name}</p>
                  </div>
                </div>
                {booking.bayAllocations?.map((ba: any) => (
                  <div key={ba.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">Bay Allocated: {ba.bay.uniqueCode}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(ba.allocatedAt)} by {ba.allocatedBy?.name}</p>
                    </div>
                  </div>
                ))}
                {booking.truckTrips?.map((trip: any) => (
                  <div key={trip.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">Truck Added: {trip.truckNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(trip.createdAt)}</p>
                      {trip.gateEvents?.map((ge: any) => (
                        <div key={ge.id} className="ml-4 mt-1">
                          <p className="text-xs">
                            <span className="font-medium">{ge.type.replace("_", " ")}</span>
                            {" "}{formatDateTime(ge.timestamp)} by {ge.security?.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {booking.safetyChecklists?.map((sc: any) => (
                  <div key={sc.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">Safety Checklist: {sc.status}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(sc.createdAt)} by {sc.createdBy?.name}</p>
                    </div>
                  </div>
                ))}
                {booking.stopWorkOrders?.map((swo: any) => (
                  <div key={swo.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">Stop Work Order: {swo.reason}</p>
                      <p className="text-xs text-muted-foreground">by {swo.issuedBy?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        {canApprove && (
          <Button onClick={() => setApproveDialog(true)}>
            <ThumbsUp className="h-4 w-4 mr-2" /> Approve
          </Button>
        )}
        {canReject && (
          <Button variant="destructive" onClick={() => setRejectDialog(true)}>
            <ThumbsDown className="h-4 w-4 mr-2" /> Reject
          </Button>
        )}
        {canSchedule && (
          <Button variant="outline" onClick={() => setScheduleDialog(true)}>
            <CalendarCheck className="h-4 w-4 mr-2" /> Schedule
          </Button>
        )}
        {canCancel && (
          <Button variant="destructive" onClick={() => setCancelDialog(true)}>
            <Ban className="h-4 w-4 mr-2" /> Cancel Booking
          </Button>
        )}
        {canAddTruck && (
          <Link href={`/transporter/trips?bookingId=${booking.id}`}>
            <Button><Truck className="h-4 w-4 mr-2" /> Add Truck</Button>
          </Link>
        )}
      </div>

      {/* Approve Dialog */}
      <ConfirmDialog
        open={approveDialog}
        onOpenChange={setApproveDialog}
        title="Approve Booking"
        description={`Are you sure you want to approve booking ${booking.bookingNo}? This will move it to CLIENT_APPROVED status.`}
        confirmLabel="Approve"
        onConfirm={() => approveMutation.mutate()}
        isPending={approveMutation.isPending}
      />

      {/* Reject Dialog */}
      <ConfirmDialog
        open={rejectDialog}
        onOpenChange={setRejectDialog}
        title="Reject Booking"
        description={`Are you sure you want to reject booking ${booking.bookingNo}? This action cannot be undone.`}
        confirmLabel="Reject"
        confirmVariant="destructive"
        onConfirm={() => rejectMutation.mutate()}
        isPending={rejectMutation.isPending}
      />

      {/* Cancel Dialog */}
      <ConfirmDialog
        open={cancelDialog}
        onOpenChange={setCancelDialog}
        title="Cancel Booking"
        description={`Are you sure you want to cancel booking ${booking.bookingNo}? This action cannot be undone.`}
        confirmLabel="Cancel Booking"
        confirmVariant="destructive"
        onConfirm={() => cancelMutation.mutate()}
        isPending={cancelMutation.isPending}
      />

      {/* Schedule Dialog */}
      {canSchedule && (
        <ScheduleDialog
          open={scheduleDialog}
          onOpenChange={setScheduleDialog}
          booking={booking}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Booking: {booking.bookingNo}</DialogTitle>
            <DialogDescription>Update booking details. Only changed fields will be saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label>Transporter</Label>
              <Select value={editTransporterId} onValueChange={setEditTransporterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transporter" />
                </SelectTrigger>
                <SelectContent>
                  {transporters?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional Requests</Label>
              <Textarea
                value={editAdditionalRequests}
                onChange={(e) => setEditAdditionalRequests(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)} disabled={editMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
