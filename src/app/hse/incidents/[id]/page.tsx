import { notFound, redirect } from "next/navigation"
import { Role } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSessionUser } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { formatDateTime, statusColor } from "@/lib/utils"
import IncidentActions from "./incident-actions"
import { isValidIncidentId } from "@/lib/routes/incident"
import { enforceTerminalAccess } from "@/lib/auth/scope"

const INTERNAL_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.TERMINAL_ADMIN,
  Role.HSE_OFFICER,
  Role.SECURITY,
  Role.AUDITOR,
  Role.SURVEYOR,
  Role.TRAFFIC_CONTROLLER,
])

type PageProps = {
  params: { id: string }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || "Not available"}</p>
    </div>
  )
}

export default async function IncidentDetailPage({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  if (!INTERNAL_ROLES.has(user.role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>You don&apos;t have access</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Incident details are available to internal EIPL operations roles only.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isValidIncidentId(params.id)) {
    notFound()
  }

  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: {
      terminal: { select: { name: true, location: true } },
      booking: { select: { bookingNo: true } },
      reportedBy: { select: { name: true } },
    },
  })

  if (!incident) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Incident not found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            The requested incident does not exist or may have been removed.
          </CardContent>
        </Card>
      </div>
    )
  }

  const terminalAccessError = enforceTerminalAccess(user, incident.terminalId)
  if (terminalAccessError) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>You don&apos;t have access</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            This incident belongs to a different terminal scope.
          </CardContent>
        </Card>
      </div>
    )
  }

  const canResolve =
    user.role === Role.SUPER_ADMIN || user.role === Role.TERMINAL_ADMIN || user.role === Role.HSE_OFFICER

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Incident #{incident.id}</CardTitle>
          <Badge className={statusColor(incident.status)}>{incident.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Type" value={incident.bookingId ? "Booking-linked" : "Terminal safety incident"} />
            <Field label="Severity" value={incident.severity} />
            <Field label="Location" value={incident.terminal?.location || incident.terminal?.name || "Not available"} />
            <Field label="Reported Time" value={formatDateTime(incident.createdAt)} />
            <Field label="Assigned To" value={incident.reportedBy?.name || "Duty officer"} />
            <Field label="Status" value={incident.status} />
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Description</p>
            <p className="whitespace-pre-wrap text-sm text-slate-900">{incident.description || "No description provided."}</p>
            {incident.booking?.bookingNo && (
              <p className="mt-2 text-xs text-slate-500">Booking: {incident.booking.bookingNo}</p>
            )}
          </div>

          <IncidentActions incidentId={incident.id} status={incident.status} canResolve={canResolve} />
        </CardContent>
      </Card>
    </div>
  )
}
