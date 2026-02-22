import "server-only"

import { BookingStatus, IncidentSeverity, IncidentStatus, Role, TruckTripStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { toAssistRole } from "@/lib/assist/policy"

export type OpsSnapshot = {
  generatedAt: string
  terminalId: string | null
  activeBays: {
    total: number | null
    active: number | null
    maintenance: number | null
    blocked: number | null
    idle: number | null
    lpgActive: number | null
    polOrChemicalActive: number | null
  }
  queue: {
    total: number | null
    yard: number | null
    queue: number | null
    weighbridge: number | null
    gantry: number | null
  }
  bookingsToday: {
    total: number | null
    lpg: number | null
    polOrChemical: number | null
  }
  safety: {
    openIncidentCount: number | null
    blockingIncidentCount: number | null
    activeStopWorkCount: number | null
    blockedComplianceCount: number | null
    terminalHalt: boolean | null
  }
  dataGaps: string[]
}

type SnapshotInput = {
  userRole: Role
  terminalId: string | null
  clientId?: string | null
}

export async function getOpsSnapshot(input: SnapshotInput): Promise<OpsSnapshot> {
  const dataGaps: string[] = []
  const assistRole = toAssistRole(input.userRole)
  const isClient = assistRole === "CLIENT"
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const terminalScopedWhere = input.terminalId ? { terminalId: input.terminalId } : {}

  let bays: Array<{ status: string; currentProduct: { category: string } | null }> | null = null
  try {
    if (!isClient) {
      bays = await prisma.bay.findMany({
        where: input.terminalId ? { gantry: { terminalId: input.terminalId } } : undefined,
        select: {
          status: true,
          currentProduct: { select: { category: true } },
        },
      })
    }
  } catch {
    dataGaps.push("bay_status_unavailable")
  }

  const bookingWhere: Record<string, unknown> = {
    ...terminalScopedWhere,
    date: { gte: start, lt: end },
  }
  if (isClient && input.clientId) {
    bookingWhere.clientId = input.clientId
  }

  const tripsWhere: Record<string, unknown> = {
    status: {
      in: [
        TruckTripStatus.PENDING,
        TruckTripStatus.QR_ISSUED,
        TruckTripStatus.ARRIVED,
        TruckTripStatus.IN_TERMINAL,
      ],
    },
    booking: terminalScopedWhere,
  }

  if (isClient && input.clientId) {
    ;(tripsWhere.booking as Record<string, unknown>).clientId = input.clientId
  }

  const [
    tripRows,
    bookingRows,
    openIncidentCount,
    blockingIncidentCount,
    activeStopWorkCount,
    blockedComplianceCount,
  ] = await Promise.all([
    prisma.truckTrip.findMany({
      where: tripsWhere,
      select: {
        custodyStage: true,
      },
      take: 500,
    }).catch(() => {
      dataGaps.push("trip_queue_unavailable")
      return []
    }),
    prisma.booking.findMany({
      where: bookingWhere,
      select: {
        product: { select: { category: true } },
        status: true,
      },
      take: 1000,
    }).catch(() => {
      dataGaps.push("bookings_unavailable")
      return []
    }),
    isClient
      ? Promise.resolve(null)
      : prisma.incident
          .count({
            where: {
              ...terminalScopedWhere,
              status: IncidentStatus.OPEN,
            },
          })
          .catch(() => {
            dataGaps.push("incidents_unavailable")
            return null
          }),
    isClient
      ? Promise.resolve(null)
      : prisma.incident
          .count({
            where: {
              ...terminalScopedWhere,
              status: IncidentStatus.OPEN,
              severity: IncidentSeverity.HIGH,
            },
          })
          .catch(() => {
            dataGaps.push("blocking_incidents_unavailable")
            return null
          }),
    isClient
      ? Promise.resolve(null)
      : prisma.stopWorkOrder
          .count({
            where: {
              active: true,
              booking: terminalScopedWhere,
            },
          })
          .catch(() => {
            dataGaps.push("stop_work_unavailable")
            return null
          }),
    isClient
      ? Promise.resolve(null)
      : prisma.complianceGateResult
          .count({
            where: {
              status: "BLOCKED",
              booking: terminalScopedWhere,
            },
          })
          .catch(() => {
            dataGaps.push("compliance_blocks_unavailable")
            return null
          }),
  ])

  const queueBreakdown = {
    yard: 0,
    queue: 0,
    weighbridge: 0,
    gantry: 0,
  }
  for (const trip of tripRows) {
    const stage = String(trip.custodyStage || "")
    if (stage === "GATE_CHECKIN") queueBreakdown.yard += 1
    else if (stage === "READY_FOR_BAY") queueBreakdown.queue += 1
    else if (stage === "WEIGH_IN" || stage === "WEIGH_OUT") queueBreakdown.weighbridge += 1
    else if (stage === "LOADING_STARTED") queueBreakdown.gantry += 1
    else queueBreakdown.queue += 1
  }

  let lpgToday = 0
  let polOrChemicalToday = 0
  for (const booking of bookingRows) {
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REJECTED) continue
    if (booking.product?.category === "LPG") lpgToday += 1
    else polOrChemicalToday += 1
  }

  const activeBays = {
    total: bays ? bays.length : null,
    active: bays ? bays.filter((b) => b.status === "IDLE" || b.status === "OCCUPIED").length : null,
    maintenance: bays ? bays.filter((b) => b.status === "MAINTENANCE").length : null,
    blocked: bays ? bays.filter((b) => b.status === "BLOCKED").length : null,
    idle: bays ? bays.filter((b) => b.status === "IDLE").length : null,
    lpgActive: bays
      ? bays.filter((b) => (b.status === "IDLE" || b.status === "OCCUPIED") && b.currentProduct?.category === "LPG").length
      : null,
    polOrChemicalActive: bays
      ? bays.filter((b) => (b.status === "IDLE" || b.status === "OCCUPIED") && b.currentProduct?.category !== "LPG").length
      : null,
  }

  const terminalHalt =
    openIncidentCount === null && activeStopWorkCount === null
      ? null
      : Boolean((blockingIncidentCount ?? 0) > 0 && (activeStopWorkCount ?? 0) > 0)

  return {
    generatedAt: new Date().toISOString(),
    terminalId: input.terminalId ?? null,
    activeBays,
    queue: {
      total: tripRows.length,
      yard: queueBreakdown.yard,
      queue: queueBreakdown.queue,
      weighbridge: queueBreakdown.weighbridge,
      gantry: queueBreakdown.gantry,
    },
    bookingsToday: {
      total: bookingRows.length,
      lpg: lpgToday,
      polOrChemical: polOrChemicalToday,
    },
    safety: {
      openIncidentCount,
      blockingIncidentCount,
      activeStopWorkCount,
      blockedComplianceCount,
      terminalHalt,
    },
    dataGaps,
  }
}
