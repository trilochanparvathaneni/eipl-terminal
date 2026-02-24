"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Fuel, Clock, Wrench, CalendarClock, Check, X, Truck } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

type BayStatus = "occupied" | "available" | "maintenance" | "reserved"

interface BayData {
  id: number
  name: string
  products: string[]
  status: BayStatus
  truck?: string
  product?: string
  loadPercent?: number
  scheduledTime?: string
}

// ── Demo Data ────────────────────────────────────────────────────────────────

const BAYS: BayData[] = [
  { id: 1, name: "Bay 1", products: ["Diesel", "Petrol"], status: "occupied", truck: "TN-01-AB-1234", product: "Diesel", loadPercent: 45 },
  { id: 2, name: "Bay 2", products: ["Diesel", "Petrol"], status: "available" },
  { id: 3, name: "Bay 3", products: ["Diesel", "Petrol", "SKO"], status: "occupied", truck: "AP-05-CD-5678", product: "Petrol", loadPercent: 80 },
  { id: 4, name: "Bay 4", products: ["SKO", "Kerosene"], status: "maintenance" },
  { id: 5, name: "Bay 5", products: ["LPG"], status: "available" },
  { id: 6, name: "Bay 6", products: ["LPG", "Propane"], status: "reserved", scheduledTime: "2:30 PM" },
  { id: 7, name: "Bay 7", products: ["Diesel"], status: "occupied", truck: "TS-09-EF-9012", product: "Diesel", loadPercent: 20 },
  { id: 8, name: "Bay 8", products: ["Diesel", "Petrol"], status: "available" },
  { id: 9, name: "Bay 9", products: ["Petrol", "Ethanol"], status: "occupied", truck: "KA-03-GH-3456", product: "Petrol", loadPercent: 95 },
  { id: 10, name: "Bay 10", products: ["Diesel", "HSD"], status: "available" },
  { id: 11, name: "Bay 11", products: ["LPG", "Propane"], status: "maintenance" },
  { id: 12, name: "Bay 12", products: ["Diesel", "Petrol", "SKO"], status: "occupied", truck: "MH-12-IJ-7890", product: "SKO", loadPercent: 60 },
]

const ALL_PRODUCTS = ["Diesel", "Petrol", "LPG", "SKO", "Kerosene", "Propane", "Ethanol", "HSD"]

const PRODUCT_COLORS: Record<string, string> = {
  Diesel: "bg-sky-100 text-sky-700 border-sky-300",
  Petrol: "bg-emerald-100 text-emerald-700 border-emerald-300",
  LPG: "bg-orange-100 text-orange-700 border-orange-300",
  SKO: "bg-violet-100 text-violet-700 border-violet-300",
  Kerosene: "bg-teal-100 text-teal-700 border-teal-300",
  Propane: "bg-amber-100 text-amber-700 border-amber-300",
  Ethanol: "bg-pink-100 text-pink-700 border-pink-300",
  HSD: "bg-indigo-100 text-indigo-700 border-indigo-300",
}

