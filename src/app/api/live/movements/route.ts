import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-utils"
import { getMovementSnapshotForUser } from "@/lib/live/movements"

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const snapshot = await getMovementSnapshotForUser(user, 25)
    return NextResponse.json(snapshot)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch live movements.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
