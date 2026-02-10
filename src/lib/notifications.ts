import { prisma } from './prisma'
import { logger } from './logger'

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
      // Mocked email - just log to console
      logger.info(
        { to: params.userId, subject: params.subject },
        `[MOCKED EMAIL] ${params.subject}: ${params.body}`
      )
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
