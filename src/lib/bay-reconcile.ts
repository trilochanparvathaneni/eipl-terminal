/**
 * Bay Status Reconciliation
 *
 * Keeps Bay.status in sync with active TruckTrip states so the two cannot
 * drift apart (e.g. Bay=OCCUPIED while the trip that occupied it has already
 * exited, or Bay=IDLE while a trip is actively loading).
 *
 * Call `reconcileBayStatuses()` after any custody-stage transition or
 * checkout that could affect bay occupancy.
 */

import { prisma } from './prisma'
import { logger } from './logger'

/**
 * Reconcile all bay statuses against active schedule blocks.
 *
 * Rules:
 * - A bay is OCCUPIED iff it has an ACTIVE schedule block whose trip is still
 *   in a loading custody stage (LOADING_STARTED → CUSTODY_TRANSFERRED).
 * - A bay is IDLE if it has no such block, unless it is MAINTENANCE or
 *   BLOCKED (controller-set states that must be cleared explicitly).
 *
 * Returns the number of bays that were corrected.
 */
export async function reconcileBayStatuses(): Promise<number> {
  const loadingStages = new Set([
    'LOADING_STARTED',
    'LOADING_COMPLETED',
    'WEIGH_OUT',
    'SEALED',
    'CUSTODY_TRANSFERRED',
  ])

  try {
    // Fetch all bays that are not in a controller-set state
    const bays = await prisma.bay.findMany({
      where: { status: { in: ['IDLE', 'OCCUPIED'] } },
      select: {
        id: true,
        status: true,
        scheduleBlocks: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            truckTrip: { select: { custodyStage: true, status: true } },
          },
        },
      },
    })

    let corrections = 0

    for (const bay of bays) {
      // Is there an ACTIVE block whose trip is genuinely loading?
      const hasActiveLoading = bay.scheduleBlocks.some(
        (block) =>
          loadingStages.has(block.truckTrip.custodyStage) &&
          block.truckTrip.status !== 'COMPLETED' &&
          block.truckTrip.status !== 'EXITED'
      )

      if (hasActiveLoading && bay.status !== 'OCCUPIED') {
        await prisma.bay.update({
          where: { id: bay.id },
          data: { status: 'OCCUPIED' },
        })
        logger.warn({ bayId: bay.id, correctedTo: 'OCCUPIED' }, 'Bay reconciled: was IDLE but has active loading trip')
        corrections++
      } else if (!hasActiveLoading && bay.status === 'OCCUPIED') {
        // Also clear lockedByTripId if the trip is gone
        await prisma.bay.update({
          where: { id: bay.id },
          data: { status: 'IDLE', lockedByTripId: null },
        })
        logger.warn({ bayId: bay.id, correctedTo: 'IDLE' }, 'Bay reconciled: was OCCUPIED but no active loading trip')
        corrections++
      }
    }

    if (corrections > 0) {
      logger.info({ corrections }, 'Bay status reconciliation completed')
    }

    return corrections
  } catch (err) {
    logger.error({ err }, 'Bay reconciliation failed')
    return 0
  }
}

/**
 * Reconcile a single bay after a state-changing operation.
 * Cheaper than full reconciliation when only one bay is affected.
 */
export async function reconcileSingleBay(bayId: string): Promise<void> {
  const loadingStages = new Set([
    'LOADING_STARTED',
    'LOADING_COMPLETED',
    'WEIGH_OUT',
    'SEALED',
    'CUSTODY_TRANSFERRED',
  ])

  try {
    const bay = await prisma.bay.findUnique({
      where: { id: bayId },
      select: {
        id: true,
        status: true,
        scheduleBlocks: {
          where: { status: 'ACTIVE' },
          select: {
            truckTrip: { select: { custodyStage: true, status: true } },
          },
        },
      },
    })

    if (!bay || bay.status === 'MAINTENANCE' || bay.status === 'BLOCKED') return

    const hasActiveLoading = bay.scheduleBlocks.some(
      (block) =>
        loadingStages.has(block.truckTrip.custodyStage) &&
        block.truckTrip.status !== 'COMPLETED' &&
        block.truckTrip.status !== 'EXITED'
    )

    if (hasActiveLoading && bay.status !== 'OCCUPIED') {
      await prisma.bay.update({ where: { id: bayId }, data: { status: 'OCCUPIED' } })
      logger.warn({ bayId, correctedTo: 'OCCUPIED' }, 'Single bay reconciled')
    } else if (!hasActiveLoading && bay.status === 'OCCUPIED') {
      await prisma.bay.update({ where: { id: bayId }, data: { status: 'IDLE', lockedByTripId: null } })
      logger.warn({ bayId, correctedTo: 'IDLE' }, 'Single bay reconciled')
    }
  } catch (err) {
    logger.error({ err, bayId }, 'Single bay reconciliation failed')
  }
}
