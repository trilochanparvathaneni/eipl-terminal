import {
  PrismaClient,
  Role,
  ProductCategory,
  BookingStatus,
  TruckTripStatus,
  GateEventType,
  ChecklistStatus,
  IncidentSeverity,
  IncidentStatus,
  NotificationChannel,
  BayStatus,
  ChangeoverState,
  CustodyStage,
  TripEventType,
  DocumentVerificationStatus,
  DocumentLinkType,
  ComplianceGateType,
  ComplianceGateStatus,
  PriorityClass,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Retry helper for remote DB connections that may drop
async function retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      if (i === retries - 1) throw err
      console.log(`  Warning: Connection error, retrying in ${delayMs}ms... (attempt ${i + 2}/${retries})`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw new Error('Unreachable')
}

function isDeadlockError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? '')
  return msg.includes('40P01') || msg.toLowerCase().includes('deadlock detected')
}

async function retryOnDeadlock<T>(fn: () => Promise<T>, label: string, retries = 5, delayMs = 1200): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (!isDeadlockError(err) || i === retries - 1) throw err
      console.log(`  Warning: deadlock during ${label}, retrying (${i + 2}/${retries})...`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw new Error(`Unreachable deadlock retry path for ${label}`)
}

// ─── Deterministic PRNG (Mulberry32) ───────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(20250101)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Constants ─────────────────────────────────────────────────────────────
const JAN2025_ACTIVE_DAYS = (() => {
  const days: Date[] = []
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(2025, 0, d)
    if (dt.getDay() !== 0) days.push(dt) // exclude Sundays
  }
  return days
})()

// 30-min slot definitions from 08:30 to 17:30
const SLOT_DEFS = [
  { start: '08:30', end: '09:00' },
  { start: '09:00', end: '09:30' },
  { start: '09:30', end: '10:00' },
  { start: '10:00', end: '10:30' },
  { start: '10:30', end: '11:00' },
  { start: '11:00', end: '11:30' },
  { start: '11:30', end: '12:00' },
  { start: '12:00', end: '12:30' },
  { start: '12:30', end: '13:00' },
  { start: '13:00', end: '13:30' },
  { start: '13:30', end: '14:00' },
  { start: '14:00', end: '14:30' },
  { start: '14:30', end: '15:00' },
  { start: '15:00', end: '15:30' },
  { start: '15:30', end: '16:00' },
  { start: '16:00', end: '16:30' },
  { start: '16:30', end: '17:00' },
  { start: '17:00', end: '17:30' },
]

// Target accepted per 30-min slot (must total 811)
const SLOT_ACCEPTED_TARGETS: number[] = [
  6, 22, 21, 37, 37, 41, 41, 54, 54, 56, 55, 65, 64, 60, 59, 49, 48, 42,
]

// Bay utilization targets (must total 811)
const BAY_DEFS = [
  { gantry: 1, bay: 3, code: 'G1B03', name: 'Bay 3', target: 224 },
  { gantry: 1, bay: 4, code: 'G1B04', name: 'Bay 4', target: 197 },
  { gantry: 1, bay: 5, code: 'G1B05', name: 'Bay 5', target: 173 },
  { gantry: 2, bay: 1, code: 'G2B01', name: 'Bay 1', target: 55 },
  { gantry: 2, bay: 3, code: 'G2B03', name: 'Bay 3', target: 53 },
  { gantry: 2, bay: 2, code: 'G2B02', name: 'Bay 2', target: 36 },
  { gantry: 2, bay: 4, code: 'G2B04', name: 'Bay 4', target: 23 },
  { gantry: 1, bay: 2, code: 'G1B02', name: 'Bay 2', target: 21 },
  { gantry: 1, bay: 7, code: 'G1B07', name: 'Bay 7', target: 16 },
  { gantry: 1, bay: 6, code: 'G1B06', name: 'Bay 6', target: 7 },
  { gantry: 1, bay: 8, code: 'G1B08', name: 'Bay 8', target: 6 },
]

// Client distribution
const CLIENT_DEFS = [
  { name: 'Trident Chemphar', email: 'ops@tridentchemphar.com', phone: '9812340001', addr: 'Vizag', attempts: 454, accepted: 387 },
  { name: 'Akin Chemicals', email: 'ops@akinchemicals.com', phone: '9812340002', addr: 'Vizag', attempts: 206, accepted: 135 },
  { name: 'Kanoria Chemicals', email: 'ops@kanoria.com', phone: '9812340003', addr: 'Vizag', attempts: 144, accepted: 121 },
  { name: 'Dr Reddys', email: 'ops@drreddys.com', phone: '9812340004', addr: 'Hyderabad', attempts: 83, accepted: 46 },
  { name: 'Aryann Chemicals', email: 'ops@aryann.com', phone: '9812340005', addr: 'Vizag', attempts: 80, accepted: 34 },
  { name: 'Reliance Industries', email: 'ops@reliance.com', phone: '9812340006', addr: 'Mumbai', attempts: 69, accepted: 66 },
  { name: 'Jupiter Dyechem', email: 'ops@jupiterdye.com', phone: '9812340007', addr: 'Vizag', attempts: 48, accepted: 22 },
]

// Overflow days
const OVERFLOW_DAYS: Record<number, { accepted: number; rejected: number }> = {
  18: { accepted: 59, rejected: 9 },
  20: { accepted: 63, rejected: 8 },
  23: { accepted: 53, rejected: 12 },
  24: { accepted: 52, rejected: 13 },
  27: { accepted: 57, rejected: 5 },
  29: { accepted: 52, rejected: 9 },
  31: { accepted: 63, rejected: 7 },
}

// Truck data generators
const TRUCK_STATES = ['AP', 'TS', 'MH', 'KA', 'TN', 'GJ', 'RJ']
const DRIVER_FIRST = ['Ramesh', 'Suresh', 'Mahesh', 'Rajesh', 'Ganesh', 'Naresh', 'Dinesh', 'Praveen', 'Vijay', 'Ravi', 'Sanjay', 'Anil', 'Sunil', 'Krishna', 'Murali', 'Srikanth', 'Venkat', 'Satish', 'Prasad', 'Mohan']
const DRIVER_LAST = ['Kumar', 'Reddy', 'Rao', 'Sharma', 'Singh', 'Patel', 'Naidu', 'Yadav', 'Das', 'Chowdhury']

function genTruckNo(idx: number): string {
  const st = TRUCK_STATES[idx % TRUCK_STATES.length]
  const dist = String(10 + (idx % 30)).padStart(2, '0')
  const letter = String.fromCharCode(65 + (idx % 26)) + String.fromCharCode(65 + ((idx * 7) % 26))
  const num = String(1000 + (idx * 17) % 9000).padStart(4, '0')
  return `${st}${dist}${letter}${num}`
}

function genDriverName(idx: number): string {
  return `${DRIVER_FIRST[idx % DRIVER_FIRST.length]} ${DRIVER_LAST[idx % DRIVER_LAST.length]}`
}

function genDriverPhone(idx: number): string {
  return `98${String(10000000 + idx * 13 + 7).padStart(8, '0')}`
}

