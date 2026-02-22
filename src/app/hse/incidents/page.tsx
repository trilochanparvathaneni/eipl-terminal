import Link from "next/link"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSessionUser } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { formatDateTime, statusColor } from "@/lib/utils"
import { buildIncidentHref } from "@/lib/routes/incident"

const INTERNAL_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.TERMINAL_ADMIN,
  Role.HSE_OFFICER,
  Role.SECURITY,
  Role.AUDITOR,
  Role.SURVEYOR,
  Role.TRAFFIC_CONTROLLER,
])

export default async function HseIncidentsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  if (!INTERNAL_ROLES.has(user.role)) {
    return (
      <Card>
        <CardHeader>
            <CardTitle>You don&apos;t have access</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Incident list is available to internal EIPL operations roles only.
        </CardContent>
      </Card>
    )
  }

  const incidents = await prisma.incident.findMany({
    where: user.terminalId ? { terminalId: user.terminalId } : undefined,
    include: {
      reportedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Incidents</h1>
      <div className="space-y-2">
        {incidents.map((incident) => (
          <Card key={incident.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <Link href={buildIncidentHref(incident.id)} className="font-medium text-slate-900 hover:underline">
                  Incident #{incident.id}
                </Link>
                <p className="truncate text-xs text-slate-600">{incident.description || "No description provided."}</p>
                <p className="text-[11px] text-slate-500">
                  {incident.reportedBy?.name || "Unknown"} • {formatDateTime(incident.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColor(incident.severity)}>{incident.severity}</Badge>
                <Badge className={statusColor(incident.status)}>{incident.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {incidents.length === 0 && <p className="text-sm text-slate-500">No incidents found.</p>}
    </div>
  )
}
