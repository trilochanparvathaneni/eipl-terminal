"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Circle, XCircle } from "lucide-react"

const LIFECYCLE_STEPS = [
  "SUBMITTED",
  "CLIENT_APPROVED",
  "OPS_SCHEDULED",
  "TRUCK_DETAILS_PENDING",
  "QR_ISSUED",
  "ARRIVED_GATE",
  "IN_TERMINAL",
  "LOADED",
  "EXITED",
  "CLOSED",
] as const

const TERMINAL_STATES = ["REJECTED", "CANCELLED", "STOP_WORK"] as const

const STEP_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  CLIENT_APPROVED: "Approved",
  OPS_SCHEDULED: "Scheduled",
  TRUCK_DETAILS_PENDING: "Truck Details",
  QR_ISSUED: "QR Issued",
  ARRIVED_GATE: "At Gate",
  IN_TERMINAL: "In Terminal",
  LOADED: "Loaded",
  EXITED: "Exited",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  STOP_WORK: "Stop Work",
}

export function StatusTimeline({ status }: { status: string }) {
  const isTerminal = (TERMINAL_STATES as readonly string[]).includes(status)
  const currentIndex = LIFECYCLE_STEPS.indexOf(status as typeof LIFECYCLE_STEPS[number])

  return (
    <div className="w-full">
      <div className="flex items-center overflow-x-auto pb-2">
        {LIFECYCLE_STEPS.map((step, index) => {
          const isCompleted = currentIndex > index && !isTerminal
          const isCurrent = step === status
          const isPending = !isCompleted && !isCurrent

          return (
            <div key={step} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full transition-colors",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                    isPending && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] mt-1 whitespace-nowrap",
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {index < LIFECYCLE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-6 h-0.5 mx-0.5 mt-[-14px]",
                    isCompleted ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
      {isTerminal && (
        <div className="mt-2">
          <Badge
            className={cn(
              status === "REJECTED" && "bg-red-100 text-red-700",
              status === "CANCELLED" && "bg-red-100 text-red-700",
              status === "STOP_WORK" && "bg-red-200 text-red-800"
            )}
          >
            <XCircle className="h-3 w-3 mr-1" />
            {STEP_LABELS[status]}
          </Badge>
        </div>
      )}
    </div>
  )
}
