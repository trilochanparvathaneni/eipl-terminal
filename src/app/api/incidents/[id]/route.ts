import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { Role } from "@prisma/client"
import { enforceTerminalAccess } from "@/lib/auth/scope"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth(
    Role.HSE_OFFICER,
    Role.TERMINAL_ADMIN,
    Role.SUPER_ADMIN,
    Role.SECURITY,
    Role.AUDITOR,
    Role.SURVEYOR
  )
  if (error) return error

  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: {
      terminal: true,
      booking: {
        include: {
          client: true,
          product: true,
          transporter: true,
        },
      },
      reportedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  })

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 })
  }

  const terminalAccessError = enforceTerminalAccess(user!, incident.terminalId)
  if (terminalAccessError) return terminalAccessError

  return NextResponse.json(incident)
}
