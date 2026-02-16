"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function QRPage() {
  const { id } = useParams()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ["trip-qr", id],
    queryFn: async () => {
      const res = await fetch(`/api/truck-trips/${id}/qr`)
      if (!res.ok) throw new Error("Failed to load QR")
      return res.json()
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  if (!data) {
    return <div className="text-center py-8 text-muted-foreground">QR not available</div>
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Button variant="ghost" onClick={() => router.back()} className="print:hidden">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>Gate Entry QR Code</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {data.qrDataUrl && (
            <Image src={data.qrDataUrl} alt="QR Code" className="mx-auto" width={256} height={256} unoptimized />
          )}

          <div className="text-sm space-y-1 border-t pt-4">
            <p><strong>Booking:</strong> {data.trip?.booking?.bookingNo}</p>
            <p><strong>Truck:</strong> {data.trip?.truckNumber}</p>
            <p><strong>Driver:</strong> {data.trip?.driverName}</p>
            <p><strong>Phone:</strong> {data.trip?.driverPhone}</p>
            <p><strong>Product:</strong> {data.trip?.booking?.product}</p>
            <p><strong>Client:</strong> {data.trip?.booking?.client}</p>
            <p><strong>Terminal:</strong> {data.trip?.booking?.terminal}</p>
            <p><strong>Time Slot:</strong> {data.trip?.booking?.timeSlot}</p>
          </div>

          <p className="text-xs text-muted-foreground">Token: {data.qrToken}</p>

          <div className="flex gap-2 justify-center print:hidden">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
