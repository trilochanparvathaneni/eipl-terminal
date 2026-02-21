"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Role } from "@prisma/client"
import { AlertTriangle, Bell, CircleCheck, Loader2, ShieldAlert } from "lucide-react"
import { shortTip } from "@/lib/ui/tooltipCopy"
import { buildMovementRowHref } from "@/lib/routes/movements"
import { formatRelativeTime } from "@/lib/time/relative"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type MovementRowUi = {
  id: string
  updatedAt: string
  vehicleNo: string
  clientName?: string
  product?: string
  stage: string
  statusFlag: "on_time" | "delayed" | "blocked"
  note?: string
  bookingId?: string
  truckId?: string
}

type MovementsBoardProps = {
  role: Role
  rows: MovementRowUi[]
  alerts: MovementRowUi[]
  isRefreshing?: boolean
  updatedAtLabel: string
}

function StatusChip({ status }: { status: MovementRowUi["statusFlag"] }) {
  const config =
    status === "blocked"
      ? { text: "Blocked", cls: "bg-red-600 text-white border-red-500", tip: "Blocked by safety or compliance gate." }
      : status === "delayed"
        ? { text: "Delayed", cls: "bg-amber-500 text-amber-950 border-amber-400", tip: "Movement delayed beyond expected stage time." }
        : { text: "On-time", cls: "bg-emerald-500 text-emerald-950 border-emerald-400", tip: "Movement is tracking expected timeline." }

  return (
    <span title={shortTip(config.tip)} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${config.cls}`}>
      {config.text}
    </span>
  )
}

export function MovementsBoard({ role, rows, alerts, isRefreshing, updatedAtLabel }: MovementsBoardProps) {
  const router = useRouter()
  const internal = role !== Role.CLIENT && role !== Role.TRANSPORTER
  const recentAlerts = alerts.slice(0, 8)

  const columns = useMemo(
    () =>
      internal
        ? ["Time", "Vehicle", "Client", "Product", "Current Stage", "Status", "Note"]
        : ["Time", "Vehicle", "Current Stage", "ETA / Note"],
    [internal]
  )

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            LIVE
          </span>
          <p className="text-sm font-semibold text-slate-100">Live Movements Board</p>
          {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-400">Updated {updatedAtLabel}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={shortTip("Live alerts from recent movement changes.")}
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                <Bell className="h-4 w-4" />
                {alerts.length > 0 ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {alerts.length}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Live Alerts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentAlerts.length === 0 ? (
                <DropdownMenuItem disabled>No alerts in the current window.</DropdownMenuItem>
              ) : (
                recentAlerts.map((alert) => (
                  <DropdownMenuItem
                    key={`alert-${alert.id}`}
                    className="cursor-pointer items-start gap-2 py-1.5"
                    onClick={() => router.push(buildMovementRowHref(role, { bookingId: alert.bookingId, truckId: alert.truckId }))}
                  >
                    {alert.statusFlag === "blocked" ? (
                      <ShieldAlert className="mt-0.5 h-4 w-4 text-red-400" />
                    ) : alert.statusFlag === "delayed" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
                    ) : (
                      <CircleCheck className="mt-0.5 h-4 w-4 text-emerald-400" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-200">
                        {alert.vehicleNo} moved to {alert.stage}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {internal ? (alert.note || "Operational update").slice(0, 40) : "Movement in progress"}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              {alerts.length > recentAlerts.length && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-xs text-sky-300" onClick={() => router.push("/live-ops")}>
                    View all alerts
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="max-h-[430px] overflow-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-left text-xs text-slate-200">
          <thead className="sticky top-0 bg-slate-950/90 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(buildMovementRowHref(role, { bookingId: row.bookingId, truckId: row.truckId }))}
                className={`cursor-pointer border-t border-slate-800 transition-colors hover:bg-slate-800/70 ${
                  row.statusFlag === "blocked" ? "bg-red-500/10" : ""
                }`}
              >
                <td className="px-3 py-2 text-slate-300">{formatRelativeTime(row.updatedAt)}</td>
                <td className="px-3 py-2 font-mono text-slate-100">{row.vehicleNo}</td>
                {internal ? (
                  <>
                    <td className="px-3 py-2">{row.clientName || "-"}</td>
                    <td className="px-3 py-2">{row.product || "-"}</td>
                    <td className="px-3 py-2">{row.stage}</td>
                    <td className="px-3 py-2">
                      <StatusChip status={row.statusFlag} />
                    </td>
                    <td className="px-3 py-2 text-slate-300">{row.note || "-"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2">{row.stage}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {row.statusFlag === "delayed" ? "Awaiting terminal clearance" : "In progress"}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">
                  No movement records available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
