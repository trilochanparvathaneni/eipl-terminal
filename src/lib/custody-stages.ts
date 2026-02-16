import { CustodyStage } from '@prisma/client'

// Valid custody stage transitions
const CUSTODY_TRANSITIONS: Record<CustodyStage, CustodyStage[]> = {
  GATE_CHECKIN: [CustodyStage.SAFETY_APPROVED, CustodyStage.DOCUMENTS_VERIFIED],
  SAFETY_APPROVED: [CustodyStage.DOCUMENTS_VERIFIED, CustodyStage.READY_FOR_BAY],
  DOCUMENTS_VERIFIED: [CustodyStage.READY_FOR_BAY],
  WEIGH_IN: [CustodyStage.READY_FOR_BAY],
  READY_FOR_BAY: [CustodyStage.LOADING_STARTED],
  LOADING_STARTED: [CustodyStage.LOADING_COMPLETED],
  LOADING_COMPLETED: [CustodyStage.WEIGH_OUT],
  WEIGH_OUT: [CustodyStage.SEALED],
  SEALED: [CustodyStage.CUSTODY_TRANSFERRED],
  CUSTODY_TRANSFERRED: [CustodyStage.EXITED],
  EXITED: [],
}

export function canTransitionCustody(from: CustodyStage, to: CustodyStage): boolean {
  return CUSTODY_TRANSITIONS[from]?.includes(to) ?? false
}

export function getNextCustodyStages(current: CustodyStage): CustodyStage[] {
  return CUSTODY_TRANSITIONS[current] || []
}

export function custodyStageLabel(stage: CustodyStage): string {
  const labels: Record<CustodyStage, string> = {
    GATE_CHECKIN: 'Gate Check-in',
    SAFETY_APPROVED: 'Safety Approved',
    DOCUMENTS_VERIFIED: 'Documents Verified',
    WEIGH_IN: 'Weigh In',
    READY_FOR_BAY: 'Ready for Bay',
    LOADING_STARTED: 'Loading Started',
    LOADING_COMPLETED: 'Loading Completed',
    WEIGH_OUT: 'Weigh Out',
    SEALED: 'Sealed',
    CUSTODY_TRANSFERRED: 'Custody Transferred',
    EXITED: 'Exited',
  }
  return labels[stage] || stage
}
