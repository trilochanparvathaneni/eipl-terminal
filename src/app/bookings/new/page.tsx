"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { HelpTooltip } from "@/components/ui/help-tooltip"

export default function NewBookingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [date, setDate] = useState("")
  const [timeSlotId, setTimeSlotId] = useState("")
  const [transporterId, setTransporterId] = useState("")
  const [isBulk, setIsBulk] = useState(false)
  const [additionalRequests, setAdditionalRequests] = useState("")
  const [clientId, setClientId] = useState("")

  const isAdmin = session?.user?.role === "TERMINAL_ADMIN" || session?.user?.role === "SUPER_ADMIN"

  const { data: terminals } = useQuery({
    queryKey: ["terminals"],
    queryFn: async () => {
      const res = await fetch("/api/lookup/terminals")
      const data = await res.json()
      return data.terminals
    },
  })

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/lookup/products")
      const data = await res.json()
      return data.products
    },
  })

  const { data: transporters } = useQuery({
    queryKey: ["transporters"],
    queryFn: async () => {
      const res = await fetch("/api/lookup/transporters")
      const data = await res.json()
      return data.transporters
    },
  })

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/lookup/clients")
      const data = await res.json()
      return data.clients
    },
    enabled: isAdmin,
  })

  const terminalId = terminals?.[0]?.id || session?.user?.terminalId

  const { data: timeSlots } = useQuery({
    queryKey: ["timeslots", date, terminalId],
    queryFn: async () => {
      const res = await fetch(`/api/lookup/timeslots?date=${date}&terminalId=${terminalId}`)
      const data = await res.json()
      return data.timeSlots
    },
    enabled: !!date && !!terminalId,
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.fieldErrors ? JSON.stringify(err.error.fieldErrors) : err.error || "Failed to create booking")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({ title: "Booking created", description: `Booking ${data.bookingNo} submitted successfully.` })
      router.push(`/bookings/${data.id}`)
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      terminalId,
      productId,
      quantityRequested: parseFloat(quantity),
      date,
      timeSlotId: isBulk ? undefined : timeSlotId || undefined,
      transporterId: transporterId || undefined,
      isBulk,
      additionalRequests: additionalRequests || undefined,
      ...(isAdmin && clientId ? { clientId } : {}),
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-1.5">
            Create New Booking
            <HelpTooltip description="What it is: Form to request a dispatch booking. Why it matters: Correct details prevent later delays." />
          </CardTitle>
          <CardDescription>Fill in the details to create a dispatch booking</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">Client * <HelpTooltip description="What it is: Account requesting the load. Why it matters: Sets ownership and visibility." /></Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Product * <HelpTooltip description="What it is: Material to be dispatched. Why it matters: Drives slot and safety checks." /></Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.category}){p.isHazardous ? " - Hazardous" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Quantity * <HelpTooltip description="What it is: Requested amount. Why it matters: Affects bay time and planning." /></Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Date * <HelpTooltip description="What it is: Requested dispatch day. Why it matters: Loads available slots for that day." /></Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="bulk"
                checked={isBulk}
                onCheckedChange={(checked) => setIsBulk(checked as boolean)}
              />
              <Label htmlFor="bulk" className="text-sm font-normal">
                Bulk booking (slots allocated by operations)
              </Label>
              <HelpTooltip description="What it is: Ops assigns slot later. Why it matters: Use for flexible or large-volume requests." />
            </div>

            {!isBulk && date && (
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">Time Slot <HelpTooltip description="What it is: Preferred loading window. Why it matters: Helps reduce waiting time at gate." /></Label>
                <Select value={timeSlotId} onValueChange={setTimeSlotId}>
                  <SelectTrigger><SelectValue placeholder="Select preferred slot" /></SelectTrigger>
                  <SelectContent>
                    {timeSlots?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id} disabled={s._count?.bookings >= s.capacityTrucks}>
                        {s.startTime} - {s.endTime} ({s._count?.bookings || 0}/{s.capacityTrucks} trucks)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Transporter <HelpTooltip description="What it is: Carrier moving the truck. Why it matters: Assigns operational responsibility." /></Label>
              <Select value={transporterId} onValueChange={setTransporterId}>
                <SelectTrigger><SelectValue placeholder="Select transporter" /></SelectTrigger>
                <SelectContent>
                  {transporters?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Additional Requests <HelpTooltip description="What it is: Special notes for operations. Why it matters: Captures non-standard handling needs." /></Label>
              <Textarea
                value={additionalRequests}
                onChange={(e) => setAdditionalRequests(e.target.value)}
                placeholder="Any special requirements..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={mutation.isPending} title="Submit this booking request for processing.">
                {mutation.isPending ? "Submitting..." : "Submit Booking"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} title="Return without saving this form.">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