const STATUS_CONFIG: Record<BayStatus, { label: string; bg: string; border: string; text: string; icon: typeof Fuel }> = {
  occupied: { label: "Occupied", bg: "bg-red-100", border: "border-red-300", text: "text-red-700", icon: Truck },
  available: { label: "Available", bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-700", icon: Check },
  maintenance: { label: "Maintenance", bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-700", icon: Wrench },
  reserved: { label: "Reserved", bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700", icon: CalendarClock },
}

// ── Estimated completion helper ──────────────────────────────────────────────

function estimatedCompletion(loadPercent: number): string {
  const remaining = 100 - loadPercent
  const minutes = Math.round((remaining / 100) * 45) // ~45 min for full load
  if (minutes <= 0) return "Completing now"
  return `~${minutes} min remaining`
}

// ── Component ────────────────────────────────────────────────────────────────

export function BayHeatmap() {
  const [productFilter, setProductFilter] = useState("ALL")
  const [selectedBay, setSelectedBay] = useState<BayData | null>(null)

  const counts = {
    occupied: BAYS.filter((b) => b.status === "occupied").length,
    available: BAYS.filter((b) => b.status === "available").length,
    maintenance: BAYS.filter((b) => b.status === "maintenance").length,
    reserved: BAYS.filter((b) => b.status === "reserved").length,
  }

  const isHighlighted = (bay: BayData) =>
    productFilter === "ALL" || bay.products.includes(productFilter)

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-lg">Terminal Bay Status &mdash; Live View</CardTitle>
          <p className="mt-0.5 text-xs text-slate-600">Real-time bay occupancy and product compatibility</p>
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Products</SelectItem>
            {ALL_PRODUCTS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Bar */}
        <div className="flex flex-wrap gap-3 text-sm">
          {(Object.entries(counts) as [BayStatus, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.border}`}>
                <cfg.icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                <span className={`font-medium ${cfg.text}`}>{count}</span>
                <span className={`${cfg.text} opacity-75`}>{cfg.label}</span>
              </div>
            )
          })}
        </div>

        {/* Bay Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {BAYS.map((bay) => {
            const cfg = STATUS_CONFIG[bay.status]
            const dimmed = !isHighlighted(bay)

            return (
              <button
                key={bay.id}
                onClick={() => setSelectedBay(bay)}
                className={`
                  relative text-left rounded-lg border-2 p-3 transition-all
                  ${cfg.bg} ${cfg.border}
                  ${dimmed ? "opacity-30" : "cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"}
                  ${bay.status === "maintenance" ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,rgba(148,163,184,0.1)_8px,rgba(148,163,184,0.1)_16px)]" : ""}
                `}
              >
                {/* Bay header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-900">{bay.name}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </Badge>
                </div>

                {/* Product pills */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {bay.products.map((prod) => (
                    <span
                      key={prod}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${PRODUCT_COLORS[prod] || "border-slate-300 bg-slate-100 text-slate-700"}`}
                    >
                      {prod}
                    </span>
                  ))}
                </div>

                {/* Occupied: truck info + progress */}
                {bay.status === "occupied" && bay.truck && (
                  <div className="mt-1">
                    <div className="mb-1 flex items-center gap-1 text-xs text-slate-600">
                      <Truck className="h-3 w-3" />
                      <span className="font-mono text-[11px]">{bay.truck}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            bay.loadPercent! >= 90 ? "bg-green-500" : bay.loadPercent! >= 50 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${bay.loadPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-700">{bay.loadPercent}%</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">{bay.product} loading</p>
                  </div>
                )}

                {/* Reserved: scheduled time */}
                {bay.status === "reserved" && bay.scheduledTime && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                    <Clock className="h-3 w-3" />
                    <span>Scheduled {bay.scheduledTime}</span>
                  </div>
                )}

                {/* Maintenance: label */}
                {bay.status === "maintenance" && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Wrench className="h-3 w-3" />
                    <span>Under maintenance</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-600">Legend</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.entries(STATUS_CONFIG) as [BayStatus, typeof STATUS_CONFIG[BayStatus]][]).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className={`w-3 h-3 rounded border-2 ${cfg.bg} ${cfg.border} ${status === "maintenance" ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" : ""}`} />
                <span>{cfg.label}</span>
              </div>
            ))}
            <div className="mx-1 w-px bg-slate-300" />
            {ALL_PRODUCTS.map((prod) => (
              <div key={prod} className="flex items-center gap-1 text-xs">
                <span className={`px-1.5 py-0 rounded-full border text-[10px] font-medium ${PRODUCT_COLORS[prod]}`}>{prod}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Product-Bay Compatibility Matrix */}
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-600">Product-Bay Compatibility Matrix</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 bg-slate-100 px-2 py-1.5 text-left font-medium text-slate-700">Product</th>
                  {BAYS.map((b) => (
                    <th key={b.id} className="whitespace-nowrap px-1.5 py-1.5 text-center font-medium text-slate-600">
                      B{b.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PRODUCTS.filter((p) => BAYS.some((b) => b.products.includes(p))).map((prod) => (
                  <tr key={prod} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                    <td className="sticky left-0 bg-slate-100 px-2 py-1.5 font-medium text-slate-700">
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${PRODUCT_COLORS[prod]}`}>{prod}</span>
                    </td>
                    {BAYS.map((bay) => (
                      <td key={bay.id} className="text-center py-1.5 px-1.5">
                        {bay.products.includes(prod) ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <X className="mx-auto h-3 w-3 text-slate-600" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>

      {/* Bay Detail Popup */}
      <Dialog open={!!selectedBay} onOpenChange={() => setSelectedBay(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedBay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedBay.name}
                  <Badge variant="outline" className={`${STATUS_CONFIG[selectedBay.status].text} ${STATUS_CONFIG[selectedBay.status].border}`}>
                    {STATUS_CONFIG[selectedBay.status].label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Compatible Products */}
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-700">Compatible Products</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBay.products.map((prod) => (
                      <span key={prod} className={`text-xs px-2 py-1 rounded-full border font-medium ${PRODUCT_COLORS[prod]}`}>
                        {prod}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Truck Info (if occupied) */}
                {selectedBay.status === "occupied" && selectedBay.truck && (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-slate-700">Current Truck</p>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Truck Number</span>
                          <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-medium">{selectedBay.truck}</code>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Product</span>
                          <span className="font-medium text-slate-900">{selectedBay.product}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-slate-700">Loading Progress</p>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                selectedBay.loadPercent! >= 90 ? "bg-green-500" : selectedBay.loadPercent! >= 50 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${selectedBay.loadPercent}%` }}
                            />
                          </div>
                          <span className="min-w-[40px] text-right text-sm font-bold text-slate-900">{selectedBay.loadPercent}%</span>
                        </div>
                        <p className="text-xs text-slate-600">{estimatedCompletion(selectedBay.loadPercent!)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reserved info */}
                {selectedBay.status === "reserved" && selectedBay.scheduledTime && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">Reservation</p>
                    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <CalendarClock className="h-4 w-4 text-amber-700" />
                      <span className="text-sm text-amber-800">Scheduled for <strong>{selectedBay.scheduledTime}</strong></span>
                    </div>
                  </div>
                )}

                {/* Maintenance info */}
                {selectedBay.status === "maintenance" && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">Status</p>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
                      <Wrench className="h-4 w-4 text-slate-600" />
                      <span className="text-sm text-slate-700">Bay is currently under scheduled maintenance</span>
                    </div>
                  </div>
                )}

                {/* Available info */}
                {selectedBay.status === "available" && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">Status</p>
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                      <Check className="h-4 w-4 text-emerald-700" />
                      <span className="text-sm text-emerald-800">Bay is available for allocation</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
