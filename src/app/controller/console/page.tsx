"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import {
  Radio, Truck, MapPin, Clock, AlertTriangle, CheckCircle, Lock,
  Wrench, RotateCcw, Zap, ArrowRight, Shield, Play, Pause, XCircle,
  ChevronRight, Timer, Target,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface BayData {
  id: string; name: string; uniqueCode: string; status: string;
  allowedMode: string; changeoverState: string;
  currentProduct: { id: string; name: string } | null;
  lastProduct: { id: string; name: string } | null;
  lockedByTrip: { id: string; truckNumber: string } | null;
  gantry: { id: string; name: string };
  scheduleBlocks: { id: string; status: string; startPlannedAt: string; endPlannedAt: string; truckTrip: { truckNumber: string } }[];
}

interface TripData {
  id: string; truckNumber: string; status: string; priorityClass: string;
  etaMinutes: number | null; etaSource: string | null; etaUpdatedAt: string | null;
  appointmentStart: string | null; appointmentEnd: string | null;
  readyForBayAt: string | null; queuePosition: number | null;
  predictedStartTime: string | null; riskFlags: any;
  lateToleranceMinutes: number;
  booking: { id: string; bookingNo: string; product: { id: string; name: string; category: string }; client: { name: string } };
}

interface PlanData {
  bayRecommendations: { truck_trip_id: string; suggested_bay_id: string; bay_current_product_id: string | null; changeover_state: string; reason_codes: string[]; confidence: number }[];
  queueResequence: { at_risk_trucks: { truck_trip_id: string; risk_flags: string[]; confidence: number }[]; resequencing: any[] };
  alerts: { type: string; message: string; truckTripId?: string; bayId?: string; confidence: number; reasonCodes: string[] }[];
  computedAt: string;
}

// ── Status Colors ────────────────────────────────────────────────────────────

const BAY_STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  IDLE: { bg: "bg-green-50", border: "border-green-400", text: "text-green-700" },
  OCCUPIED: { bg: "bg-red-50", border: "border-red-400", text: "text-red-700" },
  BLOCKED: { bg: "bg-gray-100", border: "border-gray-400", text: "text-gray-600" },
  MAINTENANCE: { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-700" },
}

const PRIORITY_STYLE: Record<string, string> = {
  APPOINTMENT: "bg-blue-100 text-blue-800",
  FCFS: "bg-gray-100 text-gray-700",
  RECLASSIFIED: "bg-amber-100 text-amber-800",
  BLOCKED: "bg-red-100 text-red-800",
}

const CHANGEOVER_LABEL: Record<string, string> = {
  NOT_ALLOWED: "No Changeover",
  NEEDS_CLEARANCE: "Needs Clearance",
  READY_FOR_CHANGEOVER: "Ready",
  IN_CHANGEOVER: "In Progress",
}

// ── Main Console ─────────────────────────────────────────────────────────────

