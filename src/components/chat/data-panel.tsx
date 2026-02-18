"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react"
import Link from "next/link"

interface ToolCallEvent {
  toolCallId: string
  name: string
  params: string
  result?: any
  citations?: { documentId: string; snippet: string }[]
  recordIds?: { type: string; id: string }[]
}

interface DataPanelProps {
  toolCalls: ToolCallEvent[]
}

function entityLink(type: string, id: string): string {
  switch (type) {
    case "booking":
      return `/bookings/${id}`
    case "truck_trip":
      return `/transporter/trips`
    case "incident":
      return `/hse`
    default:
      return "#"
  }
}

function ToolCallAccordion({ tc }: { tc: ToolCallEvent }) {
  const [open, setOpen] = useState(false)

  let parsedParams: any = {}
  try {
    parsedParams = JSON.parse(tc.params)
  } catch {
    // ignore
  }

  const isLoading = !tc.result
  const resultSummary =
    tc.result?.count !== undefined
      ? `${tc.result.count} results`
      : tc.result?.error
        ? `Error: ${tc.result.error}`
        : "Done"

  return (
    <div className="border rounded-md text-xs">
      <button
        className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="font-medium flex-1 truncate">{tc.name}</span>
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {resultSummary}
          </Badge>
        )}
      </button>
      {open && (
        <div className="p-2 border-t space-y-2">
          <div>
            <p className="text-muted-foreground mb-1">Parameters:</p>
            <pre className="bg-muted rounded p-1.5 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(parsedParams, null, 2)}
            </pre>
          </div>
          {tc.result && (
            <div>
              <p className="text-muted-foreground mb-1">Result:</p>
              <pre className="bg-muted rounded p-1.5 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                {JSON.stringify(tc.result, null, 2)}
              </pre>
            </div>
          )}
          {tc.recordIds && tc.recordIds.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1">Records:</p>
              <div className="flex flex-wrap gap-1">
                {tc.recordIds.map((r, i) => (
                  <Link
                    key={i}
                    href={entityLink(r.type, r.id)}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    {r.type}/{r.id.slice(0, 8)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}
          {tc.citations && tc.citations.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1">Citations:</p>
              {tc.citations.map((c, i) => (
                <p key={i} className="text-muted-foreground italic">
                  &ldquo;{c.snippet}&rdquo;
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DataPanel({ toolCalls }: DataPanelProps) {
  if (toolCalls.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">
          Tool calls and data sources will appear here as the assistant uses them
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      {toolCalls.map((tc) => (
        <ToolCallAccordion key={tc.toolCallId} tc={tc} />
      ))}
    </div>
  )
}
