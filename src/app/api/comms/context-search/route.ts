import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!hasPermission(user!.role, "comms:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")
  const q = (searchParams.get("q") || "").trim()

  if (!type || !["BOOKING", "CLIENT", "TRANSPORTER", "INCIDENT"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }

  if (!q) {
    return NextResponse.json({ results: [] })
  }

  try {
    let results: { id: string; label: string }[] = []

    if (type === "BOOKING") {
      const bookings = await prisma.booking.findMany({
        where: {
          OR: [
            { bookingNo: { contains: q, mode: "insensitive" } },
            { client: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: { client: { select: { name: true } } },
        take: 10,
      })
      results = bookings.map((b) => ({
        id: b.id,
        label: `${b.bookingNo} — ${b.client.name}`,
      }))
    } else if (type === "CLIENT") {
      const clients = await prisma.client.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
      })
      results = clients.map((c) => ({ id: c.id, label: c.name }))
    } else if (type === "TRANSPORTER") {
      const transporters = await prisma.transporter.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
      })
      results = transporters.map((t) => ({ id: t.id, label: t.name }))
    } else if (type === "INCIDENT") {
      const incidents = await prisma.incident.findMany({
        where: { description: { contains: q, mode: "insensitive" } },
        take: 10,
        orderBy: { createdAt: "desc" },
      })
      results = incidents.map((i) => ({
        id: i.id,
        label: `${i.severity} — ${i.description.slice(0, 80)}`,
      }))
    }

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
