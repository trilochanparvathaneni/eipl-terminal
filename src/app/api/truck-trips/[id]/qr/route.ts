import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import QRCode from 'qrcode'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth()
  if (error) return error

  const trip = await prisma.truckTrip.findUnique({
    where: { id: params.id },
    include: {
      booking: {
        include: { client: true, product: true, terminal: true, timeSlot: true },
      },
    },
  })

  if (!trip || !trip.qrToken) {
    return NextResponse.json({ error: 'Trip not found or QR not issued' }, { status: 404 })
  }

  // Generate QR code as data URL
  const qrData = JSON.stringify({
    token: trip.qrToken,
    bookingNo: trip.booking.bookingNo,
    truckNumber: trip.truckNumber,
    driverName: trip.driverName,
  })

  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 })

  return NextResponse.json({
    qrDataUrl,
    qrToken: trip.qrToken,
    trip: {
      id: trip.id,
      truckNumber: trip.truckNumber,
      driverName: trip.driverName,
      driverPhone: trip.driverPhone,
      booking: {
        bookingNo: trip.booking.bookingNo,
        product: trip.booking.product.name,
        client: trip.booking.client.name,
        terminal: trip.booking.terminal.name,
        date: trip.booking.date,
        timeSlot: trip.booking.timeSlot
          ? `${trip.booking.timeSlot.startTime} - ${trip.booking.timeSlot.endTime}`
          : 'TBD',
      },
    },
  })
}
