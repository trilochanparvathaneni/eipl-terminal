import Link from "next/link"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"
import { getSessionUser } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const INTERNAL_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.TERMINAL_ADMIN,
  Role.HSE_OFFICER,
  Role.SECURITY,
  Role.TRAFFIC_CONTROLLER,
  Role.SURVEYOR,
  Role.AUDITOR,
])

export default async function TerminalBaysPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  if (!INTERNAL_ROLES.has(user.role)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not authorized</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>This page is available for internal terminal teams only.</p>
          <Link className="text-blue-600 hover:underline" href="/contacts/control-room">
            Contact support
          </Link>
        </CardContent>
      </Card>
    )
  }

  const bays = await prisma.bay.findMany({
    where: user.terminalId ? { gantry: { terminalId: user.terminalId } } : undefined,
    include: {
      gantry: { select: { name: true } },
      currentProduct: { select: { name: true, category: true } },
    },
    orderBy: [{ gantry: { name: "asc" } }, { name: "asc" }],
    take: 100,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Terminal Bay Status</h1>
      <p className="text-sm text-muted-foreground">Live bay availability for internal operations planning.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {bays.map((bay) => (
          <Card key={bay.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{bay.uniqueCode}</span>
                <Badge>{bay.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>
                <strong>Gantry:</strong> {bay.gantry.name}
              </p>
              <p>
                <strong>Mode:</strong> {bay.allowedMode}
              </p>
              <p>
                <strong>Current Product:</strong> {bay.currentProduct?.name ?? "Not assigned"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {bays.length === 0 && <p className="text-sm text-muted-foreground">No bay records found for your terminal scope.</p>}
    </div>
  )
}
