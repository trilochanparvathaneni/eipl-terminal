"use client"

import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import type { ChatAction } from "@/lib/copilot/response-builder"
import type { AssistAction } from "../../../types/assistResponse"
import { guardAssistAction } from "@/lib/assist/action-route-guard"
import { buildIncidentHref } from "@/lib/routes/incident"

type ActionLike = {
  id: string
  label: string
  href?: string
  incidentId?: string
  truckId?: string
  incident_id?: string
  truck_id?: string
  primary?: boolean
}

function fillRouteTemplate(href: string, action: ActionLike): string {
  const incidentId = action.incidentId ?? action.incident_id ?? ""
  const truckId = action.truckId ?? action.truck_id ?? ""
  return href
    .replace("{incident_id}", encodeURIComponent(incidentId))
    .replace("{incidentId}", encodeURIComponent(incidentId))
    .replace("{truck_id}", encodeURIComponent(truckId))
    .replace("{truckId}", encodeURIComponent(truckId))
}

export function resolveActionHref(action: ActionLike): string {
  const directHref = action.href?.trim()
  if (directHref) {
    return fillRouteTemplate(directHref, action)
  }

  const incidentId = action.incidentId ?? action.incident_id
  if (incidentId) {
    return buildIncidentHref(incidentId)
  }

  const truckId = action.truckId ?? action.truck_id
  if (truckId) {
    return `/compliance/trucks/${encodeURIComponent(truckId)}`
  }

  return "/dashboard"
}

interface AssistActionButtonProps {
  action: ActionLike
  className: string
  title?: string
  onNavigate?: () => void
}

export function AssistActionButton({ action, className, title, onNavigate }: AssistActionButtonProps) {
  const router = useRouter()
  const guarded = guardAssistAction({
    label: action.label,
    href: resolveActionHref(action),
    tooltip: title,
  })

  function handleClick() {
    router.push(guarded.href)
    onNavigate?.()
  }

  return (
    <button
      type="button"
      title={guarded.replaced ? guarded.replacementReason : guarded.tooltip}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {guarded.label}
      {guarded.replaced && (
        <AlertCircle
          className="h-3.5 w-3.5"
          aria-label="Action redirected to support because destination is unavailable"
        />
      )}
    </button>
  )
}
