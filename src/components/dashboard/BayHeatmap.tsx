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
  Diesel: "bg-blue-100 text-blue-700 border-blue-200",
  Petrol: "bg-emerald-100 text-emerald-700 border-emerald-200",
  LPG: "bg-orange-100 text-orange-700 border-orange-200",
  SKO: "bg-purple-100 text-purple-700 border-purple-200",
  Kerosene: "bg-teal-100 text-teal-700 border-teal-200",
  Propane: "bg-amber-100 text-amber-700 border-amber-200",
  Ethanol: "bg-pink-100 text-pink-700 border-pink-200",
  HSD: "bg-indigo-100 text-indigo-700 border-indigo-200",
}

const STATUS_CONFIG: Record<BayStatus, { label: string; bg: string; border: string; text: string; icon: typeof Fuel }> = {
  occupied: { label: "Occupied", bg: "bg-red-50", border: "border-red-300", text: "text-red-700", icon: Truck },
  available: { label: "Available", bg: "bg-green-50", border: "border-green-300", text: "text-green-700", icon: Check },
  maintenance: { label: "Maintenance", bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-600", icon: Wrench },
  reserved: { label: "Reserved", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", icon: CalendarClock },
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
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-lg">Terminal Bay Status &mdash; Live View</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time bay occupancy and product compatibility</p>
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
                  ${dimmed ? "opacity-30" : "hover:shadow-md hover:scale-[1.02] cursor-pointer"}
                  ${bay.status === "maintenance" ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,rgba(0,0,0,0.03)_8px,rgba(0,0,0,0.03)_16px)]" : ""}
                `}
              >
                {/* Bay header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-gray-900">{bay.name}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </Badge>
                </div>

                {/* Product pills */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {bay.products.map((prod) => (
                    <span
                      key={prod}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${PRODUCT_COLORS[prod] || "bg-gray-100 text-gray-600 border-gray-200"}`}
                    >
                      {prod}
                    </span>
                  ))}
                </div>

                {/* Occupied: truck info + progress */}
                {bay.status === "occupied" && bay.truck && (
                  <div className="mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                      <Truck className="h-3 w-3" />
                      <span className="font-mono text-[11px]">{bay.truck}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-red-200/50 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            bay.loadPercent! >= 90 ? "bg-green-500" : bay.loadPercent! >= 50 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${bay.loadPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700">{bay.loadPercent}%</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{bay.product} loading</p>
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
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Wrench className="h-3 w-3" />
                    <span>Under maintenance</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Legend</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.entries(STATUS_CONFIG) as [BayStatus, typeof STATUS_CONFIG[BayStatus]][]).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className={`w-3 h-3 rounded border-2 ${cfg.bg} ${cfg.border} ${status === "maintenance" ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" : ""}`} />
                <span>{cfg.label}</span>
              </div>
            ))}
            <div className="w-px bg-gray-200 mx-1" />
            {ALL_PRODUCTS.map((prod) => (
              <div key={prod} className="flex items-center gap-1 text-xs">
                <span className={`px-1.5 py-0 rounded-full border text-[10px] font-medium ${PRODUCT_COLORS[prod]}`}>{prod}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Product-Bay Compatibility Matrix */}
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Product-Bay Compatibility Matrix</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 px-2 text-gray-500 font-medium sticky left-0 bg-white">Product</th>
                  {BAYS.map((b) => (
                    <th key={b.id} className="text-center py-1.5 px-1.5 text-gray-500 font-medium whitespace-nowrap">
                      B{b.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PRODUCTS.filter((p) => BAYS.some((b) => b.products.includes(p))).map((prod) => (
                  <tr key={prod} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="py-1.5 px-2 font-medium text-gray-700 sticky left-0 bg-white">
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${PRODUCT_COLORS[prod]}`}>{prod}</span>
                    </td>
                    {BAYS.map((bay) => (
                      <td key={bay.id} className="text-center py-1.5 px-1.5">
                        {bay.products.includes(prod) ? (
                          <Check className="h-3.5 w-3.5 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-3 w-3 text-gray-200 mx-auto" />
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
                  <p className="text-sm font-medium text-gray-600 mb-1.5">Compatible Products</p>
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
                      <p className="text-sm font-medium text-gray-600 mb-1.5">Current Truck</p>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Truck Number</span>
                          <code className="font-mono font-medium bg-gray-200 px-1.5 py-0.5 rounded text-xs">{selectedBay.truck}</code>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Product</span>
                          <span className="font-medium">{selectedBay.product}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1.5">Loading Progress</p>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                selectedBay.loadPercent! >= 90 ? "bg-green-500" : selectedBay.loadPercent! >= 50 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${selectedBay.loadPercent}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold min-w-[40px] text-right">{selectedBay.loadPercent}%</span>
                        </div>
                        <p className="text-xs text-gray-500">{estimatedCompletion(selectedBay.loadPercent!)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reserved info */}
                {selectedBay.status === "reserved" && selectedBay.scheduledTime && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1.5">Reservation</p>
                    <div className="bg-amber-50 rounded-lg p-3 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-700">Scheduled for <strong>{selectedBay.scheduledTime}</strong></span>
                    </div>
                  </div>
                )}

                {/* Maintenance info */}
                {selectedBay.status === "maintenance" && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1.5">Status</p>
                    <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Bay is currently under scheduled maintenance</span>
                    </div>
                  </div>
                )}

                {/* Available info */}
                {selectedBay.status === "available" && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1.5">Status</p>
                    <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700">Bay is available for allocation</span>
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
