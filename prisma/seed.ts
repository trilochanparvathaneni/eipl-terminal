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
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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
  console.log('🔄 Wiping database for fresh seed...')

  // Delete in correct order (children first)
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.incident.deleteMany()
  await prisma.stopWorkOrder.deleteMany()
  await prisma.safetyChecklist.deleteMany()
  await prisma.gateEvent.deleteMany()
  await prisma.truckTrip.deleteMany()
  await prisma.bookingBayAllocation.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.timeSlot.deleteMany()
  await prisma.inventoryLot.deleteMany()
  await prisma.productBayMap.deleteMany()
  await prisma.bay.deleteMany()
  await prisma.gantry.deleteMany()
  await prisma.user.deleteMany()
  await prisma.transporter.deleteMany()
  await prisma.client.deleteMany()
  await prisma.product.deleteMany()
  await prisma.terminal.deleteMany()

  console.log('✅ Database wiped')

  const hash = (pw: string) => bcrypt.hashSync(pw, 10)
  const pw = hash('password123')

  // ─── Terminal ──────────────────────────────────────────────────────────
  const terminal = await prisma.terminal.create({
    data: { name: 'EIPL Vizag Terminal', location: 'Visakhapatnam, Andhra Pradesh' },
  })

  // ─── Gantries ─────────────────────────────────────────────────────────
  const gantry1 = await prisma.gantry.create({ data: { terminalId: terminal.id, name: 'Gantry 1' } })
  const gantry2 = await prisma.gantry.create({ data: { terminalId: terminal.id, name: 'Gantry 2' } })
  const gantryMap: Record<number, string> = { 1: gantry1.id, 2: gantry2.id }

  // ─── Bays ─────────────────────────────────────────────────────────────
  const bayRecords: Record<string, string> = {} // code -> id
  for (const bd of BAY_DEFS) {
    const bay = await prisma.bay.create({
      data: {
        gantryId: gantryMap[bd.gantry],
        name: bd.name,
        uniqueCode: bd.code,
      },
    })
    bayRecords[bd.code] = bay.id
  }

  // ─── Products ─────────────────────────────────────────────────────────
  const methanol = await prisma.product.create({
    data: { name: 'Methanol', category: ProductCategory.CHEMICAL, isHazardous: true },
  })
  const lpg = await prisma.product.create({
    data: { name: 'LPG', category: ProductCategory.LPG, isHazardous: true },
  })
  const hsd = await prisma.product.create({
    data: { name: 'HSD (High Speed Diesel)', category: ProductCategory.POL, isHazardous: true },
  })
  const products = [methanol, lpg, hsd]

  // ─── Product-Bay Mappings ─────────────────────────────────────────────
  // Methanol → G1B03, G1B04 (primary overloaded bays)
  // LPG → G1B05, G2B02
  // HSD → G2B01, G2B03, G2B04, G1B02
  // Spillover: G1B06, G1B07, G1B08 can take any product
  const productBayPairs: [typeof methanol, string][] = [
    [methanol, 'G1B03'], [methanol, 'G1B04'], [methanol, 'G1B06'], [methanol, 'G1B07'], [methanol, 'G1B08'],
    [lpg, 'G1B05'], [lpg, 'G2B02'], [lpg, 'G1B07'], [lpg, 'G1B08'],
    [hsd, 'G2B01'], [hsd, 'G2B03'], [hsd, 'G2B04'], [hsd, 'G1B02'], [hsd, 'G1B06'],
  ]
  for (const [prod, code] of productBayPairs) {
    await prisma.productBayMap.create({ data: { productId: prod.id, bayId: bayRecords[code] } })
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
  await prisma.user.create({
    data: { name: 'Surveyor Sharma', email: 'surveyor@eipl.com', passwordHash: pw, role: Role.SURVEYOR, terminalId: terminal.id },
  })
  await prisma.user.create({
    data: { name: 'Auditor Singh', email: 'auditor@eipl.com', passwordHash: pw, role: Role.AUDITOR, terminalId: terminal.id },
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

  console.log('✅ Infrastructure + users created')

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
  console.log(`✅ ${Object.keys(timeslotMap).length} timeslots created for ${JAN2025_ACTIVE_DAYS.length} active days`)

  // ─── Distribute bookings across days ──────────────────────────────────
  // Build per-day targets
  interface DayTarget {
    date: Date
    dateStr: string
    dayOfMonth: number
    accepted: number
    rejected: number
  }

  const overflowTotal = Object.values(OVERFLOW_DAYS)
  const overflowAccepted = overflowTotal.reduce((s, v) => s + v.accepted, 0) // 399
  const overflowRejected = overflowTotal.reduce((s, v) => s + v.rejected, 0) // 63
  const normalDays = JAN2025_ACTIVE_DAYS.filter((d) => !OVERFLOW_DAYS[d.getDate()])
  const remainAccepted = 811 - overflowAccepted // 412
  const remainRejected = 273 - overflowRejected // 210

  // Distribute remaining across normal days
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

  // Verify totals
  const totalAcc = dayTargets.reduce((s, d) => s + d.accepted, 0)
  const totalRej = dayTargets.reduce((s, d) => s + d.rejected, 0)
  console.log(`📊 Day distribution: ${totalAcc} accepted + ${totalRej} rejected = ${totalAcc + totalRej} total`)

  // ─── Build per-slot accepted counts for the month ─────────────────────
  // We need to distribute SLOT_ACCEPTED_TARGETS across 27 days
  // For overflow days, concentrate more vehicles per slot
  const slotDayAccepted: number[][] = [] // [dayIdx][slotIdx] = accepted count for that day+slot
  for (const dt of dayTargets) {
    const dayAcc = dt.accepted
    // Distribute this day's accepted across slots proportionally to SLOT_ACCEPTED_TARGETS
    const totalTarget = SLOT_ACCEPTED_TARGETS.reduce((s, v) => s + v, 0) // 811
    const raw = SLOT_ACCEPTED_TARGETS.map((t) => (t / totalTarget) * dayAcc)
    const rounded = raw.map((v) => Math.floor(v))
    let diff = dayAcc - rounded.reduce((s, v) => s + v, 0)
    // Distribute remainder
    const fracs = raw.map((v, i) => ({ i, frac: v - rounded[i] })).sort((a, b) => b.frac - a.frac)
    for (let k = 0; k < diff; k++) {
      rounded[fracs[k].i]++
    }
    slotDayAccepted.push(rounded)
  }

  // ─── Build bay assignment pool ────────────────────────────────────────
  // Create a pool of 811 bay codes according to BAY_DEFS targets
  const bayPool: string[] = []
  for (const bd of BAY_DEFS) {
    for (let i = 0; i < bd.target; i++) {
      bayPool.push(bd.code)
    }
  }
  const shuffledBayPool = shuffle(bayPool)
  let bayPoolIdx = 0

  // ─── Build client assignment pool ─────────────────────────────────────
  // Create pools of accepted and rejected bookings per client
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
  console.log('📝 Creating bookings, trips, and gate events...')
  let bookingCounter = 0
  let truckIdx = 0
  const hazardousBookingIds: string[] = [] // for safety checklists
  const allAcceptedBookingIds: string[] = []

  for (let dayIdx = 0; dayIdx < dayTargets.length; dayIdx++) {
    const dt = dayTargets[dayIdx]
    const dayDate = dt.date

    // ── Accepted bookings for this day ──
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

        const booking = await prisma.booking.create({
          data: {
            bookingNo,
            terminalId: terminal.id,
            clientId,
            productId: product.id,
            quantityRequested: qty,
            date: dayDate,
            timeSlotId,
            transporterId,
            status: BookingStatus.CLOSED,
            isBulk: rng() < 0.1,
            createdByUserId: clientUsers[clientId],
            createdAt: new Date(dayDate.getTime() - 86400000 * randInt(1, 3)),
          },
        })

        allAcceptedBookingIds.push(booking.id)
        if (product.isHazardous) hazardousBookingIds.push(booking.id)

        // Bay allocation
        await prisma.bookingBayAllocation.create({
          data: {
            bookingId: booking.id,
            bayId: bayRecords[bayCode],
            allocatedByUserId: terminalAdmin.id,
            allocatedAt: new Date(dayDate.getTime() - 86400000),
          },
        })

        // TruckTrip
        const truckTrip = await prisma.truckTrip.create({
          data: {
            bookingId: booking.id,
            truckNumber: genTruckNo(truckIdx),
            driverName: genDriverName(truckIdx),
            driverPhone: genDriverPhone(truckIdx),
            qrToken: `qr-${bookingNo}-${truckIdx}`,
            status: TruckTripStatus.COMPLETED,
          },
        })
        truckIdx++

        // Parse slot start time for gate event timestamps
        const [slotH, slotM] = SLOT_DEFS[slotIdx].start.split(':').map(Number)
        const checkInTime = new Date(dayDate)
        checkInTime.setHours(slotH, slotM + randInt(0, 25), randInt(0, 59))

        const checkOutTime = new Date(checkInTime)
        checkOutTime.setMinutes(checkOutTime.getMinutes() + randInt(30, 90))

        const tare = parseFloat((randInt(80, 140) * 100 / 100).toFixed(1))
        const gross = parseFloat((tare + qty + randInt(-2, 2)).toFixed(1))
        const net = parseFloat((gross - tare).toFixed(1))

        // CHECK_IN
        await prisma.gateEvent.create({
          data: {
            truckTripId: truckTrip.id,
            type: GateEventType.CHECK_IN,
            timestamp: checkInTime,
            securityUserId: securityUser.id,
            photoTruckUrl: `/photos/truck-${bookingNo}-in.jpg`,
            photoDriverUrl: `/photos/driver-${bookingNo}-in.jpg`,
            weighmentTare: tare,
          },
        })

        // CHECK_OUT
        await prisma.gateEvent.create({
          data: {
            truckTripId: truckTrip.id,
            type: GateEventType.CHECK_OUT,
            timestamp: checkOutTime,
            securityUserId: securityUser.id,
            photoTruckUrl: `/photos/truck-${bookingNo}-out.jpg`,
            weighmentGross: gross,
            netQuantity: net,
          },
        })
      }
    }

    // ── Rejected bookings for this day ──
    for (let r = 0; r < dt.rejected; r++) {
      bookingCounter++
      const clientId = shuffledClientRej[clientRejIdx++]
      const product = pick(products)
      const bookingNo = `BK25${String(bookingCounter).padStart(5, '0')}`
      const qty = product.category === 'LPG' ? randInt(8, 20) : randInt(10, 40)
      const slotIdx = randInt(0, SLOT_DEFS.length - 1)
      const slotKey = `${dt.dateStr}|${SLOT_DEFS[slotIdx].start}`
      const timeSlotId = timeslotMap[slotKey]

      const rejectedAtGate = rng() < 0.35 // 35% rejected at gate, rest before arrival

      const booking = await prisma.booking.create({
        data: {
          bookingNo,
          terminalId: terminal.id,
          clientId,
          productId: product.id,
          quantityRequested: qty,
          date: dayDate,
          timeSlotId,
          transporterId: pick(transporterIds),
          status: BookingStatus.REJECTED,
          isBulk: false,
          createdByUserId: clientUsers[clientId],
          createdAt: new Date(dayDate.getTime() - 86400000 * randInt(1, 3)),
        },
      })

      if (rejectedAtGate) {
        const trip = await prisma.truckTrip.create({
          data: {
            bookingId: booking.id,
            truckNumber: genTruckNo(truckIdx),
            driverName: genDriverName(truckIdx),
            driverPhone: genDriverPhone(truckIdx),
            qrToken: `qr-${bookingNo}-${truckIdx}`,
            status: TruckTripStatus.QR_ISSUED,
          },
        })
        truckIdx++

        const [slotH, slotM] = SLOT_DEFS[slotIdx].start.split(':').map(Number)
        const arrTime = new Date(dayDate)
        arrTime.setHours(slotH, slotM + randInt(0, 25), randInt(0, 59))

        const reasons = ['Slot missed', 'Safety check failed', 'Documentation incomplete', 'Vehicle condition unsatisfactory', 'Overweight']
        await prisma.gateEvent.create({
          data: {
            truckTripId: trip.id,
            type: GateEventType.CHECK_IN,
            timestamp: arrTime,
            securityUserId: securityUser.id,
            payloadJson: { rejectedAtGate: true, reason: pick(reasons) },
          },
        })
      }
    }

    if (dayIdx % 5 === 0) {
      console.log(`  Day ${dt.dayOfMonth} Jan: ${dt.accepted} accepted, ${dt.rejected} rejected`)
    }
  }

  console.log(`✅ ${bookingCounter} bookings created (${allAcceptedBookingIds.length} accepted, ${bookingCounter - allAcceptedBookingIds.length} rejected)`)

  // ─── Safety Checklists ────────────────────────────────────────────────
  console.log('🛡️ Creating safety data...')
  const hazardousForChecklist = shuffle(hazardousBookingIds).slice(0, Math.ceil(hazardousBookingIds.length * 0.6))
  for (const bId of hazardousForChecklist) {
    const passed = rng() < 0.88
    await prisma.safetyChecklist.create({
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
    const isActive = i < 2 // first 2 remain active
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

  // ─── Verification Summary ─────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════')
  console.log('  SEED VERIFICATION SUMMARY')
  console.log('══════════════════════════════════════════════')

  const totalBookings = await prisma.booking.count()
  const closedBookings = await prisma.booking.count({ where: { status: BookingStatus.CLOSED } })
  const rejectedBookings = await prisma.booking.count({ where: { status: BookingStatus.REJECTED } })
  const totalTrips = await prisma.truckTrip.count()
  const totalGateEvents = await prisma.gateEvent.count()
  const totalChecklists = await prisma.safetyChecklist.count()
  const totalStopWork = await prisma.stopWorkOrder.count()
  const totalIncidents = await prisma.incident.count()

  console.log(`  Total bookings:    ${totalBookings} (target: 1084)  ${totalBookings === 1084 ? '✅' : '❌'}`)
  console.log(`  Accepted (CLOSED): ${closedBookings} (target: 811)   ${closedBookings === 811 ? '✅' : '❌'}`)
  console.log(`  Rejected:          ${rejectedBookings} (target: 273)   ${rejectedBookings === 273 ? '✅' : '❌'}`)
  console.log(`  Active days:       ${JAN2025_ACTIVE_DAYS.length} (target: 27)    ${JAN2025_ACTIVE_DAYS.length === 27 ? '✅' : '❌'}`)
  console.log(`  Truck trips:       ${totalTrips}`)
  console.log(`  Gate events:       ${totalGateEvents}`)
  console.log(`  Safety checklists: ${totalChecklists}`)
  console.log(`  Stop work orders:  ${totalStopWork}`)
  console.log(`  Incidents:         ${totalIncidents}`)

  // Bay utilization check
  console.log('\n  Bay Utilization:')
  for (const bd of BAY_DEFS) {
    const count = await prisma.bookingBayAllocation.count({ where: { bayId: bayRecords[bd.code] } })
    const match = count === bd.target
    console.log(`    ${bd.code}: ${count} (target: ${bd.target}) ${match ? '✅' : '❌'}`)
  }

  // Overflow days check
  console.log('\n  Overflow Days:')
  for (const [dom, target] of Object.entries(OVERFLOW_DAYS)) {
    const dayDate = new Date(2025, 0, parseInt(dom))
    const nextDay = new Date(2025, 0, parseInt(dom) + 1)
    const acc = await prisma.booking.count({ where: { date: { gte: dayDate, lt: nextDay }, status: BookingStatus.CLOSED } })
    const rej = await prisma.booking.count({ where: { date: { gte: dayDate, lt: nextDay }, status: BookingStatus.REJECTED } })
    const ok = acc === target.accepted && rej === target.rejected
    console.log(`    Jan ${dom}: ${acc} accepted, ${rej} rejected (target: ${target.accepted}/${target.rejected}) ${ok ? '✅' : '❌'}`)
  }

  console.log('\n══════════════════════════════════════════════')
  console.log('  🎉 Seed completed!')
  console.log('══════════════════════════════════════════════')
  console.log('\n  Demo logins (password: password123):')
  console.log('  ┌──────────────────┬──────────────────────────────────┐')
  console.log('  │ Role             │ Email                            │')
  console.log('  ├──────────────────┼──────────────────────────────────┤')
  console.log('  │ Super Admin      │ superadmin@eipl.com              │')
  console.log('  │ Terminal Admin   │ admin@eipl.com                   │')
  console.log('  │ Security         │ security@eipl.com                │')
  console.log('  │ HSE Officer      │ hse@eipl.com                     │')
  console.log('  │ Surveyor         │ surveyor@eipl.com                │')
  console.log('  │ Auditor          │ auditor@eipl.com                 │')
  console.log('  │ Transporter      │ dispatch@safehaul.com            │')
  console.log('  │ Transporter      │ ops@speedtankers.com             │')
  console.log('  │ Client           │ client@tridentchemp.com          │')
  console.log('  └──────────────────┴──────────────────────────────────┘')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
