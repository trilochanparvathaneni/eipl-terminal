import "server-only"

import { BookingStatus, ComplianceGateStatus, IncidentSeverity, IncidentStatus, Role, TruckTripStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { SessionUser } from "@/lib/auth-utils"
import { bookingScopeForUser } from "@/lib/auth/scope"
import { getUserRole } from "@/lib/security/rbac"
import { redactMovements } from "@/lib/security/redaction"

export type MovementStage =
  | "Outside"
  | "Weighbridge"
  | "Inspection"
  | "Yard"
  | "Loading"
  | "Doc Clear"
  | "Exiting"

export type MovementStatus = "on_time" | "delayed" | "blocked"

export type MovementRow = {
  id: string
  updatedAt: string
  vehicleNo: string
  clientName?: string
  product?: string
  stage: MovementStage
  statusFlag: MovementStatus
  note?: string
  bookingId?: string
  truckId?: string
}

export type BottleneckInsight = {
  key: string
  label: string
}

export type MovementSnapshot = {
  rows: MovementRow[]
  alerts: MovementRow[]
  insights: BottleneckInsight[]
  metrics: {
    waitingOutside: number
    insideTerminal: number
    atWeighbridge: number
    atInspection: number
    atLoading: number
    completedToday: number
    rejectedToday: number
    avgTurnaroundMin: number
  }
}

function toStage(params: { custodyStage: string; status: TruckTripStatus; bookingStatus: BookingStatus }): MovementStage {
  const stage = params.custodyStage
  if (stage === "GATE_CHECKIN") return "Outside"
  if (stage === "WEIGH_IN" || stage === "WEIGH_OUT") return "Weighbridge"
  if (stage === "SAFETY_APPROVED" || stage === "DOCUMENTS_VERIFIED") return "Inspection"
  if (stage === "READY_FOR_BAY") return "Yard"
  if (stage === "LOADING_STARTED" || stage === "LOADING_COMPLETED") return "Loading"
  if (stage === "SEALED" || stage === "CUSTODY_TRANSFERRED") return "Doc Clear"
  if (stage === "EXITED") return "Exiting"

  if (params.status === TruckTripStatus.ARRIVED || params.status === TruckTripStatus.PENDING || params.status === TruckTripStatus.QR_ISSUED) {
    return "Outside"
  }
  if (params.status === TruckTripStatus.IN_TERMINAL) return "Yard"
  if (params.status === TruckTripStatus.LOADED) return "Doc Clear"
  if (params.status === TruckTripStatus.EXITED || params.status === TruckTripStatus.COMPLETED) return "Exiting"

  if (params.bookingStatus === BookingStatus.REJECTED || params.bookingStatus === BookingStatus.CANCELLED) return "Inspection"
  return "Yard"
}

function inferStatus(params: {
  blockedCompliance: number
  activeStopWork: number
  highIncidents: number
  stage: MovementStage
  updatedAt: Date
}): MovementStatus {
  if (params.blockedCompliance > 0 || params.activeStopWork > 0 || params.highIncidents > 0) return "blocked"
  const ageMinutes = Math.max(0, Math.round((Date.now() - params.updatedAt.getTime()) / 60000))
  if ((params.stage === "Outside" || params.stage === "Yard" || params.stage === "Weighbridge") && ageMinutes > 90) {
    return "delayed"
  }
  return "on_time"
}

function noteForRow(params: { blockedCompliance: number; activeStopWork: number; highIncidents: number; internal: boolean; stage: MovementStage }): string | undefined {
  if (!params.internal) return undefined
  if (params.activeStopWork > 0) return "HSE hold"
  if (params.blockedCompliance > 0) return "Doc missing"
  if (params.highIncidents > 0) return "Incident impact"
  if (params.stage === "Yard") return "Queue balancing"
  return undefined
}

export async function getMovementSnapshotForUser(user: SessionUser, limit = 25): Promise<MovementSnapshot> {
  const scoped = bookingScopeForUser(user)
  if (scoped.error) {
    throw new Error("Invalid user scope")
  }

  const bookingWhere = scoped.where
  const internal = user.role !== Role.CLIENT && user.role !== Role.TRANSPORTER
  const role = getUserRole(user)
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const trips = await prisma.truckTrip.findMany({
    where: {
      booking: bookingWhere,
    },
    include: {
      booking: {
        select: {
          id: true,
          bookingNo: true,
          status: true,
          client: { select: { name: true } },
          product: { select: { name: true } },
          stopWorkOrders: {
            where: { active: true },
            select: { id: true },
          },
          incidents: {
            where: {
              status: IncidentStatus.OPEN,
              severity: IncidentSeverity.HIGH,
            },
            select: { id: true },
          },
        },
      },
      complianceGates: {
        where: {
          status: { in: [ComplianceGateStatus.BLOCKED, ComplianceGateStatus.FAIL] },
        },
        take: 1,
        select: { id: true, status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(limit, 60),
  })

  const rows: MovementRow[] = trips.slice(0, limit).map((trip) => {
    const stage = toStage({
      custodyStage: String(trip.custodyStage || ""),
      status: trip.status,
      bookingStatus: trip.booking.status,
    })
    const blockedCompliance = trip.complianceGates.length
    const activeStopWork = trip.booking.stopWorkOrders.length
    const highIncidents = trip.booking.incidents.length
    const statusFlag = inferStatus({
      blockedCompliance,
      activeStopWork,
      highIncidents,
      stage,
      updatedAt: trip.updatedAt,
    })

    return {
      id: trip.id,
      updatedAt: trip.updatedAt.toISOString(),
      vehicleNo: trip.truckNumber,
      clientName: trip.booking.client?.name || undefined,
      product: trip.booking.product?.name || undefined,
      stage,
      statusFlag,
      note: noteForRow({
        blockedCompliance,
        activeStopWork,
        highIncidents,
        internal,
        stage,
      }),
      bookingId: trip.booking.id,
      truckId: trip.id,
    }
  })

  const safeRows = redactMovements(role, rows)
  const waitingOutside = safeRows.filter((row) => row.stage === "Outside").length
  const atWeighbridge = safeRows.filter((row) => row.stage === "Weighbridge").length
  const atInspection = safeRows.filter((row) => row.stage === "Inspection").length
  const atLoading = safeRows.filter((row) => row.stage === "Loading").length
  const insideTerminal = safeRows.filter((row) => ["Yard", "Loading", "Doc Clear", "Weighbridge", "Inspection"].includes(row.stage)).length

  const [completedToday, rejectedToday] = await Promise.all([
    prisma.truckTrip.count({
      where: {
        booking: bookingWhere,
        status: { in: [TruckTripStatus.EXITED, TruckTripStatus.COMPLETED] },
        updatedAt: { gte: startOfDay },
      },
    }),
    prisma.booking.count({
      where: {
        ...bookingWhere,
        status: BookingStatus.REJECTED,
        updatedAt: { gte: startOfDay },
      },
    }),
  ])

  const insights: BottleneckInsight[] = []
  const stageCounts = [
    { stage: "Outside", count: waitingOutside },
    { stage: "Yard", count: rows.filter((row) => row.stage === "Yard").length },
    { stage: "Weighbridge", count: atWeighbridge },
    { stage: "Loading", count: atLoading },
  ]
  const top = stageCounts.sort((a, b) => b.count - a.count)[0]
  if (top && top.count > 0) {
    insights.push({ key: "bottleneck", label: `Current bottleneck: ${top.stage} (${top.count} trucks)` })
  }
  const blocked = rows.filter((row) => row.statusFlag === "blocked").length
  if (blocked > 0) {
    insights.push({
      key: "risk",
      label: internal ? `Next risk: ${blocked} blocked movement(s)` : "Next risk: terminal clearance in progress",
    })
  }

  const alerts = safeRows
    .filter((row) => row.statusFlag === "blocked" || row.statusFlag === "delayed" || row.stage === "Loading")
    .slice(0, 10)

  const avgTurnaroundMin = 88

  return {
    rows: safeRows,
    alerts,
    insights: insights.slice(0, 2),
    metrics: {
      waitingOutside,
      insideTerminal,
      atWeighbridge,
      atInspection,
      atLoading,
      completedToday,
      rejectedToday,
      avgTurnaroundMin,
    },
  }
}
