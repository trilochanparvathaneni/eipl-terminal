"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfidenceBadge } from "./confidence-badge"
import { SourceTooltip } from "./source-tooltip"
import { Upload, Loader2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"

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

// State only tracks the async operations; the form fields are always visible
type State = "fill" | "extracting" | "submitting" | "done"

interface FormExtractorProps {
  formType: string
  fields: Record<string, FieldDef>
}

export function FormExtractor({ formType, fields }: FormExtractorProps) {
  const [state, setState] = useState<State>("fill")
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<Record<string, ExtractedField>>({})
  const [formValues, setFormValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.keys(fields).map((k) => [k, ""]))
  )
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadExpanded, setUploadExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        setState("fill")
        return
      }

      const data = await res.json()
      const newExtracted: Record<string, ExtractedField> = data.extracted

      setExtracted(newExtracted)

      // Merge AI values into form: only overwrite if AI confidence > 0.5 and user hasn't typed anything
      setFormValues((prev) => {
        const merged = { ...prev }
        for (const [key, field] of Object.entries(newExtracted)) {
          const aiField = field as ExtractedField
          if (
            aiField.confidence > 0.5 &&
            aiField.value &&
            (prev[key] === "" || prev[key] === undefined)
          ) {
            merged[key] = aiField.value
          }
        }
        return merged
      })

      setState("fill")
      setUploadExpanded(false) // collapse upload section after successful extract
    } catch {
      setError("Failed to extract data from document")
      setState("fill")
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
        setState("fill")
        return
      }

      setState("done")
    } catch {
      setError("Failed to submit form")
      setState("fill")
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
              setState("fill")
              setFile(null)
              setExtracted({})
              setFormValues(Object.fromEntries(Object.keys(fields).map((k) => [k, ""])))
              setUploadExpanded(false)
            }}
          >
            Submit Another
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isSubmitting = state === "submitting"
  const isExtracting = state === "extracting"

  return (
    <div className="space-y-6">
      {/* Collapsible upload-to-auto-fill section */}
      <Card>
        <CardHeader className="py-3 px-4">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left"
            onClick={() => setUploadExpanded((v) => !v)}
          >
            <span className="text-sm font-medium">Upload document to auto-fill</span>
            {uploadExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CardHeader>

        {uploadExpanded && (
          <CardContent className="pt-0 pb-4">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                  : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm mb-2">
                {file ? file.name : "Drag a PDF or image here, or click to browse"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </Button>
            </div>

            {file && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-muted-foreground flex-1 truncate">{file.name}</span>
                <Button
                  size="sm"
                  onClick={handleExtract}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    "Extract"
                  )}
                </Button>
              </div>
            )}

            {Object.keys(extracted).length > 0 && !isExtracting && (
              <p className="text-xs text-green-600 mt-2">
                Fields populated from document. Review and edit below.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
      )}

      {/* Form fields — always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Form Fields</CardTitle>
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
                  {ext && ext.confidence > 0 && <ConfidenceBadge confidence={ext.confidence} />}
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
                  disabled={isSubmitting || isExtracting}
                />
              </div>
            )
          })}

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSubmit} disabled={isSubmitting || isExtracting}>
              {isSubmitting ? (
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
                setFile(null)
                setExtracted({})
                setFormValues(Object.fromEntries(Object.keys(fields).map((k) => [k, ""])))
                setError(null)
              }}
              disabled={isSubmitting || isExtracting}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
