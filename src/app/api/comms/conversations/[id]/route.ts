import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { assertConversationAccess } from "@/lib/comms/membership"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { conversation, error: accessError } = await assertConversationAccess(
    params.id,
    user!
  )

  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: accessError.status })
  }

  return NextResponse.json({ conversation })
}
