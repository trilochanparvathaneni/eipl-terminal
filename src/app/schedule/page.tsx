"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { statusColor, formatDate } from "@/lib/utils"
import { Calendar, ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import Link from "next/link"

export default function SchedulePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [scheduleDialog, setScheduleDialog] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [selectedSlot, setSelectedSlot] = useState("")
  const [selectedBay, setSelectedBay] = useState("")

  const terminalId = session?.user?.terminalId

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["schedule-bookings", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/bookings?dateFrom=${selectedDate}&dateTo=${selectedDate}&limit=50`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: timeSlots } = useQuery({
    queryKey: ["schedule-slots", selectedDate, terminalId],
    queryFn: async () => {
      const res = await fetch(`/api/lookup/timeslots?date=${selectedDate}&terminalId=${terminalId}`)
      const data = await res.json()
      return data.timeSlots
    },
    enabled: !!terminalId,
  })

  const { data: bays } = useQuery({
    queryKey: ["bays", selectedBooking?.productId],
    queryFn: async () => {
      const res = await fetch(`/api/lookup/bays?productId=${selectedBooking?.productId}`)
      const data = await res.json()
      return data.bays
    },
    enabled: !!selectedBooking?.productId,
  })

  const scheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Booking scheduled" })
      setScheduleDialog(false)
      setSelectedBooking(null)
      queryClient.invalidateQueries({ queryKey: ["schedule-bookings"] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const changeDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  // Group bookings by slot
  const slotGroups: Record<string, any[]> = {}
  const unscheduled: any[] = []
  bookings?.bookings?.forEach((b: any) => {
    if (b.timeSlot) {
      const key = `${b.timeSlot.startTime}-${b.timeSlot.endTime}`
      if (!slotGroups[key]) slotGroups[key] = []
      slotGroups[key].push(b)
    } else {
      unscheduled.push(b)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        <div className="space-y-4">
          {/* Slot-based view */}
          {timeSlots?.map((slot: any) => {
            const key = `${slot.startTime}-${slot.endTime}`
            const slotBookings = slotGroups[key] || []
            return (
              <Card key={slot.id}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {slot.startTime} - {slot.endTime}
                    </span>
                    <Badge variant="outline">{slotBookings.length}/{slot.capacityTrucks} trucks</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  {slotBookings.length > 0 ? (
                    <div className="space-y-2">
                      {slotBookings.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between p-2 rounded border text-sm">
                          <div>
                            <Link href={`/bookings/${b.id}`} className="font-medium hover:underline">{b.bookingNo}</Link>
                            <span className="text-muted-foreground ml-2">{b.client?.name} - {b.product?.name} ({b.quantityRequested})</span>
                            {b.bayAllocations?.[0] && (
                              <span className="text-xs ml-2 text-primary">
                                <MapPin className="h-3 w-3 inline" /> {b.bayAllocations[0].bay.uniqueCode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColor(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                            {["SUBMITTED", "CLIENT_APPROVED"].includes(b.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedBooking(b); setScheduleDialog(true) }}
                              >
                                Schedule
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No bookings in this slot</p>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Unscheduled */}
          {unscheduled.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Unscheduled ({unscheduled.length})</CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3 space-y-2">
                {unscheduled.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div>
                      <Link href={`/bookings/${b.id}`} className="font-medium hover:underline">{b.bookingNo}</Link>
                      <span className="text-muted-foreground ml-2">{b.client?.name} - {b.product?.name} ({b.quantityRequested})</span>
                      {b.isBulk && <Badge variant="secondary" className="ml-2 text-xs">Bulk</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColor(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                      {["SUBMITTED", "CLIENT_APPROVED"].includes(b.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedBooking(b); setScheduleDialog(true) }}
                        >
                          Schedule
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Booking: {selectedBooking?.bookingNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <p>{selectedBooking?.client?.name} - {selectedBooking?.product?.name} ({selectedBooking?.quantityRequested})</p>
            </div>
            <div className="space-y-2">
              <Label>Time Slot</Label>
              <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                <SelectTrigger><SelectValue placeholder="Select slot" /></SelectTrigger>
                <SelectContent>
                  {timeSlots?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.startTime} - {s.endTime} ({s._count?.bookings || 0}/{s.capacityTrucks})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bay Allocation</Label>
              <Select value={selectedBay} onValueChange={setSelectedBay}>
                <SelectTrigger><SelectValue placeholder="Select bay" /></SelectTrigger>
                <SelectContent>
                  {bays?.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.gantry?.name} / {b.name} ({b.uniqueCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(false)}>Cancel</Button>
            <Button
              onClick={() => scheduleMutation.mutate({
                timeSlotId: selectedSlot || undefined,
                bayId: selectedBay || undefined,
              })}
              disabled={scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
