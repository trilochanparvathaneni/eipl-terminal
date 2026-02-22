"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { guardAssistAction } from "@/lib/assist/action-route-guard"

type AlertPriority = "Info" | "Warning" | "Critical"
type ApprovalStatus = "BLOCKED" | "ACTION_REQUIRED" | "APPROVED"

interface PrecheckItem {
  valid: boolean
  detail: string
}

interface ApprovalPayload {
  status: ApprovalStatus
  truck_id: string
  transporter_name: string
  compliance_gap_summary?: string
  precheck: {
    peso_license_validity: PrecheckItem
    spark_arrestor_status: PrecheckItem
    earthing_relay_calibration: PrecheckItem
    rc_fitness_certificate: PrecheckItem
  }
  checklist?: Array<{ id: string; label: string }>
  gatekeeper_action?: {
    label: string
    action_url: string
  }
  priority?: AlertPriority
}

function emitGateAssistEvent(actionLabel: string, truckId: string, status: ApprovalStatus) {
  const payload = {
    event: "GA_Event",
    category: "IntelligenceBuddy",
    action: "gate_pass_issue_click",
    label: actionLabel,
    truck_id: truckId,
    status,
    timestamp: new Date().toISOString(),
  }
  if (typeof window !== "undefined" && (window as any).gtag) {
    ;(window as any).gtag("event", payload.action, payload)
  }
  // Local audit signal for environments without analytics wiring.
  console.info("[GA_Event]", payload)
}

function priorityFromPayload(payload: ApprovalPayload): AlertPriority {
  if (payload.priority) return payload.priority
  if (payload.status === "BLOCKED") return "Critical"
  if (payload.status === "ACTION_REQUIRED") return "Warning"
  return "Info"
}

export function ApprovalChatCard({
  payload,
  onIssueGatePass,
}: {
  payload: ApprovalPayload
  onIssueGatePass?: () => Promise<void> | void
}) {
  const router = useRouter()
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((payload.checklist ?? []).map((item) => [item.id, false]))
  )
  const [issuing, setIssuing] = useState(false)

  const priority = priorityFromPayload(payload)
  const allChecked = useMemo(
    () => {
      const list = payload.checklist ?? []
      return list.length > 0 && list.every((item) => Boolean(checks[item.id]))
    },
    [checks, payload.checklist]
  )

  const priorityStyles = priority === "Critical"
    ? {
        card: "border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.35)] animate-pulse",
        badge: "bg-red-100 text-red-700 border-red-300",
        icon: <ShieldAlert className="h-4 w-4 text-red-600" />,
      }
    : priority === "Warning"
      ? {
          card: "border-amber-500",
          badge: "bg-amber-100 text-amber-700 border-amber-300",
          icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        }
      : {
          card: "border-sky-500",
          badge: "bg-sky-100 text-sky-700 border-sky-300",
          icon: <CheckCircle2 className="h-4 w-4 text-sky-600" />,
        }

  async function handleIssueGatePass() {
    if (!payload.gatekeeper_action) return
    emitGateAssistEvent(payload.gatekeeper_action.label, payload.truck_id, payload.status)
    setIssuing(true)
    try {
      if (onIssueGatePass) {
        await onIssueGatePass()
      } else if (payload.gatekeeper_action.action_url) {
        const guarded = guardAssistAction({
          label: payload.gatekeeper_action.label,
          url: payload.gatekeeper_action.action_url,
        })
        router.push(guarded.href)
      }
    } finally {
      setIssuing(false)
    }
  }

  return (
    <Card className={`border-2 ${priorityStyles.card}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            {priorityStyles.icon}
            Compliance Approval: {payload.truck_id}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityStyles.badge}`}>
            {priority}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Transporter: {payload.transporter_name}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Section A: Bot Pre-Check (PESO/OISD)
          </p>
          {([
            ["PESO License Validity", payload.precheck.peso_license_validity],
            ["Spark Arrestor Status", payload.precheck.spark_arrestor_status],
            ["Earthing Relay Calibration", payload.precheck.earthing_relay_calibration],
            ["RC Fitness Certificate", payload.precheck.rc_fitness_certificate],
          ] as const).map(([label, state]) => (
            <div key={label} className="flex items-start justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{label}</span>
              <span className={`text-xs font-medium ${state.valid ? "text-emerald-700" : "text-red-700"}`}>
                {state.valid ? `OK - ${state.detail}` : `FAIL - ${state.detail}`}
              </span>
            </div>
          ))}
          {payload.status === "BLOCKED" && payload.compliance_gap_summary && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {payload.compliance_gap_summary}
            </p>
          )}
        </div>

        {payload.status === "ACTION_REQUIRED" && payload.checklist && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Section B: Human Verification
            </p>
            {payload.checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(checks[item.id])}
                  onCheckedChange={(checked) =>
                    setChecks((prev) => ({ ...prev, [item.id]: Boolean(checked) }))
                  }
                />
                <Label className="font-normal">{item.label}</Label>
              </div>
            ))}
          </div>
        )}

        {payload.gatekeeper_action && (
          <Button
            className="w-full"
            disabled={payload.status !== "ACTION_REQUIRED" || !allChecked || issuing}
            onClick={handleIssueGatePass}
          >
            {issuing ? "Issuing..." : payload.gatekeeper_action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
