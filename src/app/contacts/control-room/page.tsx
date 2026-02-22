import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ControlRoomPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>HSE Control Room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Primary Line:</strong> +91-891-555-0101</p>
          <p><strong>Emergency Line:</strong> +91-891-555-0199</p>
          <p><strong>Email:</strong> hse-control@eipl.local</p>
          <div className="rounded-md border p-3">
            <p className="font-semibold">Escalation Steps</p>
            <ol className="list-decimal pl-5">
              <li>Stop unsafe operation immediately and inform shift supervisor.</li>
              <li>Raise incident via EIPL Assist or HSE incident form.</li>
              <li>Call emergency line for gas leak, fire, or injury incidents.</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
