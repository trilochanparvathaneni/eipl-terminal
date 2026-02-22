"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { buildIncidentHref } from "@/lib/routes/incident"

type IncidentActionsProps = {
  incidentId: string
  status: string
  canResolve: boolean
}

export default function IncidentActions({ incidentId, status, canResolve }: IncidentActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  async function markResolved() {
    setError("")
    const response = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/close`, { method: "POST" })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error || "Failed to resolve incident.")
      return
    }
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canResolve && status === "OPEN" && (
          <Button onClick={markResolved} disabled={isPending}>
            {isPending ? "Resolving..." : "Mark as Resolved"}
          </Button>
        )}
        <Button variant="outline" onClick={() => router.push(`/communications?context=${encodeURIComponent(incidentId)}`)}>
          Add Note
        </Button>
        <Button variant="outline" onClick={() => router.push("/hse/incidents")}>
          Back to Incidents
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600">
          {error}{" "}
          <button type="button" className="underline" onClick={() => router.push(buildIncidentHref(incidentId))}>
            Reload incident
          </button>
        </p>
      )}
    </div>
  )
}
