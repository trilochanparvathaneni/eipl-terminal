"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { normalizeArmsPayload, normalizeTripsPayload } from "@/lib/yard-console"
import {
  Radio, Truck, AlertTriangle, CheckCircle, Lock, Wrench,
  RotateCcw, ArrowRight, Shield, XCircle, Fuel, Zap,
  FileUp, RefreshCw, CircleDot, Layers, Ban, Timer,
} from "lucide-react"

// ── Product Color Map ─────────────────────────────────────────────────────

const PRODUCT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Methanol:   { bg: "bg-violet-100",  text: "text-violet-800",  border: "border-violet-300", dot: "bg-violet-500" },
  HSD:        { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300",  dot: "bg-amber-500" },
  LDO:        { bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-300", dot: "bg-orange-500" },
  MS:         { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-300",   dot: "bg-blue-500" },
  ACN:        { bg: "bg-teal-100",    text: "text-teal-800",    border: "border-teal-300",   dot: "bg-teal-500" },
  VAM:        { bg: "bg-pink-100",    text: "text-pink-800",    border: "border-pink-300",   dot: "bg-pink-500" },
  LPG:        { bg: "bg-red-100",     text: "text-red-800",     border: "border-red-300",    dot: "bg-red-500" },
  Acetone:    { bg: "bg-indigo-100",  text: "text-indigo-800",  border: "border-indigo-300", dot: "bg-indigo-500" },
  "N-Hexane": { bg: "bg-lime-100",    text: "text-lime-800",    border: "border-lime-300",   dot: "bg-lime-500" },
}

const EMPTY_COLOR = { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", dot: "bg-gray-400" }

function getProductColor(name: string | null | undefined) {
  if (!name) return EMPTY_COLOR
  return PRODUCT_COLORS[name] || { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", dot: "bg-slate-500" }
}

// ── Arm / Bay Status Styles ───────────────────────────────────────────────

const ARM_STATUS_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  IDLE:        { bg: "bg-gray-50",    border: "border-gray-300",    text: "text-gray-600",    label: "Idle" },
  OCCUPIED:    { bg: "bg-blue-50",    border: "border-blue-400",    text: "text-blue-700",    label: "Occupied" },
  BLOCKED:     { bg: "bg-red-50",     border: "border-red-400",     text: "text-red-700",     label: "Blocked" },
  MAINTENANCE: { bg: "bg-orange-50",  border: "border-orange-400",  text: "text-orange-700",  label: "Maintenance" },
}

const CHANGEOVER_STYLE: Record<string, { className: string; label: string }> = {
  NOT_ALLOWED:          { className: "", label: "" },
  NEEDS_CLEARANCE:      { className: "bg-red-100 text-red-700 border-red-200", label: "Needs Clearance" },
  READY_FOR_CHANGEOVER: { className: "bg-amber-100 text-amber-700 border-amber-200", label: "Ready for C/O" },
  IN_CHANGEOVER:        { className: "bg-purple-100 text-purple-700 border-purple-200", label: "In C/O" },
}

const PRIORITY_STYLE: Record<string, string> = {
  APPOINTMENT:  "bg-blue-100 text-blue-800",
  FCFS:         "bg-gray-100 text-gray-700",
  RECLASSIFIED: "bg-amber-100 text-amber-800",
  BLOCKED:      "bg-red-100 text-red-800",
}

const BAY_STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  IDLE:        { bg: "bg-green-50",   border: "border-green-300",   text: "text-green-700" },
  OCCUPIED:    { bg: "bg-blue-50",    border: "border-blue-300",    text: "text-blue-700" },
  BLOCKED:     { bg: "bg-red-50",     border: "border-red-300",     text: "text-red-700" },
  MAINTENANCE: { bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700" },
}

// ── Types ─────────────────────────────────────────────────────────────────

interface LoadingArmData {
  id: string
  armNo: number
  name: string | null
  status: string
  changeoverState: string
  currentProductId: string | null
  lastProductId: string | null
  lockedByTripId: string | null
  notes: string | null
  currentProduct: { id: string; name: string } | null
  lastProduct: { id: string; name: string } | null
  bay: {
    id: string
    name: string
    uniqueCode: string
    status: string
    changeoverState: string
    gantry: { id: string; name: string }
  }
}

interface TripData {
  id: string
  truckNumber: string
  status: string
  custodyStage: string
  priorityClass: string
  etaMinutes: number | null
  queuePosition: number | null
  bookingId: string
  booking: {
    id: string
    bookingNo: string
    quantityRequested: number
    productId: string
    product: { id: string; name: string; category: string }
    client: { name: string }
  }
  complianceGates?: {
    id: string
    gateType: string
    status: string
    reason: string | null
  }[]
}

// ── Grouped Structure Types ───────────────────────────────────────────────

interface ArmCard {
  arm: LoadingArmData
}

interface BayGroup {
  bayId: string
  bayName: string
  bayCode: string
  bayStatus: string
  arms: LoadingArmData[]
}

interface GantryGroup {
  gantryId: string
  gantryName: string
  bays: BayGroup[]
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function YardConsolePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [assignDialog, setAssignDialog] = useState<{
    tripId: string
    truckNumber: string
    productId: string
    productName: string
    bookingId: string
    quantity: number
  } | null>(null)
  const [selectedBayId, setSelectedBayId] = useState("")
  const [selectedArmId, setSelectedArmId] = useState("")

  // ── Data Fetching ─────────────────────────────────────────────────────

  const { data: armsData, isLoading: armsLoading } = useQuery({
    queryKey: ["loading-arms"],
    queryFn: async () => {
      const res = await fetch("/api/loading-arms")
      if (!res.ok) throw new Error("Failed to fetch loading arms")
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: readyTripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ["ready-queue-trips"],
    queryFn: async () => {
      const res = await fetch("/api/truck-trips?custodyStage=READY_FOR_BAY")
      if (!res.ok) throw new Error("Failed to fetch ready queue")
      return res.json()
    },
    refetchInterval: 10000,
  })

  const { data: blockedTripsData } = useQuery({
    queryKey: ["blocked-trips"],
    queryFn: async () => {
      const res = await fetch("/api/truck-trips?priorityClass=BLOCKED")
      if (!res.ok) throw new Error("Failed to fetch blocked trips")
      return res.json()
    },
    refetchInterval: 20000,
  })

  // ── Arm Assignment Mutation ───────────────────────────────────────────

  const assignArm = useMutation({
    mutationFn: async (data: { bookingId: string; bayId: string; armId: string }) => {
      const res = await fetch(`/api/bookings/${data.bookingId}/assign-arm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bayId: data.bayId, armId: data.armId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to assign arm")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Arm assigned", description: "Truck has been assigned to the loading arm." })
      setAssignDialog(null)
      setSelectedBayId("")
      setSelectedArmId("")
      queryClient.invalidateQueries({ queryKey: ["loading-arms"] })
      queryClient.invalidateQueries({ queryKey: ["ready-queue-trips"] })
      queryClient.invalidateQueries({ queryKey: ["blocked-trips"] })
    },
    onError: (err: Error) => {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" })
    },
  })

  // ── Build Grouped Data ────────────────────────────────────────────────

  const allArms: LoadingArmData[] = normalizeArmsPayload<LoadingArmData>(armsData)
  const readyTrips: TripData[] = normalizeTripsPayload<TripData>(readyTripsData)
  const blockedTrips: TripData[] = normalizeTripsPayload<TripData>(blockedTripsData)

  const gantryGroups: GantryGroup[] = useMemo(() => {
    const gantryMap = new Map<string, GantryGroup>()

    for (const arm of allArms) {
      const gantryId = arm.bay.gantry.id
      const gantryName = arm.bay.gantry.name

      if (!gantryMap.has(gantryId)) {
        gantryMap.set(gantryId, { gantryId, gantryName, bays: [] })
      }
      const gantry = gantryMap.get(gantryId)!

      let bay = gantry.bays.find((b) => b.bayId === arm.bay.id)
      if (!bay) {
        bay = {
          bayId: arm.bay.id,
          bayName: arm.bay.name,
          bayCode: arm.bay.uniqueCode,
          bayStatus: arm.bay.status,
          arms: [],
        }
        gantry.bays.push(bay)
      }
      bay.arms.push(arm)
    }

    // Sort arms within each bay by armNo
    for (const gantry of Array.from(gantryMap.values())) {
      gantry.bays.sort((a: BayGroup, b: BayGroup) => a.bayCode.localeCompare(b.bayCode))
      for (const bay of gantry.bays) {
        bay.arms.sort((a: LoadingArmData, b: LoadingArmData) => a.armNo - b.armNo)
      }
    }

    return Array.from(gantryMap.values()).sort((a: GantryGroup, b: GantryGroup) => a.gantryName.localeCompare(b.gantryName))
  }, [allArms])

  // ── Compute suggested arms for a trip ─────────────────────────────────

  function getSuggestedArms(trip: TripData): LoadingArmData[] {
    const tripProductId = trip.booking.productId || trip.booking.product?.id
    return allArms.filter((arm) => {
      // Arm must be IDLE (not occupied, blocked, or maintenance)
      if (arm.status !== "IDLE") return false
      // Either the arm has the same product loaded...
      if (arm.currentProductId === tripProductId) return true
      // ...or the arm is empty and ready for changeover
      if (!arm.currentProductId && (arm.changeoverState === "READY_FOR_CHANGEOVER" || arm.changeoverState === "NOT_ALLOWED")) return true
      return false
    })
  }

  // ── Get matching arms for assignment dialog ───────────────────────────

  const matchingArmsForDialog = useMemo(() => {
    if (!assignDialog) return []
    const tripProductId = assignDialog.productId
    return allArms.filter((arm) => {
      if (arm.status === "BLOCKED" || arm.status === "MAINTENANCE") return false
      if (arm.currentProductId === tripProductId) return true
      if (!arm.currentProductId && arm.changeoverState === "READY_FOR_CHANGEOVER") return true
      if (!arm.currentProductId && arm.changeoverState === "NOT_ALLOWED") return true
      // Also show occupied arms of same product
      if (arm.status === "IDLE" && !arm.currentProductId) return true
      return false
    })
  }, [assignDialog, allArms])

  // Check for product mismatch warning
  function hasProductMismatch(arm: LoadingArmData, productId: string): boolean {
    return !!arm.currentProductId && arm.currentProductId !== productId
  }

  // ── Get blocking reasons ──────────────────────────────────────────────

  function getBlockReasons(trip: TripData): string[] {
    const reasons: string[] = []
    if (trip.complianceGates) {
      for (const gate of trip.complianceGates) {
        if (gate.status === "FAIL" || gate.status === "BLOCKED") {
          reasons.push(gate.reason || `${gate.gateType} - ${gate.status}`)
        }
      }
    }
    if (reasons.length === 0 && trip.priorityClass === "BLOCKED") {
      reasons.push("Blocked by traffic controller")
    }
    return reasons
  }

  // ── Handle arm assignment ─────────────────────────────────────────────

  function handleAssign() {
    if (!assignDialog || !selectedArmId) return
    const arm = allArms.find((a) => a.id === selectedArmId)
    if (!arm) return
    assignArm.mutate({
      bookingId: assignDialog.bookingId,
      bayId: arm.bay.id,
      armId: selectedArmId,
    })
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  const idleArms = allArms.filter((a) => a.status === "IDLE").length
  const occupiedArms = allArms.filter((a) => a.status === "OCCUPIED").length
  const blockedArms = allArms.filter((a) => a.status === "BLOCKED").length
  const maintenanceArms = allArms.filter((a) => a.status === "MAINTENANCE").length

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold inline-flex items-center gap-1.5">
              Yard Console
              <HelpTooltip description="What it is: Arm-level control board. Why it matters: Assign trucks to the right arm faster and safer." />
            </h1>
            <p className="text-sm text-muted-foreground">
              Arm-level bay management and truck queue assignment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground mr-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Idle: {idleArms}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Occupied: {occupiedArms}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Blocked: {blockedArms}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Maint: {maintenanceArms}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["loading-arms"] })
              queryClient.invalidateQueries({ queryKey: ["ready-queue-trips"] })
              queryClient.invalidateQueries({ queryKey: ["blocked-trips"] })
            }}
            title="Refresh bays, ready queue, and blocked trips."
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── LEFT PANEL: Gantry / Bay / Arm Grid ──────────────────────── */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4" /> Gantry / Bay / Arm Grid
            <HelpTooltip description="What it is: Physical loading layout by gantry, bay, and arm. Why it matters: Shows where capacity is available." />
          </h2>

          {armsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}

          {!armsLoading && gantryGroups.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Fuel className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No loading arms configured. Run seed to populate data.</p>
              </CardContent>
            </Card>
          )}

          {gantryGroups.map((gantry) => (
            <Card key={gantry.gantryId} className="shadow-sm">
              <CardHeader className="py-2 px-3 border-b bg-muted/30">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CircleDot className="h-4 w-4 text-primary" />
                  {gantry.gantryName}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {gantry.bays.length} bays / {gantry.bays.reduce((s, b) => s + b.arms.length, 0)} arms
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-3 space-y-3">
                {gantry.bays.map((bay) => {
                  const bayStyle = BAY_STATUS_STYLE[bay.bayStatus] || BAY_STATUS_STYLE.IDLE
                  return (
                    <div key={bay.bayId} className={`rounded-lg border-2 ${bayStyle.border} ${bayStyle.bg} p-2`}>
                      {/* Bay Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{bay.bayCode}</span>
                          <span className="text-[10px] text-muted-foreground">{bay.bayName}</span>
                        </div>
                        <span className="inline-flex items-center gap-1">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${bayStyle.text}`}>
                            {bay.bayStatus}
                          </Badge>
                          <HelpTooltip description="What it is: Bay status. Why it matters: Use available bays first and avoid blocked bays." />
                        </span>
                      </div>

                      {/* Arms Grid */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {bay.arms.map((arm) => {
                          const armStyle = ARM_STATUS_STYLE[arm.status] || ARM_STATUS_STYLE.IDLE
                          const prodColor = getProductColor(arm.currentProduct?.name)
                          const changeover = CHANGEOVER_STYLE[arm.changeoverState]

                          return (
                            <div
                              key={arm.id}
                              className={`rounded-md border ${armStyle.border} ${armStyle.bg} p-1.5 transition-all hover:shadow-sm`}
                            >
                              {/* Arm Number & Status */}
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-[11px]">Arm {arm.armNo}</span>
                                <span className={`w-2 h-2 rounded-full ${
                                  arm.status === "IDLE" ? "bg-gray-400" :
                                  arm.status === "OCCUPIED" ? "bg-blue-500" :
                                  arm.status === "BLOCKED" ? "bg-red-500" :
                                  "bg-orange-500"
                                }`} />
                              </div>

                              {/* Product */}
                              {arm.currentProduct ? (
                                <div className={`rounded px-1 py-0.5 text-[9px] font-medium ${prodColor.bg} ${prodColor.text} truncate`}>
                                  {arm.currentProduct.name}
                                </div>
                              ) : (
                                <div className="text-[9px] text-muted-foreground italic px-1">EMPTY</div>
                              )}

                              {/* Status Badge */}
                              <span className="inline-flex items-center gap-1">
                                <Badge variant="outline" className={`text-[8px] px-1 py-0 mt-1 w-full justify-center ${armStyle.text}`}>
                                  {armStyle.label}
                                </Badge>
                                <HelpTooltip description="What it is: Arm availability state. Why it matters: Confirms if this arm can be assigned." />
                              </span>

                              {/* Changeover Badge */}
                              {arm.changeoverState !== "NOT_ALLOWED" && changeover?.label && (
                                <Badge className={`text-[7px] px-1 py-0 mt-0.5 w-full justify-center ${changeover.className}`}>
                                  {changeover.label}
                                </Badge>
                              )}

                              {/* Lock indicator */}
                              {arm.lockedByTripId && (
                                <div className="flex items-center gap-0.5 text-[8px] text-gray-500 mt-0.5">
                                  <Lock className="h-2 w-2" /> Locked
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}

          {/* Product Color Legend */}
          {gantryGroups.length > 0 && (
            <Card className="shadow-sm">
              <CardContent className="py-2 px-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Product Colors</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(PRODUCT_COLORS).map(([name, color]) => (
                    <div key={name} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${color.bg} ${color.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                      {name}
                    </div>
                  ))}
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-gray-50 text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    Empty
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── CENTER PANEL: Ready Queue ─────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Truck className="h-4 w-4" /> Ready Queue
            <Badge variant="outline" className="ml-1 text-[10px]">{readyTrips.length}</Badge>
            <HelpTooltip description="What it is: Trucks cleared and waiting for arm assignment. Why it matters: This is the live workload queue." />
          </h2>

          {tripsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}

          {!tripsLoading && readyTrips.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No trucks waiting for bay assignment</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {readyTrips.map((trip) => {
              const prodColor = getProductColor(trip.booking.product?.name)
              const suggestedArms = getSuggestedArms(trip)

              return (
                <Card key={trip.id} className="shadow-sm">
                  <CardContent className="p-3">
                    {/* Trip Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-gray-500" />
                        <span className="font-mono font-bold text-sm">{trip.truckNumber}</span>
                        <span className="inline-flex items-center gap-1">
                          <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_STYLE[trip.priorityClass] || PRIORITY_STYLE.FCFS}`}>
                            {trip.priorityClass}
                          </Badge>
                          <HelpTooltip description="What it is: Priority level for dispatch. Why it matters: Higher priority should be assigned sooner." />
                        </span>
                      </div>
                      {trip.queuePosition != null && (
                        <Badge variant="outline" className="text-[10px]">
                          #{trip.queuePosition}
                        </Badge>
                      )}
                    </div>

                    {/* Trip Details */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${prodColor.dot}`} />
                        <strong className={prodColor.text}>{trip.booking.product?.name || "Unknown"}</strong>
                      </div>
                      <span>Qty: {trip.booking.quantityRequested} KL</span>
                      <span>Client: {trip.booking.client?.name}</span>
                      <span className="font-mono text-[10px]">#{trip.booking.bookingNo}</span>
                    </div>

                    {/* Suggested Arms */}
                    {suggestedArms.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                          <Zap className="h-3 w-3 text-blue-500" /> Suggested Arms:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {suggestedArms.slice(0, 6).map((arm) => {
                            const armProdColor = getProductColor(arm.currentProduct?.name)
                            return (
                              <Badge
                                key={arm.id}
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${armProdColor.border} ${armProdColor.text} cursor-pointer hover:shadow-sm`}
                                onClick={() => {
                                  setAssignDialog({
                                    tripId: trip.id,
                                    truckNumber: trip.truckNumber,
                                    productId: trip.booking.productId || trip.booking.product?.id,
                                    productName: trip.booking.product?.name || "Unknown",
                                    bookingId: trip.bookingId || trip.booking.id,
                                    quantity: trip.booking.quantityRequested,
                                  })
                                  setSelectedArmId(arm.id)
                                  setSelectedBayId(arm.bay.id)
                                }}
                              >
                                {arm.bay.uniqueCode}-A{arm.armNo}
                                {arm.currentProduct ? ` (${arm.currentProduct.name})` : " (Empty)"}
                              </Badge>
                            )
                          })}
                          {suggestedArms.length > 6 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              +{suggestedArms.length - 6} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {suggestedArms.length === 0 && (
                      <div className="mb-2 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        No matching arms available. All arms occupied or different product.
                      </div>
                    )}

                    {/* Assign Button */}
                    <Button
                      size="sm"
                      className="h-7 text-xs w-full"
                      title="Open assignment dialog to choose bay and arm for this truck."
                      onClick={() => {
                        setAssignDialog({
                          tripId: trip.id,
                          truckNumber: trip.truckNumber,
                          productId: trip.booking.productId || trip.booking.product?.id,
                          productName: trip.booking.product?.name || "Unknown",
                          bookingId: trip.bookingId || trip.booking.id,
                          quantity: trip.booking.quantityRequested,
                        })
                        setSelectedArmId("")
                        setSelectedBayId("")
                      }}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" /> Assign to Arm
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT PANEL: Compliance Blocks ────────────────────────────── */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Shield className="h-4 w-4" /> Compliance Blocks
            <Badge variant="outline" className="ml-1 text-[10px] border-red-300 text-red-600">
              {blockedTrips.length}
            </Badge>
            <HelpTooltip description="What it is: Trips blocked by compliance checks. Why it matters: Must be resolved before loading." />
          </h2>

          {blockedTrips.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No compliance blocks</p>
                <p className="text-xs text-muted-foreground mt-1">All trucks are cleared</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {blockedTrips.map((trip) => {
              const prodColor = getProductColor(trip.booking.product?.name)
              const blockReasons = getBlockReasons(trip)

              return (
                <Card key={trip.id} className="shadow-sm border-red-200 bg-red-50/30">
                  <CardContent className="p-3">
                    {/* Trip Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Ban className="h-4 w-4 text-red-500" />
                        <span className="font-mono font-bold text-sm">{trip.truckNumber}</span>
                      </div>
                      <span className="inline-flex items-center gap-1">
                        <Badge className="bg-red-100 text-red-800 text-[10px]">BLOCKED</Badge>
                        <HelpTooltip description="What it is: Hard stop status. Why it matters: This truck cannot proceed until issues are cleared." />
                      </span>
                    </div>

                    {/* Product Info */}
                    <div className="text-xs text-gray-600 mb-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={`w-2 h-2 rounded-full ${prodColor.dot}`} />
                        <strong className={prodColor.text}>{trip.booking.product?.name}</strong>
                        <span className="text-muted-foreground ml-1">| {trip.booking.client?.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">#{trip.booking.bookingNo}</span>
                    </div>

                    {/* Block Reasons */}
                    <div className="space-y-1 mb-3">
                      <p className="text-[10px] text-red-700 font-semibold uppercase tracking-wider">Block Reasons:</p>
                      {blockReasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-1.5 p-1.5 bg-red-100 border border-red-200 rounded text-[10px] text-red-800">
                          <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{reason}</span>
                        </div>
                      ))}
                      {blockReasons.length === 0 && (
                        <div className="p-1.5 bg-red-100 border border-red-200 rounded text-[10px] text-red-800">
                          No specific reason recorded. Check compliance gates.
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                        title="Open booking document page to upload missing compliance files."
                        onClick={() => {
                          window.open(`/client/documents?bookingId=${trip.bookingId || trip.booking.id}`, "_blank")
                        }}
                      >
                        <FileUp className="h-3 w-3 mr-1" /> Upload Docs
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1 border-green-200 text-green-700 hover:bg-green-50"
                        title="Run compliance checks again after documents or data are updated."
                        onClick={() => {
                          toast({ title: "Re-evaluation requested", description: `Compliance check queued for ${trip.truckNumber}` })
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Re-evaluate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Assign to Arm Dialog ───────────────────────────────────────── */}
      <Dialog open={!!assignDialog} onOpenChange={() => { setAssignDialog(null); setSelectedArmId(""); setSelectedBayId("") }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Assign to Loading Arm
            </DialogTitle>
            <DialogDescription>
              {assignDialog && (
                <>
                  Truck <strong>{assignDialog.truckNumber}</strong> needs{" "}
                  <strong>{assignDialog.productName}</strong> ({assignDialog.quantity} KL)
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {assignDialog && (
            <div className="space-y-4">
              {/* Select Arm */}
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1">
                  <span>Select Loading Arm *</span>
                  <HelpTooltip description="What it is: Exact arm for this truck. Why it matters: Wrong arm/product match can cause delays or safety risk." />
                </Label>
                <Select value={selectedArmId} onValueChange={(v) => {
                  setSelectedArmId(v)
                  const arm = allArms.find((a) => a.id === v)
                  if (arm) setSelectedBayId(arm.bay.id)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a loading arm..." />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingArmsForDialog.map((arm) => {
                      const prodColor = getProductColor(arm.currentProduct?.name)
                      const mismatch = hasProductMismatch(arm, assignDialog.productId)
                      return (
                        <SelectItem key={arm.id} value={arm.id}>
                          {arm.bay.uniqueCode} - Arm {arm.armNo}
                          {arm.currentProduct ? ` (${arm.currentProduct.name})` : " (Empty)"}
                          {mismatch ? " !! MISMATCH" : ""}
                          {" "} [{arm.status}]
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Arm Details */}
              {selectedArmId && (() => {
                const arm = allArms.find((a) => a.id === selectedArmId)
                if (!arm) return null
                const prodColor = getProductColor(arm.currentProduct?.name)
                const mismatch = hasProductMismatch(arm, assignDialog.productId)

                return (
                  <div className={`rounded-lg border p-3 space-y-2 ${mismatch ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Bay</span>
                        <p className="font-medium">{arm.bay.uniqueCode} - {arm.bay.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Arm</span>
                        <p className="font-medium">Arm {arm.armNo}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Current Product</span>
                        <p className={`font-medium ${prodColor.text}`}>
                          {arm.currentProduct?.name || "Empty"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Status</span>
                        <p className="font-medium">{arm.status}</p>
                      </div>
                    </div>

                    {mismatch && (
                      <div className="flex items-start gap-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">Product Mismatch Warning</p>
                          <p className="text-xs">
                            This arm currently has <strong>{arm.currentProduct?.name}</strong> but
                            the truck needs <strong>{assignDialog.productName}</strong>.
                            A changeover may be required.
                          </p>
                        </div>
                      </div>
                    )}

                    {!mismatch && (
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span>{arm.currentProduct ? "Product matches" : "Arm is empty and available"}</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {matchingArmsForDialog.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No compatible arms available. All arms are occupied with different products or under maintenance.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialog(null); setSelectedArmId(""); setSelectedBayId("") }}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedArmId || assignArm.isPending}
            >
              {assignArm.isPending ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
