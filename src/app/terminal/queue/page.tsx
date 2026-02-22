import Link from "next/link"
import { redirect } from "next/navigation"
import { Role, TruckTripStatus } from "@prisma/client"
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

export default async function TerminalQueuePage() {
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

  const trips = await prisma.truckTrip.findMany({
    where: {
      status: {
        in: [TruckTripStatus.PENDING, TruckTripStatus.QR_ISSUED, TruckTripStatus.ARRIVED, TruckTripStatus.IN_TERMINAL],
      },
      booking: user.terminalId ? { terminalId: user.terminalId } : undefined,
    },
    include: {
      booking: {
        select: {
          bookingNo: true,
          product: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
    orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
    take: 200,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Terminal Queue</h1>
      <p className="text-sm text-muted-foreground">Current truck progression from yard to loading stages.</p>
      <div className="space-y-2">
        {trips.map((trip) => (
          <Card key={trip.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{trip.truckNumber}</span>
                <div className="flex items-center gap-2">
                  <Badge>{trip.status}</Badge>
                  <Badge variant="outline">{trip.custodyStage}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>
                <strong>Booking:</strong> {trip.booking.bookingNo}
              </p>
              <p>
                <strong>Client:</strong> {trip.booking.client?.name ?? "N/A"}
              </p>
              <p>
                <strong>Product:</strong> {trip.booking.product?.name ?? "N/A"}
              </p>
              <p>
                <strong>Queue Position:</strong> {trip.queuePosition ?? "Unassigned"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {trips.length === 0 && <p className="text-sm text-muted-foreground">No active queue trips found for your terminal scope.</p>}
    </div>
  )
}
