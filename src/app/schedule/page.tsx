"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { statusColor } from "@/lib/utils"
import { Calendar, ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import Link from "next/link"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { KpiCard, KpiCardSkeleton } from "@/components/dashboard/kpi-card"
import { SectionPanel } from "@/components/dashboard/section-panel"
import { HelpTooltip } from "@/components/ui/help-tooltip"

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
      setSelectedSlot("")
      setSelectedBay("")
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

  const slotGroups = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const unscheduledRows: any[] = []
    bookings?.bookings?.forEach((b: any) => {
      if (b.timeSlot) {
        const key = `${b.timeSlot.startTime}-${b.timeSlot.endTime}`
        if (!groups[key]) groups[key] = []
        groups[key].push(b)
      } else {
        unscheduledRows.push(b)
      }
    })
    return { groups, unscheduledRows }
  }, [bookings])

  const totalBookings = bookings?.bookings?.length ?? 0
  const scheduledCount = totalBookings - slotGroups.unscheduledRows.length

  return (
    <div className="space-y-4">
      <DashboardHeader title="Schedule Manager" subtitle="Slot-based planning and bay assignment" />

      <FilterBar
        left={
          <>
            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1 text-xs">
                <span>Date</span>
                <HelpTooltip description="What it is: Day shown in this schedule. Why it matters: All slots and bookings below use this date." />
              </Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => changeDate(-1)} className="h-9 w-9">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 w-[180px]"
                />
                <Button variant="outline" size="icon" onClick={() => changeDate(1)} className="h-9 w-9">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => <KpiCardSkeleton key={idx} />)
        ) : (
          <>
            <KpiCard title="Bookings" value={String(totalBookings)} tooltip="What it is: Total bookings for this date. Why it matters: Shows daily workload." />
            <KpiCard title="Scheduled" value={String(scheduledCount)} deltaTone="positive" tooltip="What it is: Bookings already assigned to slots. Why it matters: Higher means better planning coverage." />
            <KpiCard title="Unscheduled" value={String(slotGroups.unscheduledRows.length)} deltaTone={slotGroups.unscheduledRows.length > 0 ? "negative" : "neutral"} tooltip="What it is: Bookings without a slot. Why it matters: These need action to avoid delays." />
            <KpiCard title="Slots" value={String(timeSlots?.length ?? 0)} tooltip="What it is: Available slot windows. Why it matters: Defines daily scheduling capacity." />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {timeSlots?.map((slot: any) => {
            const key = `${slot.startTime}-${slot.endTime}`
            const slotBookings = slotGroups.groups[key] || []

            return (
              <SectionPanel
                key={slot.id}
                title={`${slot.startTime} - ${slot.endTime}`}
                action={<span className="inline-flex items-center gap-1"><Badge variant="outline" className="text-[11px]">{slotBookings.length}/{slot.capacityTrucks} trucks</Badge><HelpTooltip description="What it is: Filled trucks over slot capacity. Why it matters: Near-full slots may cause queueing." /></span>}
              >
                {slotBookings.length > 0 ? (
                  <div className="space-y-2">
                    {slotBookings.map((b: any) => (
                      <div key={b.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 text-[13px] md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <Link href={`/bookings/${b.id}`} className="font-medium text-slate-900 hover:underline">{b.bookingNo}</Link>
                          <p className="truncate text-xs text-slate-500">{b.client?.name} - {b.product?.name} ({b.quantityRequested})</p>
                          {b.bayAllocations?.[0] && (
                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700">
                              <MapPin className="h-3 w-3" /> {b.bayAllocations[0].bay.uniqueCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Badge className={statusColor(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                            <HelpTooltip description="What it is: Booking stage label. Why it matters: Tells you if this truck needs scheduling or follow-up." />
                          </span>
                          {["SUBMITTED", "CLIENT_APPROVED"].includes(b.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelectedBooking(b); setScheduleDialog(true) }}
                              className="h-8 text-xs"
                            >
                              Schedule
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No bookings in this slot</p>
                )}
              </SectionPanel>
            )
          })}

          {slotGroups.unscheduledRows.length > 0 && (
            <SectionPanel title={`Unscheduled (${slotGroups.unscheduledRows.length})`} collapsible>
              <div className="space-y-2">
                {slotGroups.unscheduledRows.map((b: any) => (
                  <div key={b.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 text-[13px] md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <Link href={`/bookings/${b.id}`} className="font-medium text-slate-900 hover:underline">{b.bookingNo}</Link>
                      <p className="truncate text-xs text-slate-500">{b.client?.name} - {b.product?.name} ({b.quantityRequested})</p>
                      {b.isBulk && <Badge variant="secondary" className="mt-1 text-[10px]">Bulk</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Badge className={statusColor(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                        <HelpTooltip description="What it is: Booking stage label. Why it matters: Use it to decide next step." />
                      </span>
                      {["SUBMITTED", "CLIENT_APPROVED"].includes(b.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedBooking(b); setScheduleDialog(true) }}
                          className="h-8 text-xs"
                        >
                          Schedule
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionPanel>
          )}
        </div>
      )}

      <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Booking: {selectedBooking?.bookingNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
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
