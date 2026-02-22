import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ContactSupportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Contact Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>We could not open the requested page directly.</p>
          <p>Please contact platform support for route enablement or permission help.</p>
          <p><strong>Email:</strong> support@eipl.local</p>
          <p><strong>Phone:</strong> +91-891-555-0111</p>
          <div className="flex gap-2">
            <Button asChild><Link href="/contacts/control-room">Contact HSE Control Room</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard">Open Dashboard</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
