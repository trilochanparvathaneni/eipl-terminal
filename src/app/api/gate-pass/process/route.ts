import { NextRequest, NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

type CheckState = { valid: boolean; detail: string }

function fromRiskFlags(riskFlags: unknown, patterns: string[]): boolean {
  const flags = Array.isArray(riskFlags) ? riskFlags.map((x) => String(x).toLowerCase()) : []
  return patterns.some((p) => flags.some((f) => f.includes(p)))
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    Role.SECURITY,
    Role.HSE_OFFICER,
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.TRAFFIC_CONTROLLER
  )
  if (error) return error

  const url = new URL(req.url)
  let truckNumber = (url.searchParams.get("truckNumber") ?? "").trim()
  const rawQuery = (url.searchParams.get("rawQuery") ?? "").trim()
  if (!truckNumber && rawQuery) {
    const parsed = rawQuery.match(/\b([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4})\b/i)
    if (parsed) truckNumber = parsed[1].toUpperCase()
  }

  const commonInclude = {
    booking: {
      include: {
        transporter: true,
        stopWorkOrders: {
          where: { active: true },
          take: 1,
        },
      },
    },
    complianceGates: {
      where: { gateType: "DOCUMENTS" as const },
      orderBy: { evaluatedAt: "desc" as const },
      take: 1,
    },
  }

  const trip = truckNumber
    ? await prisma.truckTrip.findFirst({
        where: {
          truckNumber: { equals: truckNumber, mode: "insensitive" },
          booking: user?.terminalId ? { terminalId: user.terminalId } : undefined,
        },
        orderBy: { createdAt: "desc" },
        include: commonInclude,
      })
    : await prisma.truckTrip.findFirst({
        where: {
          booking: user?.terminalId ? { terminalId: user.terminalId } : undefined,
        },
        orderBy: { createdAt: "desc" },
        include: commonInclude,
      })

  if (!trip) {
    return NextResponse.json(
      {
        status: "BLOCKED",
        truck_id: truckNumber,
        transporter_name: "Unknown",
        compliance_gap_summary: "Truck trip not found for the given truck number.",
        precheck: {
          peso_license_validity: { valid: false, detail: "Missing" },
          spark_arrestor_status: { valid: false, detail: "Missing" },
          earthing_relay_calibration: { valid: false, detail: "Missing" },
          rc_fitness_certificate: { valid: false, detail: "Missing" },
        },
        priority: "Critical",
      },
      { status: 404 }
    )
  }

  const hasDocumentGateFailure = trip.complianceGates.some((g) => g.status === "FAIL" || g.status === "BLOCKED")
  const hasStopWork = trip.booking.stopWorkOrders.length > 0
  const riskFlags = trip.riskFlags

  const pesoFlagged = fromRiskFlags(riskFlags, ["peso", "expired", "permit"])
  const sparkFlagged = fromRiskFlags(riskFlags, ["spark", "arrestor"])
  const earthingFlagged = fromRiskFlags(riskFlags, ["earthing", "relay"])
  const rcFlagged = fromRiskFlags(riskFlags, ["rc", "fitness"])

  const precheck: {
    peso_license_validity: CheckState
    spark_arrestor_status: CheckState
    earthing_relay_calibration: CheckState
    rc_fitness_certificate: CheckState
  } = {
    peso_license_validity: {
      valid: !pesoFlagged && !hasDocumentGateFailure,
      detail: pesoFlagged ? "Risk flag indicates expired PESO license" : "No PESO expiry flag detected",
    },
    spark_arrestor_status: {
      valid: !sparkFlagged && !hasDocumentGateFailure,
      detail: sparkFlagged ? "Risk flag indicates spark arrestor issue" : "No spark arrestor issue flagged",
    },
    earthing_relay_calibration: {
      valid: !earthingFlagged && !hasDocumentGateFailure,
      detail: earthingFlagged ? "Risk flag indicates earthing relay calibration issue" : "No earthing relay issue flagged",
    },
    rc_fitness_certificate: {
      valid: !rcFlagged && !hasDocumentGateFailure,
      detail: rcFlagged ? "Risk flag indicates RC fitness issue" : "No RC fitness issue flagged",
    },
  }

  const failedReasons: string[] = []
  if (!precheck.peso_license_validity.valid) failedReasons.push("PESO License check failed.")
  if (!precheck.spark_arrestor_status.valid) failedReasons.push("Spark Arrestor check failed.")
  if (!precheck.earthing_relay_calibration.valid) failedReasons.push("Earthing Relay calibration check failed.")
  if (!precheck.rc_fitness_certificate.valid) failedReasons.push("RC Fitness check failed.")
  if (hasStopWork) failedReasons.push("Active Stop-Work order is present for this booking.")

  const isBlocked = failedReasons.length > 0

  return NextResponse.json({
    status: isBlocked ? "BLOCKED" : "ACTION_REQUIRED",
    truck_id: trip.truckNumber,
    transporter_name: trip.booking.transporter?.name ?? "Unknown",
    compliance_gap_summary: isBlocked ? failedReasons.join(" ") : "",
    precheck,
    checklist: isBlocked
      ? undefined
      : [
          { id: "earthing_bond", label: "Physical Earthing Bond Connected" },
          { id: "iefcv_tested", label: "IEFCV (Internal Excess Flow Check Valve) Tested" },
          { id: "no_leaks", label: "No Leaks Detected at Manifold" },
        ],
    gatekeeper_action: isBlocked
      ? undefined
      : {
          label: "Issue Gate Pass",
          action_url: `/security/gate?truck=${encodeURIComponent(trip.truckNumber)}`,
        },
    priority: isBlocked ? "Critical" : "Warning",
  })
}
