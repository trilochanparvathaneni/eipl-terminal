import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    const where = { userId: user!.id }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ])

    return NextResponse.json({ notifications, total, page, limit })
  } catch (err) {
    console.error('Failed to fetch notifications:', err)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Notification id is required' },
        { status: 400 }
      )
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (notification.userId !== user!.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Failed to update notification:', err)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}
