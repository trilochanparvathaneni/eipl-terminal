import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { safetyChecklistSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'
import { notifyByRole, sendNotification } from '@/lib/notifications'
import { Role, ChecklistStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const url = new URL(req.url)
  const bookingId = url.searchParams.get('bookingId')
  const status = url.searchParams.get('status')
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  const where: any = {}

  if (bookingId) where.bookingId = bookingId
  if (status) where.status = status as ChecklistStatus

  try {
    const [checklists, total] = await Promise.all([
      prisma.safetyChecklist.findMany({
        where,
        include: {
          booking: {
            include: {
              client: true,
              product: true,
              terminal: true,
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.safetyChecklist.count({ where }),
    ])

    return NextResponse.json({ checklists, total, page, limit })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch safety checklists' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(Role.HSE_OFFICER, Role.SUPER_ADMIN)
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = safetyChecklistSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  try {
    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { client: true, product: true, terminal: true },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const checklist = await prisma.safetyChecklist.create({
      data: {
        bookingId: data.bookingId,
        createdByHseId: user!.id,
        status: data.status as ChecklistStatus,
        checklistJson: data.checklistJson,
      },
      include: {
        booking: {
          include: {
            client: true,
            product: true,
            terminal: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    await createAuditLog({
      actorUserId: user!.id,
      entityType: 'SafetyChecklist',
      entityId: checklist.id,
      action: 'CREATE',
      after: checklist,
    })

    // Notify terminal admin and security about the checklist
    await notifyByRole({
      roles: ['TERMINAL_ADMIN', 'SECURITY'],
      terminalId: booking.terminalId,
      subject: `Safety Checklist ${data.status} - Booking ${booking.bookingNo}`,
      body: `A safety checklist has been created with status ${data.status} for booking ${booking.bookingNo}.`,
    })

    // Notify the booking creator
    await sendNotification({
      userId: booking.createdByUserId,
      subject: `Safety Checklist ${data.status}`,
      body: `Safety checklist for your booking ${booking.bookingNo} has been completed with status: ${data.status}.`,
    })

    return NextResponse.json(checklist, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create safety checklist' },
      { status: 500 }
    )
  }
}
