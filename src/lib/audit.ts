import { prisma } from './prisma'
import { logger } from './logger'

export async function createAuditLog(params: {
  actorUserId: string
  /** Terminal that this action belongs to. Stamped immutably at write time. */
  terminalId?: string | null
  entityType: string
  entityId: string
  action: string
  before?: any
  after?: any
  ipAddress?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        terminalId: params.terminalId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        beforeJson: params.before ? JSON.parse(JSON.stringify(params.before)) : undefined,
        afterJson: params.after ? JSON.parse(JSON.stringify(params.after)) : undefined,
        ipAddress: params.ipAddress,
      },
    })
  } catch (error) {
    logger.error({ error, params }, 'Failed to create audit log')
  }
}
