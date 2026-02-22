"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Terminal = { id: string; name: string }

const INCIDENT_TYPES = ["Gas Leak", "Near Miss", "Spill", "Fire", "Injury", "Equipment Failure", "Other"] as const
const SEVERITY_LEVELS = ["Low", "Med", "High", "Critical"] as const

export default function NewIncidentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const [submitting, setSubmitting] = useState(false)
  const [terminals, setTerminals] = useState<Terminal[]>([])

  const [incidentType, setIncidentType] = useState<(typeof INCIDENT_TYPES)[number]>("Gas Leak")
  const [location, setLocation] = useState("")
  const [severity, setSeverity] = useState<(typeof SEVERITY_LEVELS)[number]>("Med")
  const [description, setDescription] = useState("")
  const [attachmentName, setAttachmentName] = useState("")
  const [terminalId, setTerminalId] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/lookup/terminals")
      const data = await res.json().catch(() => ({ terminals: [] }))
      if (res.ok && Array.isArray(data.terminals)) {
        setTerminals(data.terminals)
        const currentTerminal = (session?.user as any)?.terminalId as string | undefined
        setTerminalId(currentTerminal || data.terminals[0]?.id || "")
      }
    })()
  }, [session?.user])

  const apiSeverity = useMemo(() => (severity === "Critical" ? "HIGH" : severity.toUpperCase()), [severity])

  async function handleSubmit() {
    if (!terminalId || !description.trim() || !location.trim()) {
      toast({ title: "Missing fields", description: "Incident type, location, severity, and description are required.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        terminalId,
        severity: apiSeverity,
        description: `[Type: ${incidentType}] [Location: ${location}] ${description.trim()}${
          attachmentName ? ` [Attachment: ${attachmentName} (upload pending)]` : ""
        }`,
      }

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to submit incident")
      }

      toast({ title: "Incident reported", description: "Your incident has been submitted successfully." })
      router.push("/hse")
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please contact support.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading") {
    return <div className="p-4 text-sm text-muted-foreground">Loading incident form...</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Report Incident</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Incident Type</Label>
            <Select value={incidentType} onValueChange={(value) => setIncidentType(value as (typeof INCIDENT_TYPES)[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Gantry-2 Bay-4" />
          </div>

          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(value) => setSeverity(value as (typeof SEVERITY_LEVELS)[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITY_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what happened..." />
          </div>

          <div className="space-y-1.5">
            <Label>Terminal</Label>
            <Select value={terminalId} onValueChange={setTerminalId}>
              <SelectTrigger><SelectValue placeholder="Select terminal" /></SelectTrigger>
              <SelectContent>
                {terminals.map((terminal) => (
                  <SelectItem key={terminal.id} value={terminal.id}>{terminal.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Attachment (optional)</Label>
            <Input
              type="file"
              onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || "")}
              title="File storage integration pending; filename is recorded in incident description."
            />
            <p className="text-xs text-muted-foreground">File upload storage is not enabled yet. The selected filename will be noted.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/hse")}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Submit Incident"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
