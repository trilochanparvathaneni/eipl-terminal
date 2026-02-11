"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: {
    id: string
    bookingNo: string
    date: string
    terminalId: string
    productId: string
    client?: { name: string }
    product?: { name: string }
    quantityRequested: number
  }
}

export function ScheduleDialog({ open, onOpenChange, booking }: ScheduleDialogProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedSlot, setSelectedSlot] = useState("")
  const [selectedBay, setSelectedBay] = useState("")

  const bookingDate = booking.date ? new Date(booking.date).toISOString().split("T")[0] : ""
  const terminalId = booking.terminalId || session?.user?.terminalId

  const { data: timeSlots } = useQuery({
    queryKey: ["schedule-slots", bookingDate, terminalId],
    queryFn: async () => {
      const res = await fetch(`/api/lookup/timeslots?date=${bookingDate}&terminalId=${terminalId}`)
      const data = await res.json()
      return data.timeSlots
    },
    enabled: open && !!bookingDate && !!terminalId,
  })

  const { data: bays } = useQuery({
    queryKey: ["bays", booking.productId],
    queryFn: async () => {
      const res = await fetch(`/api/lookup/bays?productId=${booking.productId}`)
      const data = await res.json()
      return data.bays
    },
    enabled: open && !!booking.productId,
  })

  const scheduleMutation = useMutation({
    mutationFn: async (data: { timeSlotId?: string; bayId?: string }) => {
      const res = await fetch(`/api/bookings/${booking.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Booking scheduled successfully" })
      onOpenChange(false)
      setSelectedSlot("")
      setSelectedBay("")
      queryClient.invalidateQueries({ queryKey: ["booking", booking.id] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const handleSubmit = () => {
    scheduleMutation.mutate({
      timeSlotId: selectedSlot || undefined,
      bayId: selectedBay || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Booking: {booking.bookingNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {booking.client?.name} - {booking.product?.name} ({booking.quantityRequested})
          </div>
          <div className="space-y-2">
            <Label>Time Slot</Label>
            <Select value={selectedSlot} onValueChange={setSelectedSlot}>
              <SelectTrigger>
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.startTime} - {s.endTime} ({s.currentBookings ?? s._count?.bookings ?? 0}/{s.capacityTrucks})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bay Allocation</Label>
            <Select value={selectedBay} onValueChange={setSelectedBay}>
              <SelectTrigger>
                <SelectValue placeholder="Select bay" />
              </SelectTrigger>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scheduleMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={scheduleMutation.isPending}>
            {scheduleMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
