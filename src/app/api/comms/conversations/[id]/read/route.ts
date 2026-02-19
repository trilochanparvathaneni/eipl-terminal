import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { assertConversationAccess } from "@/lib/comms/membership"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { error: accessError } = await assertConversationAccess(params.id, user!)
  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: accessError.status })
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: params.id, userId: user!.id } },
    data: { lastReadAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