export default function ControllerConsolePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedBay, setSelectedBay] = useState<BayData | null>(null)
  const [assignDialog, setAssignDialog] = useState<{ tripId: string; bayId: string; recId?: string } | null>(null)
  const [etaDialog, setEtaDialog] = useState<{ tripId: string; truckNumber: string } | null>(null)
  const [etaMinutes, setEtaMinutes] = useState("")
  const [etaSource, setEtaSource] = useState("MANUAL_HOURS_AWAY")
  const [reclassifyDialog, setReclassifyDialog] = useState<{ tripId: string; truckNumber: string } | null>(null)
  const [reclassifyClass, setReclassifyClass] = useState("FCFS")
  const [reclassifyReason, setReclassifyReason] = useState("")

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const { data: state, isLoading: stateLoading } = useQuery({
    queryKey: ["controller-state"],
    queryFn: async () => {
      const res = await fetch("/api/controller/state")
      if (!res.ok) throw new Error("Failed to fetch state")
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: plan, isLoading: planLoading, refetch: refetchPlan } = useQuery({
    queryKey: ["ai-plan"],
    queryFn: async () => {
      const res = await fetch("/api/ai/plan")
      if (!res.ok) throw new Error("Failed to fetch plan")
      return res.json() as Promise<PlanData>
    },
    refetchInterval: 30000,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const applyAssignment = useMutation({
    mutationFn: async (data: { truckTripId: string; bayId: string; aiRecommendationId?: string }) => {
      const res = await fetch("/api/controller/apply-assignment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Bay assignment applied" })
      setAssignDialog(null)
      queryClient.invalidateQueries({ queryKey: ["controller-state"] })
      refetchPlan()
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const updateEta = useMutation({
    mutationFn: async (data: { truckTripId: string; etaMinutes: number; etaSource: string }) => {
      const res = await fetch("/api/controller/update-eta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "ETA updated" })
      setEtaDialog(null)
      setEtaMinutes("")
      queryClient.invalidateQueries({ queryKey: ["controller-state"] })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const reclassify = useMutation({
    mutationFn: async (data: { truckTripId: string; newPriorityClass: string; reason: string }) => {
      const res = await fetch("/api/controller/reclassify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Truck reclassified" })
      setReclassifyDialog(null)
      setReclassifyReason("")
      queryClient.invalidateQueries({ queryKey: ["controller-state"] })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const bayAction = useMutation({
    mutationFn: async (data: { bayId: string; action: string; truckTripId?: string; reason?: string }) => {
      const res = await fetch("/api/controller/bay-action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Bay updated" })
      setSelectedBay(null)
      queryClient.invalidateQueries({ queryKey: ["controller-state"] })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  if (!session) return null

  const bays: BayData[] = state?.bays || []
  const readyQueue: TripData[] = state?.readyQueue || []
  const alerts = plan?.alerts || []
  const recommendations = plan?.bayRecommendations || []

  // Group bays by gantry
  const gantryGroups: Record<string, BayData[]> = {}
  for (const bay of bays) {
    const key = bay.gantry.name
    if (!gantryGroups[key]) gantryGroups[key] = []
    gantryGroups[key].push(bay)
  }

  // Group queue by priority
  const queueByPriority: Record<string, TripData[]> = { APPOINTMENT: [], FCFS: [], RECLASSIFIED: [], BLOCKED: [] }
  for (const trip of readyQueue) {
    const cls = trip.priorityClass || "FCFS"
    if (!queueByPriority[cls]) queueByPriority[cls] = []
    queueByPriority[cls].push(trip)
  }

  // Find recommendation for a trip
  const getRecForTrip = (tripId: string) => recommendations.find((r) => r.truck_trip_id === tripId)
  const getRecForBay = (bayId: string) => recommendations.find((r) => r.suggested_bay_id === bayId)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Traffic Controller Console</h1>
            <p className="text-sm text-muted-foreground">AI-Driven Bay Allocation &amp; Queue Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan?.computedAt && (
            <span className="text-xs text-muted-foreground">Plan: {new Date(plan.computedAt).toLocaleTimeString()}</span>
          )}
          <Button size="sm" variant="outline" onClick={() => refetchPlan()} disabled={planLoading}>
            <RotateCcw className={`h-3.5 w-3.5 mr-1 ${planLoading ? "animate-spin" : ""}`} /> Recompute
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* ── LEFT: Bay Grid ──────────────────────────────────────────────── */}
        <div className="xl:col-span-4 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bay Grid</h2>
          {Object.entries(gantryGroups).map(([gantryName, gantryBays]) => (
            <Card key={gantryName} className="shadow-sm">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">{gantryName}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {gantryBays.map((bay) => {
                    const style = BAY_STATUS_STYLE[bay.status] || BAY_STATUS_STYLE.IDLE
                    const rec = getRecForBay(bay.id)
                    const activeBlock = bay.scheduleBlocks?.find((b) => b.status === "ACTIVE" || b.status === "PLANNED")

                    return (
                      <button
                        key={bay.id}
                        onClick={() => setSelectedBay(bay)}
                        className={`text-left rounded-lg border-2 p-2 transition-all hover:shadow-md ${style.bg} ${style.border} ${
                          bay.status === "MAINTENANCE" ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(0,0,0,0.03)_6px,rgba(0,0,0,0.03)_12px)]" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">{bay.uniqueCode}</span>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${style.text}`}>{bay.status}</Badge>
                        </div>
                        {bay.currentProduct && (
                          <p className="text-[10px] text-gray-600">{bay.currentProduct.name}</p>
                        )}
                        {bay.changeoverState !== "NOT_ALLOWED" && (
                          <Badge className="text-[8px] px-1 py-0 bg-amber-100 text-amber-700 mt-1">
                            {CHANGEOVER_LABEL[bay.changeoverState]}
                          </Badge>
                        )}
                        {bay.lockedByTrip && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                            <Lock className="h-2.5 w-2.5" /> {bay.lockedByTrip.truckNumber}
                          </div>
                        )}
                        {activeBlock && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                            <Timer className="h-2.5 w-2.5" /> {activeBlock.truckTrip?.truckNumber}
                          </div>
                        )}
                        {rec && (
                          <div className="mt-1 p-1 bg-blue-100 rounded text-[9px] text-blue-700">
                            AI: Assign next ({(rec.confidence * 100).toFixed(0)}%)
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {bays.length === 0 && !stateLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">No bays found. Run seed to populate demo data.</p>
          )}
        </div>

        {/* ── CENTER: Ready Queue ─────────────────────────────────────────── */}
        <div className="xl:col-span-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ready Queue</h2>
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <Tabs defaultValue="APPOINTMENT">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-3 pt-2">
                  {(["APPOINTMENT", "FCFS", "RECLASSIFIED", "BLOCKED"] as const).map((cls) => (
                    <TabsTrigger key={cls} value={cls} className="text-xs data-[state=active]:shadow-sm">
                      {cls} ({queueByPriority[cls]?.length || 0})
                    </TabsTrigger>
                  ))}
                </TabsList>

                {(["APPOINTMENT", "FCFS", "RECLASSIFIED", "BLOCKED"] as const).map((cls) => (
                  <TabsContent key={cls} value={cls} className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
                    {(queueByPriority[cls] || []).map((trip) => {
                      const rec = getRecForTrip(trip.id)
                      const isAtRisk = plan?.queueResequence?.at_risk_trucks?.some((r) => r.truck_trip_id === trip.id)
                      const suggestedBay = rec ? bays.find((b) => b.id === rec.suggested_bay_id) : null

                      return (
                        <div key={trip.id} className={`border rounded-lg p-3 ${isAtRisk ? "border-red-300 bg-red-50/50" : ""}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-gray-500" />
                              <span className="font-mono font-medium text-sm">{trip.truckNumber}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_STYLE[trip.priorityClass]}`}>
                                {trip.priorityClass}
                              </Badge>
                            </div>
                            {isAtRisk && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          </div>

                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 mb-2">
                            <span>Product: <strong>{trip.booking.product.name}</strong></span>
                            <span>Client: {trip.booking.client.name}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ETA: {trip.etaMinutes != null ? `${trip.etaMinutes} min` : "N/A"}
                              {trip.etaSource && <span className="text-gray-400">({trip.etaSource.replace(/_/g, " ")})</span>}
                            </span>
                            {trip.appointmentStart && (
                              <span>Appt: {new Date(trip.appointmentStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {trip.appointmentEnd ? new Date(trip.appointmentEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                            )}
                            {trip.queuePosition != null && <span>Queue #: {trip.queuePosition}</span>}
                            {trip.predictedStartTime && <span>Predicted: {new Date(trip.predictedStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                          </div>

                          {/* AI Suggestion */}
                          {rec && suggestedBay && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs">
                                  <Zap className="inline h-3 w-3 text-blue-600 mr-1" />
                                  <span className="font-medium text-blue-700">AI suggests: {suggestedBay.uniqueCode}</span>
                                  <span className="text-blue-500 ml-1">({(rec.confidence * 100).toFixed(0)}%)</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {rec.reason_codes.map((rc) => (
                                  <span key={rc} className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">{rc.replace(/_/g, " ")}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Risk Flags */}
                          {trip.riskFlags && typeof trip.riskFlags === "object" && Object.keys(trip.riskFlags).length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {Object.entries(trip.riskFlags).filter(([, v]) => v).map(([flag]) => (
                                <Badge key={flag} variant="destructive" className="text-[9px] px-1.5 py-0">{flag.replace(/_/g, " ")}</Badge>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-1.5">
                            {rec && (
                              <Button size="sm" className="h-7 text-xs" onClick={() => setAssignDialog({ tripId: trip.id, bayId: rec.suggested_bay_id })}>
                                <Play className="h-3 w-3 mr-1" /> Apply
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEtaDialog({ tripId: trip.id, truckNumber: trip.truckNumber })}>
                              <Clock className="h-3 w-3 mr-1" /> ETA
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReclassifyDialog({ tripId: trip.id, truckNumber: trip.truckNumber })}>
                              <Target className="h-3 w-3 mr-1" /> Reclassify
                            </Button>
                          </div>
                        </div>
                      )
                    })}

                    {(!queueByPriority[cls] || queueByPriority[cls].length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-6">No trucks in {cls} queue</p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: AI Alerts ────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">AI Alerts</h2>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="shadow-sm">
              <CardContent className="pt-3 pb-2 px-3">
                <p className="text-xs text-muted-foreground">Ready Trucks</p>
                <p className="text-2xl font-bold">{readyQueue.length}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-3 pb-2 px-3">
                <p className="text-xs text-muted-foreground">Idle Bays</p>
                <p className="text-2xl font-bold">{bays.filter((b) => b.status === "IDLE").length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2 max-h-[400px] overflow-y-auto">
              {alerts.map((alert, i) => {
                const isRisk = alert.type.includes("risk")
                return (
                  <div key={i} className={`border rounded-lg p-2.5 ${isRisk ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isRisk ? "text-red-500" : "text-amber-500"}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{alert.message}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {alert.reasonCodes.map((rc) => (
                            <span key={rc} className="text-[8px] px-1 py-0.5 bg-white/50 rounded text-gray-600">{rc.replace(/_/g, " ")}</span>
                          ))}
                        </div>
                        <span className="text-[9px] text-gray-500">Confidence: {(alert.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    {alert.truckTripId && alert.bayId && (
                      <Button
                        size="sm"
                        className="h-6 text-[10px] mt-1.5 w-full"
                        onClick={() => setAssignDialog({ tripId: alert.truckTripId!, bayId: alert.bayId! })}
                      >
                        Apply Suggestion
                      </Button>
                    )}
                  </div>
                )
              })}

              {alerts.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No active alerts</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent AI Recommendations */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm">Recent AI Decisions</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1.5 max-h-[200px] overflow-y-auto">
              {(state?.recentRecommendations || []).slice(0, 5).map((rec: any) => (
                <div key={rec.id} className="flex items-center justify-between text-xs border-b pb-1.5">
                  <div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1">{rec.type}</Badge>
                    <span className="text-gray-500">{new Date(rec.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {rec.confidence && <span className="text-gray-600">{(rec.confidence * 100).toFixed(0)}%</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Bay Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!selectedBay} onOpenChange={() => setSelectedBay(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedBay && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBay.uniqueCode} - {selectedBay.name}</DialogTitle>
                <DialogDescription>
                  {selectedBay.gantry.name} | Mode: {selectedBay.allowedMode} | Status: {selectedBay.status}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Current Product</span>
                  <span className="font-medium">{selectedBay.currentProduct?.name || "None"}</span>
                  <span className="text-muted-foreground">Last Product</span>
                  <span className="font-medium">{selectedBay.lastProduct?.name || "None"}</span>
                  <span className="text-muted-foreground">Changeover</span>
                  <span className="font-medium">{CHANGEOVER_LABEL[selectedBay.changeoverState]}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedBay.status === "IDLE" && (
                    <Button size="sm" variant="outline" onClick={() => bayAction.mutate({ bayId: selectedBay.id, action: "maintenance" })}>
                      <Wrench className="h-3 w-3 mr-1" /> Set Maintenance
                    </Button>
                  )}
                  {selectedBay.status === "MAINTENANCE" && (
                    <Button size="sm" variant="outline" onClick={() => bayAction.mutate({ bayId: selectedBay.id, action: "end_maintenance" })}>
                      <CheckCircle className="h-3 w-3 mr-1" /> End Maintenance
                    </Button>
                  )}
                  {selectedBay.changeoverState === "NEEDS_CLEARANCE" && (
                    <Button size="sm" onClick={() => bayAction.mutate({ bayId: selectedBay.id, action: "set_ready_changeover" })}>
                      <Shield className="h-3 w-3 mr-1" /> Mark Ready for Changeover
                    </Button>
                  )}
                  {!selectedBay.lockedByTrip && selectedBay.status !== "MAINTENANCE" && (
                    <Button size="sm" variant="outline" onClick={() => bayAction.mutate({ bayId: selectedBay.id, action: "lock" })}>
                      <Lock className="h-3 w-3 mr-1" /> Lock
                    </Button>
                  )}
                  {selectedBay.lockedByTrip && (
                    <Button size="sm" variant="outline" onClick={() => bayAction.mutate({ bayId: selectedBay.id, action: "unlock" })}>
                      <Lock className="h-3 w-3 mr-1" /> Unlock
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Apply Assignment Dialog ───────────────────────────────────────── */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bay Assignment</DialogTitle>
            <DialogDescription>
              This will assign the truck to the selected bay and mark it as occupied.
            </DialogDescription>
          </DialogHeader>
          {assignDialog && (
            <div className="text-sm space-y-2">
              <p>Truck Trip: <strong>{readyQueue.find((t) => t.id === assignDialog.tripId)?.truckNumber || assignDialog.tripId}</strong></p>
              <p>Bay: <strong>{bays.find((b) => b.id === assignDialog.bayId)?.uniqueCode || assignDialog.bayId}</strong></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button onClick={() => assignDialog && applyAssignment.mutate({ truckTripId: assignDialog.tripId, bayId: assignDialog.bayId })} disabled={applyAssignment.isPending}>
              {applyAssignment.isPending ? "Applying..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ETA Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!etaDialog} onOpenChange={() => setEtaDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update ETA: {etaDialog?.truckNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>ETA (minutes)</Label>
              <div className="flex flex-wrap gap-2">
                {[30, 60, 120, 180, 240, 360].map((m) => (
                  <Button key={m} size="sm" variant={etaMinutes === String(m) ? "default" : "outline"} onClick={() => setEtaMinutes(String(m))}>
                    {m >= 60 ? `${m / 60}h` : `${m}m`}
                  </Button>
                ))}
              </div>
              <Input type="number" placeholder="Custom minutes" value={etaMinutes} onChange={(e) => setEtaMinutes(e.target.value)} className="mt-2" />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={etaSource} onValueChange={setEtaSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL_HOURS_AWAY">Manual Estimate</SelectItem>
                  <SelectItem value="LOCATION_SHARE">Location Share</SelectItem>
                  <SelectItem value="OPS_ESTIMATE">Ops Estimate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEtaDialog(null)}>Cancel</Button>
            <Button
              disabled={!etaMinutes || updateEta.isPending}
              onClick={() => etaDialog && updateEta.mutate({ truckTripId: etaDialog.tripId, etaMinutes: parseInt(etaMinutes), etaSource })}
            >
              {updateEta.isPending ? "Saving..." : "Update ETA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reclassify Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!reclassifyDialog} onOpenChange={() => setReclassifyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reclassify: {reclassifyDialog?.truckNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>New Priority Class</Label>
              <Select value={reclassifyClass} onValueChange={setReclassifyClass}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPOINTMENT">Appointment</SelectItem>
                  <SelectItem value="FCFS">FCFS</SelectItem>
                  <SelectItem value="RECLASSIFIED">Reclassified</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reason (required)</Label>
              <Input value={reclassifyReason} onChange={(e) => setReclassifyReason(e.target.value)} placeholder="Reason for reclassification..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReclassifyDialog(null)}>Cancel</Button>
            <Button
              disabled={!reclassifyReason || reclassify.isPending}
              onClick={() => reclassifyDialog && reclassify.mutate({ truckTripId: reclassifyDialog.tripId, newPriorityClass: reclassifyClass, reason: reclassifyReason })}
            >
              {reclassify.isPending ? "Saving..." : "Reclassify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
