import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-utils"
import { BookingStatus, TruckTripStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildIncidentHref } from "@/lib/routes/incident"
import { getUserRole, isClientRole } from "@/lib/security/rbac"
import { redactBriefingForClient } from "@/lib/security/redaction"

type BriefingStatus = "CRITICAL" | "BOTTLENECKED" | "STABLE"

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = getUserRole(user)
  const clientRole = isClientRole(role)
  const incidentWhere = user.terminalId ? { terminalId: user.terminalId } : {}
  const bookingWhere = user.terminalId ? { terminalId: user.terminalId } : {}

  if (clientRole) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    const ownBookingWhere = user.clientId
      ? {
          ...bookingWhere,
          clientId: user.clientId,
        }
      : {
          id: "__no_client_scope__",
        }

    const [myTrucksToday, inProgress, completed, delayed] = await Promise.all([
      prisma.truckTrip.count({
        where: {
          booking: ownBookingWhere,
          updatedAt: { gte: start, lt: end },
        },
      }),
      prisma.truckTrip.count({
        where: {
          booking: ownBookingWhere,
          status: {
            in: [TruckTripStatus.PENDING, TruckTripStatus.QR_ISSUED, TruckTripStatus.ARRIVED, TruckTripStatus.IN_TERMINAL],
          },
        },
      }),
      prisma.truckTrip.count({
        where: {
          booking: ownBookingWhere,
          status: { in: [TruckTripStatus.LOADED, TruckTripStatus.EXITED, TruckTripStatus.COMPLETED] },
          updatedAt: { gte: start, lt: end },
        },
      }),
      prisma.booking.count({
        where: {
          ...ownBookingWhere,
          status: { in: [BookingStatus.REJECTED, BookingStatus.CANCELLED] },
          updatedAt: { gte: start, lt: end },
        },
      }),
    ])

    const terminalState: "OPEN" | "LIMITED" | "PAUSED" = delayed > 0 ? "LIMITED" : "OPEN"
    const etaRange = inProgress > 0 ? "40-90 mins" : "15-40 mins"
    return NextResponse.json(
      redactBriefingForClient({
        myTrucksToday,
        inProgress,
        completed,
        terminalState,
        etaRange,
      })
    )
  }

  const [openIncidents, inTerminalTrips, activeTrips, totalInventoryKl, expiredCompliance] = await Promise.all([
    prisma.incident.count({
      where: {
        ...incidentWhere,
        status: "OPEN",
      },
    }),
    prisma.truckTrip.count({
      where: {
        booking: bookingWhere,
        status: { in: ["ARRIVED", "IN_TERMINAL"] },
      },
    }),
    prisma.truckTrip.count({
      where: {
        booking: bookingWhere,
        status: { in: ["IN_TERMINAL", "LOADED"] },
      },
    }),
    prisma.inventoryLot.aggregate({
      _sum: { quantityAvailable: true },
    }),
    prisma.complianceGateResult.count({
      where: {
        gateType: "DOCUMENTS",
        status: { in: ["FAIL", "BLOCKED"] },
      },
    }),
  ])

  const hortonSphereCapacityKl = Number(process.env.HORTON_SPHERE_CAPACITY_KL ?? 10000)
  const inventoryKl = Number(totalInventoryKl._sum.quantityAvailable ?? 0)
  const lpgInventoryPercent = hortonSphereCapacityKl > 0
    ? Math.min(100, (inventoryKl / hortonSphereCapacityKl) * 100)
    : 0
  const queueLength = inTerminalTrips

  let status: BriefingStatus = "STABLE"
  if (openIncidents > 0 || lpgInventoryPercent > 90) {
    status = "CRITICAL"
  } else if (queueLength > 5 && activeTrips === 0) {
    status = "BOTTLENECKED"
  }

  const topOpenIncident = openIncidents > 0
    ? await prisma.incident.findFirst({
        where: {
          ...incidentWhere,
          status: "OPEN",
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, description: true },
      })
    : null

  const headline = status === "CRITICAL"
    ? (openIncidents > 0
      ? "Gantry stalled due to open incident."
      : "Horton Sphere inventory is approaching tank-top.")
    : status === "BOTTLENECKED"
      ? "Queue is rising while active trips remain zero."
      : "Terminal flow is stable for start-of-day operations."

  const payload = {
    status,
    headline,
    key_metrics: [
      `Inventory: ${Math.round(lpgInventoryPercent)}% (${lpgInventoryPercent > 85 ? "Approaching Tank-Top" : "Operational Band"})`,
      `Queue: ${queueLength} Trucks Waiting`,
      `Compliance: ${expiredCompliance} Truck${expiredCompliance === 1 ? "" : "s"} with Expired PESO cert`,
    ],
    primary_action: status === "CRITICAL" && topOpenIncident
      ? {
          label: "Resolve Bay Incident",
          action_url: buildIncidentHref(topOpenIncident.id),
        }
      : status === "CRITICAL"
        ? {
            label: "Increase Discharge Rate",
            action_url: "/terminal/controls/pumps",
          }
        : status === "BOTTLENECKED"
          ? {
              label: "Re-sequence Gantry Queue",
              action_url: "/controller/console",
            }
          : {
              label: "Open Operations Dashboard",
              action_url: "/dashboard",
            },
  }

  return NextResponse.json(payload)
}
