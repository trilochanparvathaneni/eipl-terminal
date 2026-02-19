import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email/resend-client"
import { buildDigestHtml } from "@/lib/email/digest-template"
import { logger } from "@/lib/logger"

export const maxDuration = 55

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Fetch all undigested mentions with full context
  const pendingMentions = await prisma.messageMention.findMany({
    where: { digestedAt: null },
    include: {
      message: {
        include: {
          sender: { select: { name: true } },
          conversation: { select: { title: true } },
        },
      },
      mentionedUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  if (pendingMentions.length === 0) {
    return NextResponse.json({ sent: 0, mentions: 0 })
  }

  // Group by mentionedUserId
  const byUser = new Map<
    string,
    {
      user: { id: string; name: string; email: string }
      mentions: typeof pendingMentions
    }
  >()

  for (const mention of pendingMentions) {
    const uid = mention.mentionedUser.id
    if (!byUser.has(uid)) {
      byUser.set(uid, { user: mention.mentionedUser, mentions: [] })
    }
    byUser.get(uid)!.mentions.push(mention)
  }

  const successIds: string[] = []
  let sentCount = 0

  for (const { user, mentions } of Array.from(byUser.values())) {
    if (!user.email) continue

    try {
      const html = buildDigestHtml({
        recipientName: user.name,
        mentions: mentions.map((m) => ({
          conversationTitle: m.message.conversation.title,
          senderName: m.message.sender.name,
          messageBody: m.message.body,
          createdAt: m.createdAt,
        })),
      })

      await sendEmail({
        to: user.email,
        subject: `EIPL Digest: ${mentions.length} unread mention${mentions.length !== 1 ? "s" : ""}`,
        html,
      })

      for (const m of mentions) successIds.push(m.id)
      sentCount++
    } catch (err) {
      logger.error({ err, userId: user.id }, "Digest email failed for user")
    }
  }

  // Stamp successfully-sent mentions as digested
  if (successIds.length > 0) {
    await prisma.messageMention.updateMany({
      where: { id: { in: successIds } },
      data: { digestedAt: now },
    })
  }

  return NextResponse.json({ sent: sentCount, mentions: successIds.length })
}
