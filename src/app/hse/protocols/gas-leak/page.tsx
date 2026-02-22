import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function GasLeakProtocolPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gas Leak Safety Protocol</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Stop loading/discharge operations and isolate source valves.</li>
            <li>Raise alarm and evacuate non-essential personnel.</li>
            <li>Use approved PPE and gas detectors before entering affected zone.</li>
            <li>Inform HSE Control Room and shift controller immediately.</li>
            <li>Record incident details and start investigation workflow.</li>
          </ol>
          <div className="flex gap-2 pt-2">
            <Button asChild><Link href="/hse/incidents/new">Report a New Incident</Link></Button>
            <Button variant="outline" asChild><Link href="/contacts/control-room">Contact HSE Control Room</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
