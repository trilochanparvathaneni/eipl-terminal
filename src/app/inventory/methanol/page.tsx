import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function MethanolInventoryPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Methanol Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Inventory module deep view is not enabled for Methanol yet.</p>
          <p>Use dashboard and forecast screens for current operational overview.</p>
          <div className="flex gap-2">
            <Button asChild><Link href="/dashboard">Open Dashboard</Link></Button>
            <Button variant="outline" asChild><Link href="/forecast">Open Forecast</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
