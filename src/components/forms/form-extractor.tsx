"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfidenceBadge } from "./confidence-badge"
import { SourceTooltip } from "./source-tooltip"
import { Upload, Loader2, CheckCircle2 } from "lucide-react"

interface FieldDef {
  label: string
  type: "text" | "date" | "phone" | "email"
  required: boolean
  redact?: boolean
}

interface ExtractedField {
  value?: string
  confidence: number
  source_quote?: string
  page_or_section?: string
}

type State = "upload" | "extracting" | "review" | "submitting" | "done"

interface FormExtractorProps {
  formType: string
  fields: Record<string, FieldDef>
}

export function FormExtractor({ formType, fields }: FormExtractorProps) {
  const [state, setState] = useState<State>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<Record<string, ExtractedField>>({})
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleExtract = useCallback(async () => {
    if (!file) return
    setState("extracting")
    setError(null)

    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("formType", formType)

      const res = await fetch("/api/forms/extract", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Extraction failed" }))
        setError(err.error || "Extraction failed")
        setState("upload")
        return
      }

      const data = await res.json()
      setExtracted(data.extracted)

      // Initialize form values from extracted data
      const values: Record<string, string> = {}
      for (const [key, field] of Object.entries(data.extracted as Record<string, ExtractedField>)) {
        values[key] = field.value || ""
      }
      setFormValues(values)
      setState("review")
    } catch {
      setError("Failed to extract data from document")
      setState("upload")
    }
  }, [file, formType])

  const handleSubmit = useCallback(async () => {
    setState("submitting")
    setError(null)

    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType,
          formData: formValues,
          extractedData: extracted,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }))
        setError(err.error || "Submission failed")
        setState("review")
        return
      }

      setState("done")
    } catch {
      setError("Failed to submit form")
      setState("review")
    }
  }, [formType, formValues, extracted])

  if (state === "done") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
          <h3 className="text-lg font-semibold mb-2">Form Submitted Successfully</h3>
          <p className="text-muted-foreground mb-4">The form data has been saved.</p>
          <Button
            variant="outline"
            onClick={() => {
              setState("upload")
              setFile(null)
              setExtracted({})
              setFormValues({})
            }}
          >
            Submit Another
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {(state === "upload" || state === "extracting") && (
        <Card>
          <CardContent className="py-8">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm mb-2">
                {file ? file.name : "Drag and drop a file here, or click to browse"}
              </p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <label htmlFor="file-upload">
                <Button variant="outline" size="sm" asChild>
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>

            {file && (
              <div className="mt-4 flex justify-center">
                <Button onClick={handleExtract} disabled={state === "extracting"}>
                  {state === "extracting" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    "Extract Data"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
      )}

      {/* Review form */}
      {(state === "review" || state === "submitting") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Extracted Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(fields).map(([key, fieldDef]) => {
              const ext = extracted[key]
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1">
                    <Label htmlFor={key} className="text-sm">
                      {fieldDef.label}
                      {fieldDef.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    {ext && <ConfidenceBadge confidence={ext.confidence} />}
                    {ext && (
                      <SourceTooltip
                        sourceQuote={ext.source_quote}
                        pageOrSection={ext.page_or_section}
                      />
                    )}
                  </div>
                  <Input
                    id={key}
                    type={fieldDef.type === "date" ? "date" : "text"}
                    value={formValues[key] || ""}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={fieldDef.label}
                    disabled={state === "submitting"}
                  />
                </div>
              )
            })}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSubmit} disabled={state === "submitting"}>
                {state === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm & Save"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setState("upload")
                  setFile(null)
                  setExtracted({})
                  setFormValues({})
                }}
                disabled={state === "submitting"}
              >
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
