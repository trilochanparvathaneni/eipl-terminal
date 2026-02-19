import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { searchMentionCandidates } from "@/lib/comms/mention-search"

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const url = new URL(req.url)
  const query = url.searchParams.get("q") || ""
  const conversationId = url.searchParams.get("conversationId") || undefined
  const moduleContext = url.searchParams.get("moduleContext") || undefined

  const results = await searchMentionCandidates({
    query,
    conversationId,
    moduleContext,
    user: user!,
  })

  return NextResponse.json(results)
}
