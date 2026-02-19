import { prisma } from './prisma'
import { logger } from './logger'
import { sendEmail } from './email/resend-client'

export async function sendNotification(params: {
  userId: string
  subject: string
  body: string
  channel?: 'EMAIL' | 'IN_APP'
}) {
  const channel = params.channel || 'IN_APP'

  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        channel,
        subject: params.subject,
        body: params.body,
      },
    })

    if (channel === 'EMAIL') {
      const userRecord = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      })
      if (userRecord?.email) {
        await sendEmail({
          to: userRecord.email,
          subject: params.subject,
          html: `<p>${params.body}</p>`,
        }).catch((err) => logger.error({ err }, 'Email delivery failed'))
      }
    }
  } catch (error) {
    logger.error({ error, params }, 'Failed to send notification')
  }
}

export async function notifyUsers(params: {
  userIds: string[]
  subject: string
  body: string
  channel?: 'EMAIL' | 'IN_APP'
}) {
  await Promise.all(
    params.userIds.map((userId) =>
      sendNotification({
        userId,
        subject: params.subject,
        body: params.body,
        channel: params.channel,
      })
    )
  )
}

export async function notifyByRole(params: {
  roles: string[]
  terminalId?: string
  subject: string
  body: string
}) {
  const users = await prisma.user.findMany({
    where: {
      role: { in: params.roles as any },
      isActive: true,
      ...(params.terminalId ? { terminalId: params.terminalId } : {}),
    },
    select: { id: true },
  })

  await notifyUsers({
    userIds: users.map((u) => u.id),
    subject: params.subject,
    body: params.body,
  })
}
