"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { statusColor, formatDateTime } from "@/lib/utils"
import { ShieldAlert, ClipboardCheck, AlertTriangle, Plus } from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { TOOLTIP_COPY, shortTip } from "@/lib/ui/tooltipCopy"

export default function HSEPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const role = (session?.user as any)?.role as string | undefined
  const canAccessHse =
    role === "SUPER_ADMIN" ||
    role === "TERMINAL_ADMIN" ||
    role === "HSE_OFFICER" ||
    role === "SECURITY" ||
    role === "AUDITOR" ||
    role === "SURVEYOR" ||
    role === "TRAFFIC_CONTROLLER"

  const [checklistDialog, setChecklistDialog] = useState(false)
  const [stopWorkDialog, setStopWorkDialog] = useState(false)
  const [incidentDialog, setIncidentDialog] = useState(false)
  const [bookingId, setBookingId] = useState("")
  const [ppe, setPpe] = useState(false)
  const [earthing, setEarthing] = useState(false)
  const [leakCheck, setLeakCheck] = useState(false)
  const [fireSystem, setFireSystem] = useState(false)
  const [checklistNotes, setChecklistNotes] = useState("")
  const [stopWorkReason, setStopWorkReason] = useState("")
  const [incidentDesc, setIncidentDesc] = useState("")
  const [incidentSeverity, setIncidentSeverity] = useState("LOW")

  const { data: checklists } = useQuery({
    queryKey: ["checklists"],
    enabled: canAccessHse,
    queryFn: async () => {
      const r = await fetch("/api/safety/checklists")
      const data = await r.json()
      return data.checklists ?? []
    },
  })

  const { data: stopWorks } = useQuery({
    queryKey: ["stop-works"],
    enabled: canAccessHse,
    queryFn: async () => {
      const r = await fetch("/api/safety/stop-work")
      const data = await r.json()
      return data.orders ?? []
    },
  })

  const { data: incidents } = useQuery({
    queryKey: ["incidents"],
    enabled: canAccessHse,
    queryFn: async () => {
      const r = await fetch("/api/incidents")
      const data = await r.json()
      return data.incidents ?? []
    },
  })

  const { data: bookings } = useQuery({
    queryKey: ["active-bookings-hse"],
    enabled: canAccessHse,
    queryFn: async () => { const r = await fetch("/api/bookings?limit=50"); return r.json() },
  })

  const createChecklist = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/safety/checklists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!r.ok) throw new Error((await r.json()).error)
      return r.json()
    },
    onSuccess: () => {
      toast({ title: "Checklist created" })
      setChecklistDialog(false)
      queryClient.invalidateQueries({ queryKey: ["checklists"] })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const createStopWork = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/safety/stop-work", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!r.ok) throw new Error((await r.json()).error)
      return r.json()
    },
    onSuccess: () => {
      toast({ title: "Stop Work Order issued" })
      setStopWorkDialog(false)
      setStopWorkReason("")
      queryClient.invalidateQueries({ queryKey: ["stop-works"] })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const resolveStopWork = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/safety/stop-work/${id}/resolve`, { method: "POST" })
      if (!r.ok) throw new Error((await r.json()).error)
      return r.json()
    },
    onSuccess: () => {
      toast({ title: "Stop Work resolved" })
      queryClient.invalidateQueries({ queryKey: ["stop-works"] })
    },
  })

  const createIncident = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!r.ok) throw new Error((await r.json()).error)
      return r.json()
    },
    onSuccess: () => {
      toast({ title: "Incident reported" })
      setIncidentDialog(false)
      setIncidentDesc("")
      queryClient.invalidateQueries({ queryKey: ["incidents"] })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const closeIncident = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/incidents/${id}/close`, { method: "POST" })
      if (!r.ok) throw new Error((await r.json()).error)
      return r.json()
    },
    onSuccess: () => {
      toast({ title: "Incident closed" })
      queryClient.invalidateQueries({ queryKey: ["incidents"] })
    },
  })

  const allPassed = ppe && earthing && leakCheck && fireSystem

  if (session && !canAccessHse) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not authorized</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You don&apos;t have access to HSE operations pages.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold inline-flex items-center gap-1.5">
          HSE Management
          <HelpTooltip description={TOOLTIP_COPY.hseManagement} />
        </h1>
      </div>

      <Tabs defaultValue="checklists">
        <TabsList>
          <TabsTrigger value="checklists"><span className="inline-flex items-center gap-1">Safety Checklists <HelpTooltip description={TOOLTIP_COPY.safetyChecklists} /></span></TabsTrigger>
          <TabsTrigger value="stopwork"><span className="inline-flex items-center gap-1">Stop Work Orders <HelpTooltip description={TOOLTIP_COPY.stopWorkOrders} /></span></TabsTrigger>
          <TabsTrigger value="incidents"><span className="inline-flex items-center gap-1">Incidents <HelpTooltip description={TOOLTIP_COPY.incidents} /></span></TabsTrigger>
        </TabsList>

        <TabsContent value="checklists" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setChecklistDialog(true)} title="Create a new safety checklist for a booking."><Plus className="h-4 w-4 mr-2" /> New Checklist</Button>
          </div>
          {checklists?.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Booking: {c.booking?.bookingNo || c.bookingId}</p>
                  <p className="text-xs text-muted-foreground">By {c.createdBy?.name} on {formatDateTime(c.createdAt)}</p>
                </div>
                <span className="inline-flex items-center gap-1">
                  <Badge className={statusColor(c.status)}>{c.status}</Badge>
                  <HelpTooltip description={shortTip("Checklist result. Failed items require corrective action before loading.")} />
                </span>
              </CardContent>
            </Card>
          ))}
          {(!checklists || checklists.length === 0) && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No checklists</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="stopwork" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="destructive" onClick={() => setStopWorkDialog(true)} title="Issue a safety hold to stop operations on a booking."><ShieldAlert className="h-4 w-4 mr-2" /> Issue Stop Work</Button>
          </div>
          {stopWorks?.map((sw: any) => (
            <Card key={sw.id} className={sw.active ? "border-destructive" : ""}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{sw.reason}</p>
                  <p className="text-xs text-muted-foreground">Booking: {sw.booking?.bookingNo || sw.bookingId} | By {sw.issuedBy?.name} | {formatDateTime(sw.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Badge className={sw.active ? "bg-red-200 text-red-800" : "bg-green-100 text-green-700"}>
                      {sw.active ? "ACTIVE" : "RESOLVED"}
                    </Badge>
                    <HelpTooltip description={shortTip("Stop-work status. Active orders block operations until resolved.")} />
                  </span>
                  {sw.active && (
                    <Button size="sm" variant="outline" onClick={() => resolveStopWork.mutate(sw.id)}>Resolve</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!stopWorks || stopWorks.length === 0) && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No stop work orders</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setIncidentDialog(true)} title="Log a safety incident with severity and description."><AlertTriangle className="h-4 w-4 mr-2" /> Report Incident</Button>
          </div>
          {incidents?.map((inc: any) => (
            <Card key={inc.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{inc.description}</p>
                  <p className="text-xs text-muted-foreground">By {inc.reportedBy?.name} | {formatDateTime(inc.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Badge className={statusColor(inc.severity)}>{inc.severity}</Badge>
                    <HelpTooltip description={shortTip("Incident impact level. High severity incidents should be handled first.")} />
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Badge className={statusColor(inc.status)}>{inc.status}</Badge>
                    <HelpTooltip description={shortTip("Incident workflow state. Open items need follow-up and closure.")} />
                  </span>
                  {inc.status === "OPEN" && (
                    <Button size="sm" variant="outline" onClick={() => closeIncident.mutate(inc.id)}>Close</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!incidents || incidents.length === 0) && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No incidents</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Checklist Dialog */}
      <Dialog open={checklistDialog} onOpenChange={setChecklistDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Safety Checklist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Booking <HelpTooltip description={shortTip("Booking being inspected. Links checklist to the correct trip.")} /></Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={bookingId} onChange={(e) => setBookingId(e.target.value)} required>
                <option value="">Select booking</option>
                {bookings?.bookings?.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.bookingNo} - {b.product?.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium inline-flex items-center gap-1">Checklist Items: <HelpTooltip description={shortTip("Required safety checks. Missing items can fail compliance.")} /></p>
              <div className="flex items-center gap-2"><Checkbox checked={ppe} onCheckedChange={(c) => setPpe(c as boolean)} /><Label className="font-normal">PPE Verified</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={earthing} onCheckedChange={(c) => setEarthing(c as boolean)} /><Label className="font-normal">Earthing Connected</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={leakCheck} onCheckedChange={(c) => setLeakCheck(c as boolean)} /><Label className="font-normal">Leak Check Passed</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={fireSystem} onCheckedChange={(c) => setFireSystem(c as boolean)} /><Label className="font-normal">Fire System Ready</Label></div>
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Additional Notes <HelpTooltip description={shortTip("Extra context for audit trail and pass/fail decisions.")} /></Label>
              <Textarea value={checklistNotes} onChange={(e) => setChecklistNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChecklistDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createChecklist.mutate({
                bookingId,
                checklistJson: { ppe, earthing, leakCheck, fireSystemReadiness: fireSystem, additionalNotes: checklistNotes },
                status: allPassed ? "PASSED" : "FAILED",
              })}
              disabled={!bookingId || createChecklist.isPending}
            >
              Submit ({allPassed ? "PASS" : "FAIL"})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop Work Dialog */}
      <Dialog open={stopWorkDialog} onOpenChange={setStopWorkDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Stop Work Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Booking <HelpTooltip description={shortTip("Booking to be halted. Ensures stop-work targets the right operation.")} /></Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={bookingId} onChange={(e) => setBookingId(e.target.value)} required>
                <option value="">Select booking</option>
                {bookings?.bookings?.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.bookingNo} - {b.product?.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Reason * <HelpTooltip description={shortTip("Safety reason for hold. Required for compliance and corrective action.")} /></Label>
              <Textarea value={stopWorkReason} onChange={(e) => setStopWorkReason(e.target.value)} placeholder="Describe the safety concern..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopWorkDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => createStopWork.mutate({ bookingId, reason: stopWorkReason })}
              disabled={!bookingId || !stopWorkReason || createStopWork.isPending}
            >
              Issue Stop Work
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident Dialog */}
      <Dialog open={incidentDialog} onOpenChange={setIncidentDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Severity <HelpTooltip description={shortTip("Incident impact level. Guides response priority.")} /></Label>
              <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MED">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Description * <HelpTooltip description={shortTip("Incident details. Enables proper investigation and closure.")} /></Label>
              <Textarea value={incidentDesc} onChange={(e) => setIncidentDesc(e.target.value)} placeholder="Describe the incident..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createIncident.mutate({
                terminalId: session?.user?.terminalId,
                severity: incidentSeverity,
                description: incidentDesc,
              })}
              disabled={!incidentDesc || createIncident.isPending}
            >
              Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