// ─── Main seed ─────────────────────────────────────────────────────────────
async function main() {
  console.log('Wiping database for fresh seed...')

  await retryOnDeadlock(
    () =>
      prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          "EvidencePack",
          "ComplianceGateResult",
          "TripEvent",
          "DocumentRecord",
          "DocumentType",
          "AuditLog",
          "Notification",
          "Incident",
          "StopWorkOrder",
          "SafetyChecklist",
          "GateEvent",
          "BayScheduleBlock",
          "AIRecommendation",
          "TruckTrip",
          "BookingBayAllocation",
          "Booking",
          "TimeSlot",
          "InventoryLot",
          "ProductBayMap",
          "ProductCompatibility",
          "LoadingArm",
          "Bay",
          "Gantry",
          "User",
          "Transporter",
          "Client",
          "Product",
          "Terminal"
        RESTART IDENTITY CASCADE
      `),
    'truncate all domain tables'
  )

  console.log('Database wiped')

  const hash = (pw: string) => bcrypt.hashSync(pw, 10)
  const pw = hash('password123')

  // ─── Terminal ──────────────────────────────────────────────────────────
  const terminal = await prisma.terminal.create({
    data: { name: 'EIPL Vizag Terminal', location: 'Visakhapatnam, Andhra Pradesh' },
  })

  // ─── Gantries ─────────────────────────────────────────────────────────
  const gantry1 = await prisma.gantry.create({ data: { terminalId: terminal.id, name: 'Gantry 1' } })
  const gantry2 = await prisma.gantry.create({ data: { terminalId: terminal.id, name: 'Gantry 2' } })
  const gantry3 = await prisma.gantry.create({ data: { terminalId: terminal.id, name: 'LPG Gantry' } })
  const gantryMap: Record<number, string> = { 1: gantry1.id, 2: gantry2.id }

  // ─── Products (extended) ──────────────────────────────────────────────
  const methanol = await prisma.product.create({
    data: { name: 'Methanol', category: ProductCategory.CHEMICAL, isHazardous: true },
  })
  const lpg = await prisma.product.create({
    data: { name: 'LPG', category: ProductCategory.LPG, isHazardous: true },
  })
  const hsd = await prisma.product.create({
    data: { name: 'HSD', category: ProductCategory.POL, isHazardous: true },
  })
  const ldo = await prisma.product.create({
    data: { name: 'LDO', category: ProductCategory.POL, isHazardous: true },
  })
  const acetone = await prisma.product.create({
    data: { name: 'Acetone', category: ProductCategory.CHEMICAL, isHazardous: true },
  })
  const nhexane = await prisma.product.create({
    data: { name: 'N-Hexane', category: ProductCategory.CHEMICAL, isHazardous: true },
  })
  const ms = await prisma.product.create({
    data: { name: 'MS', category: ProductCategory.POL, isHazardous: true },
  })
  const acn = await prisma.product.create({
    data: { name: 'ACN', category: ProductCategory.CHEMICAL, isHazardous: true },
  })
  const vam = await prisma.product.create({
    data: { name: 'VAM', category: ProductCategory.CHEMICAL, isHazardous: true },
  })

  // Keep the first 3 as primary products for historical bookings
  const products = [methanol, lpg, hsd]
  // All products lookup by name
  const productByName: Record<string, typeof methanol> = {
    Methanol: methanol, LPG: lpg, HSD: hsd, LDO: ldo,
    Acetone: acetone, 'N-Hexane': nhexane, MS: ms, ACN: acn, VAM: vam,
  }

  // ─── Bays (Gantry-1: 8 bays, Gantry-2: 4 bays) ──────────────────────
  // Gantry-1 must have 8 bays with 3 loading arms each
  const g1Bays: Record<string, string> = {} // code -> id
  for (let b = 1; b <= 8; b++) {
    const code = `G1B${String(b).padStart(2, '0')}`
    const bay = await prisma.bay.create({
      data: {
        gantryId: gantry1.id,
        name: `Bay ${b}`,
        uniqueCode: code,
      },
    })
    g1Bays[code] = bay.id
  }

  // Gantry-2 bays
  const g2Bays: Record<string, string> = {}
  for (let b = 1; b <= 4; b++) {
    const code = `G2B${String(b).padStart(2, '0')}`
    const bay = await prisma.bay.create({
      data: {
        gantryId: gantry2.id,
        name: `Bay ${b}`,
        uniqueCode: code,
      },
    })
    g2Bays[code] = bay.id
  }

  // LPG Gantry - 2 bays
  const lpgBays: Record<string, string> = {}
  for (let b = 1; b <= 2; b++) {
    const code = `LPG${String(b).padStart(2, '0')}`
    const bay = await prisma.bay.create({
      data: {
        gantryId: gantry3.id,
        name: `LPG Bay ${b}`,
        uniqueCode: code,
        allowedMode: 'LPG',
      },
    })
    lpgBays[code] = bay.id
  }

  // Combined bay records for all gantries
  const bayRecords: Record<string, string> = { ...g1Bays, ...g2Bays, ...lpgBays }

  // ─── Loading Arms for Gantry-1 (exact product assignments) ────────────
  // Bay 1: Arm1=LDO, Arm2=Acetone, Arm3=N-Hexane
  // Bay 2: Arm1=Methanol, Arm2=MS, Arm3=N-Hexane
  // Bay 3: Arm1=Empty, Arm2=MS, Arm3=Empty
  // Bay 4: Arm1=Methanol, Arm2=Empty, Arm3=Methanol
  // Bay 5: Arm1=Methanol, Arm2=Empty, Arm3=Methanol
  // Bay 6: Arm1=Methanol, Arm2=LDO, Arm3=Methanol
  // Bay 7: Arm1=Empty, Arm2=HSD, Arm3=ACN
  // Bay 8: Arm1=Empty, Arm2=HSD, Arm3=VAM

  type ArmDef = { bayCode: string; armNo: number; product: string | null }
  const armDefs: ArmDef[] = [
    // Bay 1
    { bayCode: 'G1B01', armNo: 1, product: 'LDO' },
    { bayCode: 'G1B01', armNo: 2, product: 'Acetone' },
    { bayCode: 'G1B01', armNo: 3, product: 'N-Hexane' },
    // Bay 2
    { bayCode: 'G1B02', armNo: 1, product: 'Methanol' },
    { bayCode: 'G1B02', armNo: 2, product: 'MS' },
    { bayCode: 'G1B02', armNo: 3, product: 'N-Hexane' },
    // Bay 3
    { bayCode: 'G1B03', armNo: 1, product: null },
    { bayCode: 'G1B03', armNo: 2, product: 'MS' },
    { bayCode: 'G1B03', armNo: 3, product: null },
    // Bay 4
    { bayCode: 'G1B04', armNo: 1, product: 'Methanol' },
    { bayCode: 'G1B04', armNo: 2, product: null },
    { bayCode: 'G1B04', armNo: 3, product: 'Methanol' },
    // Bay 5
    { bayCode: 'G1B05', armNo: 1, product: 'Methanol' },
    { bayCode: 'G1B05', armNo: 2, product: null },
    { bayCode: 'G1B05', armNo: 3, product: 'Methanol' },
    // Bay 6
    { bayCode: 'G1B06', armNo: 1, product: 'Methanol' },
    { bayCode: 'G1B06', armNo: 2, product: 'LDO' },
    { bayCode: 'G1B06', armNo: 3, product: 'Methanol' },
    // Bay 7
    { bayCode: 'G1B07', armNo: 1, product: null },
    { bayCode: 'G1B07', armNo: 2, product: 'HSD' },
    { bayCode: 'G1B07', armNo: 3, product: 'ACN' },
    // Bay 8
    { bayCode: 'G1B08', armNo: 1, product: null },
    { bayCode: 'G1B08', armNo: 2, product: 'HSD' },
    { bayCode: 'G1B08', armNo: 3, product: 'VAM' },
  ]

  for (const ad of armDefs) {
    const prod = ad.product ? productByName[ad.product] : null
    await prisma.loadingArm.create({
      data: {
        bayId: bayRecords[ad.bayCode],
        armNo: ad.armNo,
        name: `Arm ${ad.armNo}`,
        currentProductId: prod?.id ?? null,
        status: BayStatus.IDLE,
        changeoverState: ad.product ? ChangeoverState.NOT_ALLOWED : ChangeoverState.READY_FOR_CHANGEOVER,
      },
    })
  }

  // Arms for Gantry-2 (2 arms per bay, generic)
  for (const [code, bayId] of Object.entries(g2Bays)) {
    for (let a = 1; a <= 2; a++) {
      await prisma.loadingArm.create({
        data: {
          bayId,
          armNo: a,
          name: `Arm ${a}`,
          status: BayStatus.IDLE,
          changeoverState: ChangeoverState.READY_FOR_CHANGEOVER,
        },
      })
    }
  }

  // Arms for LPG Gantry (1 arm per bay)
  for (const [code, bayId] of Object.entries(lpgBays)) {
    await prisma.loadingArm.create({
      data: {
        bayId,
        armNo: 1,
        name: 'LPG Arm',
        currentProductId: lpg.id,
        status: BayStatus.IDLE,
        changeoverState: ChangeoverState.NOT_ALLOWED,
      },
    })
  }

  console.log('Loading arms created for all gantries')

  // ─── Product Compatibility Matrix ──────────────────────────────────────
  const compatDefs: { from: string; to: string; compatible: boolean; clearance: boolean; minutes: number; notes: string }[] = [
    // Methanol with POL: incompatible
    { from: 'Methanol', to: 'HSD', compatible: false, clearance: true, minutes: 120, notes: 'CHEMICAL-POL cross-contamination risk' },
    { from: 'HSD', to: 'Methanol', compatible: false, clearance: true, minutes: 120, notes: 'POL-CHEMICAL cross-contamination risk' },
    { from: 'Methanol', to: 'LPG', compatible: false, clearance: true, minutes: 180, notes: 'Methanol-LPG incompatible, fire risk' },
    { from: 'LPG', to: 'Methanol', compatible: false, clearance: true, minutes: 180, notes: 'LPG-Methanol incompatible, fire risk' },
    { from: 'Methanol', to: 'LDO', compatible: false, clearance: true, minutes: 90, notes: 'CHEMICAL-POL not permitted' },
    { from: 'LDO', to: 'Methanol', compatible: false, clearance: true, minutes: 90, notes: 'POL-CHEMICAL not permitted' },
    { from: 'Methanol', to: 'MS', compatible: false, clearance: true, minutes: 90, notes: 'CHEMICAL-POL not permitted' },
    { from: 'MS', to: 'Methanol', compatible: false, clearance: true, minutes: 90, notes: 'POL-CHEMICAL not permitted' },

    // LDO <-> HSD: incompatible (different POL grades)
    { from: 'LDO', to: 'HSD', compatible: false, clearance: true, minutes: 60, notes: 'Different POL grades, contamination risk' },
    { from: 'HSD', to: 'LDO', compatible: false, clearance: true, minutes: 60, notes: 'Different POL grades, contamination risk' },

    // Acetone <-> N-Hexane: compatible with clearance (demonstrate changeover)
    { from: 'Acetone', to: 'N-Hexane', compatible: true, clearance: true, minutes: 45, notes: 'Compatible solvents, clearance required' },
    { from: 'N-Hexane', to: 'Acetone', compatible: true, clearance: true, minutes: 45, notes: 'Compatible solvents, clearance required' },

    // MS <-> HSD: compatible (similar POL)
    { from: 'MS', to: 'HSD', compatible: true, clearance: true, minutes: 30, notes: 'Similar POL grades, quick flush sufficient' },
    { from: 'HSD', to: 'MS', compatible: true, clearance: true, minutes: 30, notes: 'Similar POL grades, quick flush sufficient' },

    // ACN (chemical) incompatible with POL
    { from: 'ACN', to: 'HSD', compatible: false, clearance: true, minutes: 120, notes: 'CHEMICAL-POL incompatible' },
    { from: 'HSD', to: 'ACN', compatible: false, clearance: true, minutes: 120, notes: 'POL-CHEMICAL incompatible' },
    { from: 'ACN', to: 'LDO', compatible: false, clearance: true, minutes: 120, notes: 'CHEMICAL-POL incompatible' },
    { from: 'LDO', to: 'ACN', compatible: false, clearance: true, minutes: 120, notes: 'POL-CHEMICAL incompatible' },
    { from: 'ACN', to: 'MS', compatible: false, clearance: true, minutes: 120, notes: 'CHEMICAL-POL incompatible' },
    { from: 'MS', to: 'ACN', compatible: false, clearance: true, minutes: 120, notes: 'POL-CHEMICAL incompatible' },

    // VAM (chemical) incompatible with POL
    { from: 'VAM', to: 'HSD', compatible: false, clearance: true, minutes: 120, notes: 'CHEMICAL-POL incompatible' },
    { from: 'HSD', to: 'VAM', compatible: false, clearance: true, minutes: 120, notes: 'POL-CHEMICAL incompatible' },
    { from: 'VAM', to: 'LDO', compatible: false, clearance: true, minutes: 120, notes: 'CHEMICAL-POL incompatible' },
    { from: 'LDO', to: 'VAM', compatible: false, clearance: true, minutes: 120, notes: 'POL-CHEMICAL incompatible' },

    // Methanol <-> Acetone: compatible with clearance (both chemicals)
    { from: 'Methanol', to: 'Acetone', compatible: true, clearance: true, minutes: 60, notes: 'Both chemicals, clearance changeover OK' },
    { from: 'Acetone', to: 'Methanol', compatible: true, clearance: true, minutes: 60, notes: 'Both chemicals, clearance changeover OK' },

    // Methanol <-> N-Hexane: compatible with clearance
    { from: 'Methanol', to: 'N-Hexane', compatible: true, clearance: true, minutes: 60, notes: 'Both chemicals, clearance changeover OK' },
    { from: 'N-Hexane', to: 'Methanol', compatible: true, clearance: true, minutes: 60, notes: 'Both chemicals, clearance changeover OK' },

    // LDO <-> MS: compatible with clearance (similar POL)
    { from: 'LDO', to: 'MS', compatible: true, clearance: true, minutes: 30, notes: 'Similar POL, quick flush' },
    { from: 'MS', to: 'LDO', compatible: true, clearance: true, minutes: 30, notes: 'Similar POL, quick flush' },
  ]

  for (const cd of compatDefs) {
    await prisma.productCompatibility.create({
      data: {
        fromProductId: productByName[cd.from].id,
        toProductId: productByName[cd.to].id,
        isCompatible: cd.compatible,
        requiresFullClearance: cd.clearance,
        minClearanceMinutes: cd.minutes,
        notes: cd.notes,
      },
    })
  }
  console.log(`${compatDefs.length} product compatibility rules created`)

  // ─── Product-Bay Mappings (coarse level, kept for backward compat) ────
  const productBayPairs: [typeof methanol, string][] = [
    [methanol, 'G1B03'], [methanol, 'G1B04'], [methanol, 'G1B05'], [methanol, 'G1B06'], [methanol, 'G1B07'], [methanol, 'G1B08'],
    [lpg, 'LPG01'], [lpg, 'LPG02'],
    [hsd, 'G2B01'], [hsd, 'G2B03'], [hsd, 'G2B04'], [hsd, 'G1B02'], [hsd, 'G1B07'], [hsd, 'G1B08'],
    [ldo, 'G1B01'], [ldo, 'G1B06'],
    [acetone, 'G1B01'],
    [nhexane, 'G1B01'], [nhexane, 'G1B02'],
    [ms, 'G1B02'], [ms, 'G1B03'],
    [acn, 'G1B07'],
    [vam, 'G1B08'],
  ]
  for (const [prod, code] of productBayPairs) {
    if (bayRecords[code]) {
      await prisma.productBayMap.create({ data: { productId: prod.id, bayId: bayRecords[code] } })
    }
  }

  // ─── Clients ──────────────────────────────────────────────────────────
  const clientRecords: { id: string; name: string; attempts: number; accepted: number; rejected: number }[] = []
  for (const cd of CLIENT_DEFS) {
    const c = await prisma.client.create({
      data: { name: cd.name, email: cd.email, phone: cd.phone, address: cd.addr },
    })
    clientRecords.push({ id: c.id, name: c.name, attempts: cd.attempts, accepted: cd.accepted, rejected: cd.attempts - cd.accepted })
  }

  // ─── Transporters ────────────────────────────────────────────────────
  const transporter1 = await prisma.transporter.create({
    data: { name: 'SafeHaul Logistics', email: 'safehaul@example.com', phone: '9876543220', address: 'Vizag' },
  })
  const transporter2 = await prisma.transporter.create({
    data: { name: 'SpeedTankers Pvt Ltd', email: 'speedtankers@example.com', phone: '9876543221', address: 'Hyderabad' },
  })
  const transporter3 = await prisma.transporter.create({
    data: { name: 'Vizag Carriers', email: 'vizagcarriers@example.com', phone: '9876543222', address: 'Vizag' },
  })
  const transporterIds = [transporter1.id, transporter2.id, transporter3.id]

  // ─── Inventory Lots ───────────────────────────────────────────────────
  for (const cr of clientRecords) {
    for (const prod of products) {
      await prisma.inventoryLot.create({
        data: { clientId: cr.id, productId: prod.id, quantityAvailable: 5000, uom: prod.category === 'LPG' ? 'MT' : 'KL' },
      })
    }
  }

  // ─── Users ────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.create({
    data: { name: 'Super Admin', email: 'superadmin@eipl.com', passwordHash: pw, role: Role.SUPER_ADMIN, terminalId: terminal.id },
  })
  const terminalAdmin = await prisma.user.create({
    data: { name: 'Terminal Admin', email: 'admin@eipl.com', passwordHash: pw, role: Role.TERMINAL_ADMIN, terminalId: terminal.id },
  })
  const securityUser = await prisma.user.create({
    data: { name: 'Gate Security', email: 'security@eipl.com', passwordHash: pw, role: Role.SECURITY, terminalId: terminal.id },
  })
  const hseUser = await prisma.user.create({
    data: { name: 'HSE Officer Patel', email: 'hse@eipl.com', passwordHash: pw, role: Role.HSE_OFFICER, terminalId: terminal.id },
  })
  const surveyorUser = await prisma.user.create({
    data: { name: 'Surveyor Sharma', email: 'surveyor@eipl.com', passwordHash: pw, role: Role.SURVEYOR, terminalId: terminal.id },
  })
  await prisma.user.create({
    data: { name: 'Auditor Singh', email: 'auditor@eipl.com', passwordHash: pw, role: Role.AUDITOR, terminalId: terminal.id },
  })
  const controllerUser = await prisma.user.create({
    data: { name: 'Traffic Controller', email: 'controller@eipl.com', passwordHash: pw, role: Role.TRAFFIC_CONTROLLER, terminalId: terminal.id },
  })

  // Client users
  const clientUsers: Record<string, string> = {} // clientId -> userId
  for (const cr of clientRecords) {
    const slug = cr.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
    const u = await prisma.user.create({
      data: {
        name: `${cr.name} Manager`,
        email: `client@${slug}.com`,
        passwordHash: pw,
        role: Role.CLIENT,
        clientId: cr.id,
        terminalId: terminal.id,
      },
    })
    clientUsers[cr.id] = u.id
  }

  // Transporter users
  await prisma.user.create({
    data: { name: 'SafeHaul Dispatch', email: 'dispatch@safehaul.com', passwordHash: pw, role: Role.TRANSPORTER, transporterId: transporter1.id, terminalId: terminal.id },
  })
  await prisma.user.create({
    data: { name: 'SpeedTankers Ops', email: 'ops@speedtankers.com', passwordHash: pw, role: Role.TRANSPORTER, transporterId: transporter2.id, terminalId: terminal.id },
  })
  await prisma.user.create({
    data: { name: 'Vizag Carriers Ops', email: 'ops@vizagcarriers.com', passwordHash: pw, role: Role.TRANSPORTER, transporterId: transporter3.id, terminalId: terminal.id },
  })

  console.log('Infrastructure + users created')

  // ─── Document Types ───────────────────────────────────────────────────
  const docTypes = await Promise.all([
    prisma.documentType.create({
      data: {
        code: 'MSDS',
        name: 'Material Safety Data Sheet',
        description: 'Safety data sheet for hazardous chemical products',
        isMandatory: true,
        expiryRequired: true,
        versioned: true,
        allowedLinkTypes: [DocumentLinkType.BOOKING, DocumentLinkType.PRODUCT],
      },
    }),
    prisma.documentType.create({
      data: {
        code: 'COA',
        name: 'Certificate of Analysis',
        description: 'Lab certificate confirming product quality and specs',
        isMandatory: false,
        expiryRequired: true,
        versioned: true,
        allowedLinkTypes: [DocumentLinkType.BOOKING, DocumentLinkType.PRODUCT],
      },
    }),
    prisma.documentType.create({
      data: {
        code: 'EX_BOND',
        name: 'Ex-Bond Permission',
        description: 'Customs clearance for bonded cargo release',
        isMandatory: true,
        expiryRequired: false,
        versioned: false,
        allowedLinkTypes: [DocumentLinkType.BOOKING],
      },
    }),
    prisma.documentType.create({
      data: {
        code: 'DELIVERY_ORDER',
        name: 'Delivery Order',
        description: 'Authorization to release product from terminal',
        isMandatory: true,
        expiryRequired: false,
        versioned: false,
        allowedLinkTypes: [DocumentLinkType.BOOKING],
      },
    }),
    prisma.documentType.create({
      data: {
        code: 'EWAY_BILL',
        name: 'E-Way Bill',
        description: 'GST transport document for goods movement',
        isMandatory: true,
        expiryRequired: true,
        versioned: false,
        allowedLinkTypes: [DocumentLinkType.BOOKING, DocumentLinkType.TRUCK_TRIP],
      },
    }),
    prisma.documentType.create({
      data: {
        code: 'SURVEY_REPORT',
        name: 'Survey Report',
        description: 'Independent surveyor report on quantity/quality',
        isMandatory: false,
        expiryRequired: false,
        versioned: true,
        allowedLinkTypes: [DocumentLinkType.BOOKING, DocumentLinkType.TRUCK_TRIP],
      },
    }),
    prisma.documentType.create({
      data: {
        code: 'SAFETY_CERT',
        name: 'Vehicle Safety Certificate',
        description: 'Valid safety fitness certificate for the tanker',
        isMandatory: true,
        expiryRequired: true,
        versioned: false,
        allowedLinkTypes: [DocumentLinkType.TRUCK_TRIP],
      },
    }),
    prisma.documentType.create({
      data: {
        code: 'INSURANCE',
        name: 'Insurance Certificate',
        description: 'Vehicle/cargo insurance documents',
        isMandatory: false,
        expiryRequired: true,
        versioned: false,
        allowedLinkTypes: [DocumentLinkType.TRUCK_TRIP, DocumentLinkType.CLIENT],
      },
    }),
  ])

  const docTypeByCode: Record<string, string> = {}
  for (const dt of docTypes) {
    docTypeByCode[dt.code] = dt.id
  }
  console.log(`${docTypes.length} document types created`)

  // ─── TimeSlots for Jan 2025 ───────────────────────────────────────────
  const timeslotMap: Record<string, string> = {} // "YYYY-MM-DD|HH:MM" -> id
  for (const day of JAN2025_ACTIVE_DAYS) {
    for (const sl of SLOT_DEFS) {
      const ts = await prisma.timeSlot.create({
        data: {
          terminalId: terminal.id,
          date: day,
          startTime: sl.start,
          endTime: sl.end,
          capacityTrucks: 6,
        },
      })
      const dateStr = day.toISOString().split('T')[0]
      timeslotMap[`${dateStr}|${sl.start}`] = ts.id
    }
  }
  console.log(`${Object.keys(timeslotMap).length} timeslots created for ${JAN2025_ACTIVE_DAYS.length} active days`)

  // ─── Distribute bookings across days ──────────────────────────────────
  interface DayTarget {
    date: Date
    dateStr: string
    dayOfMonth: number
    accepted: number
    rejected: number
  }

  const overflowTotal = Object.values(OVERFLOW_DAYS)
  const overflowAccepted = overflowTotal.reduce((s, v) => s + v.accepted, 0)
  const overflowRejected = overflowTotal.reduce((s, v) => s + v.rejected, 0)
  const normalDays = JAN2025_ACTIVE_DAYS.filter((d) => !OVERFLOW_DAYS[d.getDate()])
  const remainAccepted = 811 - overflowAccepted
  const remainRejected = 273 - overflowRejected

  const normalDayTargets: DayTarget[] = []
  let accLeft = remainAccepted
  let rejLeft = remainRejected
  for (let i = 0; i < normalDays.length; i++) {
    const isLast = i === normalDays.length - 1
    const accShare = isLast ? accLeft : Math.round(remainAccepted / normalDays.length + (rng() - 0.5) * 6)
    const rejShare = isLast ? rejLeft : Math.round(remainRejected / normalDays.length + (rng() - 0.5) * 4)
    const acc = isLast ? accLeft : Math.min(Math.max(accShare, 15), 45)
    const rej = isLast ? rejLeft : Math.min(Math.max(rejShare, 5), 18)
    normalDayTargets.push({
      date: normalDays[i],
      dateStr: normalDays[i].toISOString().split('T')[0],
      dayOfMonth: normalDays[i].getDate(),
      accepted: acc,
      rejected: rej,
    })
    accLeft -= acc
    rejLeft -= rej
  }

  const dayTargets: DayTarget[] = [
    ...normalDayTargets,
    ...JAN2025_ACTIVE_DAYS.filter((d) => OVERFLOW_DAYS[d.getDate()]).map((d) => ({
      date: d,
      dateStr: d.toISOString().split('T')[0],
      dayOfMonth: d.getDate(),
      accepted: OVERFLOW_DAYS[d.getDate()].accepted,
      rejected: OVERFLOW_DAYS[d.getDate()].rejected,
    })),
  ].sort((a, b) => a.dayOfMonth - b.dayOfMonth)

  const totalAcc = dayTargets.reduce((s, d) => s + d.accepted, 0)
  const totalRej = dayTargets.reduce((s, d) => s + d.rejected, 0)
  console.log(`Day distribution: ${totalAcc} accepted + ${totalRej} rejected = ${totalAcc + totalRej} total`)

  // ─── Build per-slot accepted counts for the month ─────────────────────
  const slotDayAccepted: number[][] = []
  for (const dt of dayTargets) {
    const dayAcc = dt.accepted
    const totalTarget = SLOT_ACCEPTED_TARGETS.reduce((s, v) => s + v, 0)
    const raw = SLOT_ACCEPTED_TARGETS.map((t) => (t / totalTarget) * dayAcc)
    const rounded = raw.map((v) => Math.floor(v))
    let diff = dayAcc - rounded.reduce((s, v) => s + v, 0)
    const fracs = raw.map((v, i) => ({ i, frac: v - rounded[i] })).sort((a, b) => b.frac - a.frac)
    for (let k = 0; k < diff; k++) {
      rounded[fracs[k].i]++
    }
    slotDayAccepted.push(rounded)
  }

  // ─── Build bay assignment pool ────────────────────────────────────────
  const bayPool: string[] = []
  for (const bd of BAY_DEFS) {
    for (let i = 0; i < bd.target; i++) {
      bayPool.push(bd.code)
    }
  }
  const shuffledBayPool = shuffle(bayPool)
  let bayPoolIdx = 0

  // ─── Build client assignment pool ─────────────────────────────────────
  const clientAccPool: string[] = []
  const clientRejPool: string[] = []
  for (const cr of clientRecords) {
    for (let i = 0; i < cr.accepted; i++) clientAccPool.push(cr.id)
    for (let i = 0; i < cr.rejected; i++) clientRejPool.push(cr.id)
  }
  const shuffledClientAcc = shuffle(clientAccPool)
  const shuffledClientRej = shuffle(clientRejPool)
  let clientAccIdx = 0
  let clientRejIdx = 0

  // ─── Create all bookings ──────────────────────────────────────────────
  console.log('Creating bookings, trips, and gate events...')
  let bookingCounter = 0
  let truckIdx = 0
  const hazardousBookingIds: string[] = []
  const allAcceptedBookingIds: string[] = []

  for (let dayIdx = 0; dayIdx < dayTargets.length; dayIdx++) {
    const dt = dayTargets[dayIdx]
    const dayDate = dt.date

    interface AcceptedEntry {
      bookingNo: string; clientId: string; bayCode: string; product: typeof products[0];
      transporterId: string; timeSlotId: string; qty: number; isBulk: boolean;
      createdAt: Date; truckNo: string; driverName: string; driverPhone: string;
      qrToken: string; localTruckIdx: number; slotH: number; slotM: number;
      checkInTime: Date; checkOutTime: Date; tare: number; gross: number; net: number;
    }
    interface RejectedEntry {
      bookingNo: string; clientId: string; product: typeof products[0];
      transporterId: string; timeSlotId: string; qty: number;
      createdAt: Date; rejectedAtGate: boolean; truckNo?: string;
      driverName?: string; driverPhone?: string; qrToken?: string;
      localTruckIdx?: number; slotH?: number; slotM?: number; arrTime?: Date; reason?: string;
    }

    const acceptedEntries: AcceptedEntry[] = []
    const rejectedEntries: RejectedEntry[] = []

    for (let slotIdx = 0; slotIdx < SLOT_DEFS.length; slotIdx++) {
      const count = slotDayAccepted[dayIdx][slotIdx]
      for (let v = 0; v < count; v++) {
        bookingCounter++
        const clientId = shuffledClientAcc[clientAccIdx++]
        const bayCode = shuffledBayPool[bayPoolIdx++]
        const product = pick(products)
        const transporterId = pick(transporterIds)
        const slotKey = `${dt.dateStr}|${SLOT_DEFS[slotIdx].start}`
        const timeSlotId = timeslotMap[slotKey]
        const bookingNo = `BK25${String(bookingCounter).padStart(5, '0')}`
        const qty = product.category === 'LPG' ? randInt(8, 20) : randInt(10, 40)
        const localTruckIdx = truckIdx++

        const [slotH, slotM] = SLOT_DEFS[slotIdx].start.split(':').map(Number)
        const checkInTime = new Date(dayDate)
        checkInTime.setHours(slotH, slotM + randInt(0, 25), randInt(0, 59))
        const checkOutTime = new Date(checkInTime)
        checkOutTime.setMinutes(checkOutTime.getMinutes() + randInt(30, 90))
        const tare = parseFloat((randInt(80, 140) * 100 / 100).toFixed(1))
        const gross = parseFloat((tare + qty + randInt(-2, 2)).toFixed(1))
        const net = parseFloat((gross - tare).toFixed(1))

        acceptedEntries.push({
          bookingNo, clientId, bayCode, product, transporterId, timeSlotId, qty,
          isBulk: rng() < 0.1,
          createdAt: new Date(dayDate.getTime() - 86400000 * randInt(1, 3)),
          truckNo: genTruckNo(localTruckIdx), driverName: genDriverName(localTruckIdx),
          driverPhone: genDriverPhone(localTruckIdx),
          qrToken: `qr-${bookingNo}-${localTruckIdx}`, localTruckIdx,
          slotH, slotM, checkInTime, checkOutTime, tare, gross, net,
        })
      }
    }

    for (let r = 0; r < dt.rejected; r++) {
      bookingCounter++
      const clientId = shuffledClientRej[clientRejIdx++]
      const product = pick(products)
      const bookingNo = `BK25${String(bookingCounter).padStart(5, '0')}`
      const qty = product.category === 'LPG' ? randInt(8, 20) : randInt(10, 40)
      const slotIdx = randInt(0, SLOT_DEFS.length - 1)
      const slotKey = `${dt.dateStr}|${SLOT_DEFS[slotIdx].start}`
      const timeSlotId = timeslotMap[slotKey]
      const rejectedAtGate = rng() < 0.35

      const entry: RejectedEntry = {
        bookingNo, clientId, product,
        transporterId: pick(transporterIds), timeSlotId, qty,
        createdAt: new Date(dayDate.getTime() - 86400000 * randInt(1, 3)),
        rejectedAtGate,
      }

      if (rejectedAtGate) {
        const localTruckIdx = truckIdx++
        const [slotH, slotM] = SLOT_DEFS[slotIdx].start.split(':').map(Number)
        const arrTime = new Date(dayDate)
        arrTime.setHours(slotH, slotM + randInt(0, 25), randInt(0, 59))
        const reasons = ['Slot missed', 'Safety check failed', 'Documentation incomplete', 'Vehicle condition unsatisfactory', 'Overweight']
        entry.truckNo = genTruckNo(localTruckIdx)
        entry.driverName = genDriverName(localTruckIdx)
        entry.driverPhone = genDriverPhone(localTruckIdx)
        entry.qrToken = `qr-${bookingNo}-${localTruckIdx}`
        entry.localTruckIdx = localTruckIdx
        entry.slotH = slotH; entry.slotM = slotM
        entry.arrTime = arrTime
        entry.reason = pick(reasons)
      }
      rejectedEntries.push(entry)
    }

    const created = await retry(() => prisma.$transaction(async (tx) => {
      const acceptedIds: string[] = []
      const hazardousIds: string[] = []

      for (const e of acceptedEntries) {
        const booking = await tx.booking.create({
          data: {
            bookingNo: e.bookingNo, terminalId: terminal.id, clientId: e.clientId,
            productId: e.product.id, quantityRequested: e.qty, date: dayDate,
            timeSlotId: e.timeSlotId, transporterId: e.transporterId,
            status: BookingStatus.CLOSED, isBulk: e.isBulk,
            createdByUserId: clientUsers[e.clientId], createdAt: e.createdAt,
          },
        })
        acceptedIds.push(booking.id)
        if (e.product.isHazardous) hazardousIds.push(booking.id)

        await tx.bookingBayAllocation.create({
          data: {
            bookingId: booking.id, bayId: bayRecords[e.bayCode],
            allocatedByUserId: terminalAdmin.id,
            allocatedAt: new Date(dayDate.getTime() - 86400000),
          },
        })

        const truckTrip = await tx.truckTrip.create({
          data: {
            bookingId: booking.id, truckNumber: e.truckNo, driverName: e.driverName,
            driverPhone: e.driverPhone, qrToken: e.qrToken,
            status: TruckTripStatus.COMPLETED,
            custodyStage: CustodyStage.EXITED,
          },
        })

        await tx.gateEvent.create({
          data: {
            truckTripId: truckTrip.id, type: GateEventType.CHECK_IN,
            timestamp: e.checkInTime, securityUserId: securityUser.id,
            photoTruckUrl: `/photos/truck-${e.bookingNo}-in.jpg`,
            photoDriverUrl: `/photos/driver-${e.bookingNo}-in.jpg`,
            weighmentTare: e.tare,
          },
        })

        await tx.gateEvent.create({
          data: {
            truckTripId: truckTrip.id, type: GateEventType.CHECK_OUT,
            timestamp: e.checkOutTime, securityUserId: securityUser.id,
            photoTruckUrl: `/photos/truck-${e.bookingNo}-out.jpg`,
            weighmentGross: e.gross, netQuantity: e.net,
          },
        })
      }

      for (const e of rejectedEntries) {
        const booking = await tx.booking.create({
          data: {
            bookingNo: e.bookingNo, terminalId: terminal.id, clientId: e.clientId,
            productId: e.product.id, quantityRequested: e.qty, date: dayDate,
            timeSlotId: e.timeSlotId, transporterId: e.transporterId,
            status: BookingStatus.REJECTED, isBulk: false,
            createdByUserId: clientUsers[e.clientId], createdAt: e.createdAt,
          },
        })

        if (e.rejectedAtGate) {
          const trip = await tx.truckTrip.create({
            data: {
              bookingId: booking.id, truckNumber: e.truckNo!, driverName: e.driverName!,
              driverPhone: e.driverPhone!, qrToken: e.qrToken!,
              status: TruckTripStatus.QR_ISSUED,
              custodyStage: CustodyStage.GATE_CHECKIN,
            },
          })
          await tx.gateEvent.create({
            data: {
              truckTripId: trip.id, type: GateEventType.CHECK_IN,
              timestamp: e.arrTime!, securityUserId: securityUser.id,
              payloadJson: { rejectedAtGate: true, reason: e.reason },
            },
          })
        }
      }
      return { acceptedIds, hazardousIds }
    }, { timeout: 60000 }))
    allAcceptedBookingIds.push(...created.acceptedIds)
    hazardousBookingIds.push(...created.hazardousIds)

    if (dayIdx % 5 === 0) {
      console.log(`  Day ${dt.dayOfMonth} Jan: ${dt.accepted} accepted, ${dt.rejected} rejected`)
    }
  }

  console.log(`${bookingCounter} bookings created (${allAcceptedBookingIds.length} accepted, ${bookingCounter - allAcceptedBookingIds.length} rejected)`)

  // ─── Safety Checklists ────────────────────────────────────────────────
  console.log('Creating safety data...')
  const hazardousForChecklist = shuffle(hazardousBookingIds).slice(0, Math.ceil(hazardousBookingIds.length * 0.6))
  for (let i = 0; i < hazardousForChecklist.length; i += 50) {
    const chunk = hazardousForChecklist.slice(i, i + 50)
    await retry(() => prisma.$transaction(async (tx) => {
      for (const bId of chunk) {
        const passed = rng() < 0.88
        await tx.safetyChecklist.create({
          data: {
            bookingId: bId,
            createdByHseId: hseUser.id,
            status: passed ? ChecklistStatus.PASSED : ChecklistStatus.FAILED,
            checklistJson: {
              ppe: true,
              earthing: passed,
              leakCheck: passed,
              fireSystemReadiness: passed || rng() < 0.5,
              additionalNotes: passed ? 'All checks passed' : 'Failed earthing/leak check',
            },
          },
        })
      }
    }, { timeout: 30000 }))
  }
  console.log(`  ${hazardousForChecklist.length} safety checklists created`)

  // ─── Stop Work Orders ─────────────────────────────────────────────────
  const stopWorkBookings = shuffle(allAcceptedBookingIds).slice(0, 5)
  const stopWorkReasons = [
    'Gas leak detected near loading bay',
    'Earthing connection failure during loading',
    'Driver PPE non-compliance',
    'Fire suppression system malfunction',
    'Unauthorized vehicle in restricted zone',
  ]
  for (let i = 0; i < 5; i++) {
    const isActive = i < 2
    const createdDate = new Date(2025, 0, randInt(5, 28))
    await prisma.stopWorkOrder.create({
      data: {
        bookingId: stopWorkBookings[i],
        issuedByHseId: hseUser.id,
        reason: stopWorkReasons[i],
        active: isActive,
        createdAt: createdDate,
        resolvedAt: isActive ? null : new Date(createdDate.getTime() + randInt(2, 48) * 3600000),
      },
    })
  }
  console.log('  5 stop work orders created (2 active)')

  // ─── Incidents ────────────────────────────────────────────────────────
  const incidentDescs = [
    { desc: 'Minor chemical spill near Gantry 1 Bay 3 during methanol loading', sev: IncidentSeverity.MED },
    { desc: 'Driver reported dizziness due to fume exposure at Bay 5', sev: IncidentSeverity.HIGH },
    { desc: 'Truck tire blowout inside terminal compound', sev: IncidentSeverity.LOW },
    { desc: 'Earthing wire disconnected during loading at G2 Bay 1', sev: IncidentSeverity.MED },
    { desc: 'Unauthorized pedestrian crossing in active loading zone', sev: IncidentSeverity.LOW },
    { desc: 'LPG valve leak detected - emergency shutdown initiated', sev: IncidentSeverity.HIGH },
    { desc: 'Minor collision between two trucks in parking area', sev: IncidentSeverity.MED },
    { desc: 'Fire extinguisher found expired during routine check', sev: IncidentSeverity.LOW },
    { desc: 'Spillage during HSD transfer - contained within bund wall', sev: IncidentSeverity.MED },
    { desc: 'Security camera failure in Gate 2 area', sev: IncidentSeverity.LOW },
  ]
  for (let i = 0; i < 10; i++) {
    const inc = incidentDescs[i]
    const isClosed = i < 7
    const createdDate = new Date(2025, 0, randInt(2, 30))
    await prisma.incident.create({
      data: {
        terminalId: terminal.id,
        bookingId: i < 4 ? allAcceptedBookingIds[randInt(0, 100)] : null,
        reportedByUserId: i % 2 === 0 ? hseUser.id : securityUser.id,
        severity: inc.sev,
        description: inc.desc,
        status: isClosed ? IncidentStatus.CLOSED : IncidentStatus.OPEN,
        createdAt: createdDate,
        closedAt: isClosed ? new Date(createdDate.getTime() + randInt(1, 72) * 3600000) : null,
      },
    })
  }
  console.log('  10 incidents created (7 closed, 3 open)')

  // ─── Sample Active Bookings with Compliance States ────────────────────
  // Create today's bookings that exercise the compliance pipeline
  console.log('Creating sample compliance flow bookings...')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Create a today timeslot
  const todaySlot = await prisma.timeSlot.create({
    data: { terminalId: terminal.id, date: today, startTime: '10:00', endTime: '10:30', capacityTrucks: 6 },
  })

  const sampleTrips: { tripId: string; bookingId: string; label: string }[] = []

  // Trip 1: Methanol booking - all docs verified, safety passed, READY_FOR_BAY
  {
    const booking = await prisma.booking.create({
      data: {
        bookingNo: 'BK26DEMO01',
        terminalId: terminal.id,
        clientId: clientRecords[0].id,
        productId: methanol.id,
        quantityRequested: 25,
        date: today,
        timeSlotId: todaySlot.id,
        transporterId: transporter1.id,
        status: BookingStatus.IN_TERMINAL,
        createdByUserId: clientUsers[clientRecords[0].id],
      },
    })
    const trip = await prisma.truckTrip.create({
      data: {
        bookingId: booking.id,
        truckNumber: 'AP12AB1234',
        driverName: 'Ramesh Kumar',
        driverPhone: '9876543210',
        qrToken: 'qr-demo-01',
        status: TruckTripStatus.IN_TERMINAL,
        custodyStage: CustodyStage.READY_FOR_BAY,
        readyForBayAt: new Date(),
        priorityClass: PriorityClass.APPOINTMENT,
        appointmentStart: new Date(today.getTime() + 10 * 3600000),
        appointmentEnd: new Date(today.getTime() + 10.5 * 3600000),
      },
    })
    // Create compliance gate results
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.SAFETY, status: ComplianceGateStatus.PASS, evaluatedByUserId: hseUser.id },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.DOCUMENTS, status: ComplianceGateStatus.PASS, evaluatedByUserId: terminalAdmin.id },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.STOP_WORK, status: ComplianceGateStatus.PASS },
    })
    // Safety checklist
    await prisma.safetyChecklist.create({
      data: { bookingId: booking.id, createdByHseId: hseUser.id, status: ChecklistStatus.PASSED, checklistJson: { ppe: true, earthing: true, leakCheck: true } },
    })
    // Documents
    for (const code of ['MSDS', 'EX_BOND', 'DELIVERY_ORDER', 'EWAY_BILL']) {
      await prisma.documentRecord.create({
        data: {
          documentTypeId: docTypeByCode[code],
          linkType: DocumentLinkType.BOOKING,
          linkId: booking.id,
          fileUrl: `/docs/demo/${code.toLowerCase()}_demo01.pdf`,
          verificationStatus: DocumentVerificationStatus.VERIFIED,
          verifiedByUserId: terminalAdmin.id,
          verifiedAt: new Date(),
          expiryDate: code === 'MSDS' || code === 'EWAY_BILL' ? new Date(today.getTime() + 90 * 86400000) : null,
        },
      })
    }
    // Trip events
    await prisma.tripEvent.create({
      data: { truckTripId: trip.id, bookingId: booking.id, type: TripEventType.STAGE_CHANGE, stage: CustodyStage.GATE_CHECKIN, message: 'Truck checked in at gate', actorUserId: securityUser.id },
    })
    await prisma.tripEvent.create({
      data: { truckTripId: trip.id, bookingId: booking.id, type: TripEventType.STAGE_CHANGE, stage: CustodyStage.SAFETY_APPROVED, message: 'Safety checklist passed', actorUserId: hseUser.id },
    })
    await prisma.tripEvent.create({
      data: { truckTripId: trip.id, bookingId: booking.id, type: TripEventType.COMPLIANCE_CLEARED, stage: CustodyStage.READY_FOR_BAY, message: 'All compliance gates passed', actorUserId: terminalAdmin.id },
    })
    sampleTrips.push({ tripId: trip.id, bookingId: booking.id, label: 'Ready for bay' })
  }

  // Trip 2: Methanol booking - docs missing (BLOCKED)
  {
    const booking = await prisma.booking.create({
      data: {
        bookingNo: 'BK26DEMO02',
        terminalId: terminal.id,
        clientId: clientRecords[1].id,
        productId: methanol.id,
        quantityRequested: 30,
        date: today,
        timeSlotId: todaySlot.id,
        transporterId: transporter2.id,
        status: BookingStatus.IN_TERMINAL,
        createdByUserId: clientUsers[clientRecords[1].id],
      },
    })
    const trip = await prisma.truckTrip.create({
      data: {
        bookingId: booking.id,
        truckNumber: 'TS14CD5678',
        driverName: 'Suresh Reddy',
        driverPhone: '9876543211',
        qrToken: 'qr-demo-02',
        status: TruckTripStatus.IN_TERMINAL,
        custodyStage: CustodyStage.GATE_CHECKIN,
        priorityClass: PriorityClass.BLOCKED,
      },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.SAFETY, status: ComplianceGateStatus.PASS, evaluatedByUserId: hseUser.id },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.DOCUMENTS, status: ComplianceGateStatus.FAIL, reason: 'Missing EX_BOND and DELIVERY_ORDER', evaluatedByUserId: terminalAdmin.id },
    })
    await prisma.safetyChecklist.create({
      data: { bookingId: booking.id, createdByHseId: hseUser.id, status: ChecklistStatus.PASSED, checklistJson: { ppe: true, earthing: true, leakCheck: true } },
    })
    // Only MSDS uploaded, missing EX_BOND and DELIVERY_ORDER
    await prisma.documentRecord.create({
      data: {
        documentTypeId: docTypeByCode['MSDS'],
        linkType: DocumentLinkType.BOOKING,
        linkId: booking.id,
        fileUrl: `/docs/demo/msds_demo02.pdf`,
        verificationStatus: DocumentVerificationStatus.VERIFIED,
        verifiedByUserId: terminalAdmin.id,
        verifiedAt: new Date(),
        expiryDate: new Date(today.getTime() + 90 * 86400000),
      },
    })
    await prisma.tripEvent.create({
      data: { truckTripId: trip.id, bookingId: booking.id, type: TripEventType.COMPLIANCE_BLOCKED, stage: CustodyStage.GATE_CHECKIN, message: 'Blocked: missing EX_BOND and DELIVERY_ORDER', actorUserId: terminalAdmin.id },
    })
    sampleTrips.push({ tripId: trip.id, bookingId: booking.id, label: 'Blocked - missing docs' })
  }

  // Trip 3: HSD booking - safety failed (BLOCKED)
  {
    const booking = await prisma.booking.create({
      data: {
        bookingNo: 'BK26DEMO03',
        terminalId: terminal.id,
        clientId: clientRecords[2].id,
        productId: hsd.id,
        quantityRequested: 20,
        date: today,
        timeSlotId: todaySlot.id,
        transporterId: transporter3.id,
        status: BookingStatus.IN_TERMINAL,
        createdByUserId: clientUsers[clientRecords[2].id],
      },
    })
    const trip = await prisma.truckTrip.create({
      data: {
        bookingId: booking.id,
        truckNumber: 'MH16EF9012',
        driverName: 'Mahesh Rao',
        driverPhone: '9876543212',
        qrToken: 'qr-demo-03',
        status: TruckTripStatus.IN_TERMINAL,
        custodyStage: CustodyStage.GATE_CHECKIN,
        priorityClass: PriorityClass.BLOCKED,
      },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.SAFETY, status: ComplianceGateStatus.FAIL, reason: 'Earthing check failed', evaluatedByUserId: hseUser.id },
    })
    await prisma.safetyChecklist.create({
      data: { bookingId: booking.id, createdByHseId: hseUser.id, status: ChecklistStatus.FAILED, checklistJson: { ppe: true, earthing: false, leakCheck: true } },
    })
    await prisma.tripEvent.create({
      data: { truckTripId: trip.id, bookingId: booking.id, type: TripEventType.COMPLIANCE_BLOCKED, stage: CustodyStage.GATE_CHECKIN, message: 'Blocked: safety checklist FAILED', actorUserId: hseUser.id },
    })
    sampleTrips.push({ tripId: trip.id, bookingId: booking.id, label: 'Blocked - safety failed' })
  }

  // Trip 4: LDO booking - all passed, READY_FOR_BAY
  {
    const booking = await prisma.booking.create({
      data: {
        bookingNo: 'BK26DEMO04',
        terminalId: terminal.id,
        clientId: clientRecords[3].id,
        productId: ldo.id,
        quantityRequested: 18,
        date: today,
        timeSlotId: todaySlot.id,
        transporterId: transporter1.id,
        status: BookingStatus.IN_TERMINAL,
        createdByUserId: clientUsers[clientRecords[3].id],
      },
    })
    const trip = await prisma.truckTrip.create({
      data: {
        bookingId: booking.id,
        truckNumber: 'KA18GH3456',
        driverName: 'Rajesh Sharma',
        driverPhone: '9876543213',
        qrToken: 'qr-demo-04',
        status: TruckTripStatus.IN_TERMINAL,
        custodyStage: CustodyStage.READY_FOR_BAY,
        readyForBayAt: new Date(),
        priorityClass: PriorityClass.FCFS,
      },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.SAFETY, status: ComplianceGateStatus.PASS, evaluatedByUserId: hseUser.id },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.DOCUMENTS, status: ComplianceGateStatus.PASS, evaluatedByUserId: terminalAdmin.id },
    })
    await prisma.complianceGateResult.create({
      data: { truckTripId: trip.id, bookingId: booking.id, gateType: ComplianceGateType.STOP_WORK, status: ComplianceGateStatus.PASS },
    })
    await prisma.safetyChecklist.create({
      data: { bookingId: booking.id, createdByHseId: hseUser.id, status: ChecklistStatus.PASSED, checklistJson: { ppe: true, earthing: true, leakCheck: true } },
    })
    for (const code of ['MSDS', 'DELIVERY_ORDER', 'EWAY_BILL']) {
      await prisma.documentRecord.create({
        data: {
          documentTypeId: docTypeByCode[code],
          linkType: DocumentLinkType.BOOKING,
          linkId: booking.id,
          fileUrl: `/docs/demo/${code.toLowerCase()}_demo04.pdf`,
          verificationStatus: DocumentVerificationStatus.VERIFIED,
          verifiedByUserId: terminalAdmin.id,
          verifiedAt: new Date(),
        },
      })
    }
    sampleTrips.push({ tripId: trip.id, bookingId: booking.id, label: 'Ready for bay (LDO)' })
  }

  // Trip 5: Methanol booking - docs pending verification
  {
    const booking = await prisma.booking.create({
      data: {
        bookingNo: 'BK26DEMO05',
        terminalId: terminal.id,
        clientId: clientRecords[4].id,
        productId: methanol.id,
        quantityRequested: 22,
        date: today,
        timeSlotId: todaySlot.id,
        transporterId: transporter2.id,
        status: BookingStatus.IN_TERMINAL,
        createdByUserId: clientUsers[clientRecords[4].id],
      },
    })
    const trip = await prisma.truckTrip.create({
      data: {
        bookingId: booking.id,
        truckNumber: 'TN20IJ7890',
        driverName: 'Ganesh Singh',
        driverPhone: '9876543214',
        qrToken: 'qr-demo-05',
        status: TruckTripStatus.IN_TERMINAL,
        custodyStage: CustodyStage.GATE_CHECKIN,
        priorityClass: PriorityClass.FCFS,
      },
    })
    // Docs uploaded but pending verification
    for (const code of ['MSDS', 'EX_BOND', 'DELIVERY_ORDER']) {
      await prisma.documentRecord.create({
        data: {
          documentTypeId: docTypeByCode[code],
          linkType: DocumentLinkType.BOOKING,
          linkId: booking.id,
          fileUrl: `/docs/demo/${code.toLowerCase()}_demo05.pdf`,
          verificationStatus: DocumentVerificationStatus.PENDING,
        },
      })
    }
    sampleTrips.push({ tripId: trip.id, bookingId: booking.id, label: 'Docs pending verification' })
  }

  console.log(`  ${sampleTrips.length} sample compliance bookings created`)

  // ─── Verification Summary ─────────────────────────────────────────────
  console.log('\n==================================================')
  console.log('  SEED VERIFICATION SUMMARY')
  console.log('==================================================')

  const totalBookings = await prisma.booking.count()
  const closedBookings = await prisma.booking.count({ where: { status: BookingStatus.CLOSED } })
  const rejectedBookings = await prisma.booking.count({ where: { status: BookingStatus.REJECTED } })
  const totalTrips = await prisma.truckTrip.count()
  const totalGateEvents = await prisma.gateEvent.count()
  const totalChecklists = await prisma.safetyChecklist.count()
  const totalStopWork = await prisma.stopWorkOrder.count()
  const totalIncidents = await prisma.incident.count()
  const totalArms = await prisma.loadingArm.count()
  const totalDocTypes = await prisma.documentType.count()
  const totalDocs = await prisma.documentRecord.count()
  const totalCompat = await prisma.productCompatibility.count()
  const totalProducts = await prisma.product.count()

  console.log(`  Products:          ${totalProducts}`)
  console.log(`  Loading Arms:      ${totalArms}`)
  console.log(`  Product Compat:    ${totalCompat} rules`)
  console.log(`  Document Types:    ${totalDocTypes}`)
  console.log(`  Documents:         ${totalDocs}`)
  console.log(`  Total bookings:    ${totalBookings}`)
  console.log(`  Accepted (CLOSED): ${closedBookings}`)
  console.log(`  Rejected:          ${rejectedBookings}`)
  console.log(`  Truck trips:       ${totalTrips}`)
  console.log(`  Gate events:       ${totalGateEvents}`)
  console.log(`  Safety checklists: ${totalChecklists}`)
  console.log(`  Stop work orders:  ${totalStopWork}`)
  console.log(`  Incidents:         ${totalIncidents}`)

  console.log('\n  Gantry-1 Arm Assignments:')
  const g1Arms = await prisma.loadingArm.findMany({
    where: { bay: { gantry: { name: 'Gantry 1' } } },
    include: { bay: true, currentProduct: true },
    orderBy: [{ bay: { uniqueCode: 'asc' } }, { armNo: 'asc' }],
  })
  let currentBay = ''
  for (const arm of g1Arms) {
    if (arm.bay.uniqueCode !== currentBay) {
      currentBay = arm.bay.uniqueCode
      process.stdout.write(`    ${currentBay}: `)
    }
    process.stdout.write(`Arm${arm.armNo}=${arm.currentProduct?.name ?? 'Empty'} `)
    if (arm.armNo === 3) process.stdout.write('\n')
  }

  console.log('\n==================================================')
  console.log('  Seed completed!')
  console.log('==================================================')
  console.log('\n  Demo logins (password: password123):')
  console.log('  +---------------------+----------------------------------+')
  console.log('  | Role                | Email                            |')
  console.log('  +---------------------+----------------------------------+')
  console.log('  | Super Admin         | superadmin@eipl.com              |')
  console.log('  | Terminal Admin      | admin@eipl.com                   |')
  console.log('  | Security            | security@eipl.com                |')
  console.log('  | HSE Officer         | hse@eipl.com                     |')
  console.log('  | Surveyor            | surveyor@eipl.com                |')
  console.log('  | Auditor             | auditor@eipl.com                 |')
  console.log('  | Traffic Controller  | controller@eipl.com              |')
  console.log('  | Transporter         | dispatch@safehaul.com            |')
  console.log('  | Transporter         | ops@speedtankers.com             |')
  console.log('  | Client              | client@tridentchemp.com          |')
  console.log('  +---------------------+----------------------------------+')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
