import { prisma } from '@/lib/prisma'
import { ChangeoverState, BayStatus } from '@prisma/client'

export interface ArmValidationResult {
  valid: boolean
  reason?: string
  requiresChangeover: boolean
  compatibilityNotes?: string
}

/**
 * Validate whether a booking's product can be assigned to a specific loading arm.
 *
 * Rules:
 * 1. Arm must not be in MAINTENANCE or BLOCKED status.
 * 2. If arm has no current product (empty) -> OK.
 * 3. If arm.currentProductId == booking's productId -> OK (same product).
 * 4. If different product:
 *    a. arm.changeoverState must be READY_FOR_CHANGEOVER
 *    b. ProductCompatibility(from=arm.currentProductId, to=bookingProductId) must exist with isCompatible=true
 */
export async function validateArmAssignment(
  armId: string,
  bookingProductId: string
): Promise<ArmValidationResult> {
  const arm = await prisma.loadingArm.findUnique({
    where: { id: armId },
    include: { currentProduct: true, bay: true },
  })

  if (!arm) {
    return { valid: false, reason: 'Loading arm not found', requiresChangeover: false }
  }

  // Rule 1: Check arm status
  if (arm.status === BayStatus.MAINTENANCE) {
    return { valid: false, reason: `Arm ${arm.armNo} in ${arm.bay.uniqueCode} is under MAINTENANCE`, requiresChangeover: false }
  }
  if (arm.status === BayStatus.BLOCKED) {
    return { valid: false, reason: `Arm ${arm.armNo} in ${arm.bay.uniqueCode} is BLOCKED`, requiresChangeover: false }
  }
  if (arm.status === BayStatus.OCCUPIED) {
    return { valid: false, reason: `Arm ${arm.armNo} in ${arm.bay.uniqueCode} is currently OCCUPIED`, requiresChangeover: false }
  }

  // Rule 2: Empty arm
  if (!arm.currentProductId) {
    return { valid: true, requiresChangeover: false }
  }

  // Rule 3: Same product
  if (arm.currentProductId === bookingProductId) {
    return { valid: true, requiresChangeover: false }
  }

  // Rule 4: Different product - check changeover state + compatibility
  if (arm.changeoverState !== ChangeoverState.READY_FOR_CHANGEOVER) {
    return {
      valid: false,
      reason: `Arm ${arm.armNo} has ${arm.currentProduct?.name ?? 'unknown'} product. Changeover state is ${arm.changeoverState} (must be READY_FOR_CHANGEOVER)`,
      requiresChangeover: true,
    }
  }

  // Check compatibility
  const compat = await prisma.productCompatibility.findUnique({
    where: {
      fromProductId_toProductId: {
        fromProductId: arm.currentProductId,
        toProductId: bookingProductId,
      },
    },
  })

  if (!compat) {
    return {
      valid: false,
      reason: `No compatibility rule defined between ${arm.currentProduct?.name} and the requested product. Changeover not permitted.`,
      requiresChangeover: true,
    }
  }

  if (!compat.isCompatible) {
    return {
      valid: false,
      reason: `${arm.currentProduct?.name} -> requested product changeover is INCOMPATIBLE. ${compat.notes ?? ''}`,
      requiresChangeover: true,
      compatibilityNotes: compat.notes ?? undefined,
    }
  }

  // Enforce minimum clearance time since last changeover
  if (compat.minClearanceMinutes > 0 && arm.lastChangeoverAt) {
    const clearanceDeadline = new Date(
      arm.lastChangeoverAt.getTime() + compat.minClearanceMinutes * 60_000
    )
    const now = new Date()
    if (now < clearanceDeadline) {
      const remainingMs = clearanceDeadline.getTime() - now.getTime()
      const remainingMins = Math.ceil(remainingMs / 60_000)
      return {
        valid: false,
        reason: `Arm ${arm.armNo} requires ${compat.minClearanceMinutes} min clearance after last changeover. ${remainingMins} min remaining.`,
        requiresChangeover: true,
        compatibilityNotes: compat.notes ?? undefined,
      }
    }
  }

  return {
    valid: true,
    requiresChangeover: true,
    compatibilityNotes: compat.notes ?? undefined,
  }
}

/**
 * Find matching arms for a given product across all loading arms.
 * Returns arms grouped by bay with match quality.
 */
export async function findMatchingArms(productId: string) {
  const arms = await prisma.loadingArm.findMany({
    where: {
      status: { in: [BayStatus.IDLE] },
    },
    include: {
      currentProduct: true,
      bay: {
        include: { gantry: true },
      },
    },
    orderBy: [{ bay: { uniqueCode: 'asc' } }, { armNo: 'asc' }],
  })

  const matches: {
    armId: string
    armNo: number
    bayId: string
    bayCode: string
    gantryName: string
    currentProductName: string | null
    matchType: 'exact' | 'empty' | 'changeover_possible'
  }[] = []

  for (const arm of arms) {
    if (!arm.currentProductId) {
      matches.push({
        armId: arm.id,
        armNo: arm.armNo,
        bayId: arm.bayId,
        bayCode: arm.bay.uniqueCode,
        gantryName: arm.bay.gantry.name,
        currentProductName: null,
        matchType: 'empty',
      })
    } else if (arm.currentProductId === productId) {
      matches.push({
        armId: arm.id,
        armNo: arm.armNo,
        bayId: arm.bayId,
        bayCode: arm.bay.uniqueCode,
        gantryName: arm.bay.gantry.name,
        currentProductName: arm.currentProduct?.name ?? null,
        matchType: 'exact',
      })
    } else if (arm.changeoverState === ChangeoverState.READY_FOR_CHANGEOVER) {
      // Check compatibility
      const compat = await prisma.productCompatibility.findUnique({
        where: {
          fromProductId_toProductId: {
            fromProductId: arm.currentProductId,
            toProductId: productId,
          },
        },
      })
      if (compat?.isCompatible) {
        // Exclude arms still within the mandatory clearance window
        const now = new Date()
        const clearanceOk =
          !compat.minClearanceMinutes ||
          !arm.lastChangeoverAt ||
          now >=
            new Date(arm.lastChangeoverAt.getTime() + compat.minClearanceMinutes * 60_000)

        if (clearanceOk) {
          matches.push({
            armId: arm.id,
            armNo: arm.armNo,
            bayId: arm.bayId,
            bayCode: arm.bay.uniqueCode,
            gantryName: arm.bay.gantry.name,
            currentProductName: arm.currentProduct?.name ?? null,
            matchType: 'changeover_possible',
          })
        }
      }
    }
  }

  // Sort: exact matches first, then empty, then changeover
  matches.sort((a, b) => {
    const order = { exact: 0, empty: 1, changeover_possible: 2 }
    return order[a.matchType] - order[b.matchType]
  })

  return matches
}
