import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { extractFromDocumentText } from "@/lib/document-extraction"
import { getOpenAIClient, CHAT_MODEL } from "@/lib/ai/openai-client"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"])
const TEXT_EXT  = new Set([".txt", ".csv", ".md"])

/**
 * POST /api/ai/ocr
 * Upload a document → extract structured fields via OCR / GPT-4o vision.
 *
 * Form fields:
 *   file         – the document file
 *   documentType – optional document type code for rule-based extraction (e.g. "MSDS")
 *
 * Returns:
 *   { fields: Record<string, string|number>, confidence: number, warnings: string[], source: "vision"|"rules" }
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!hasPermission(user!.role, "chat:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  const documentType = (formData.get("documentType") as string | null)?.trim() ?? ""

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be 1 byte – 5 MB" }, { status: 400 })
  }

  const ext = require("path").extname(file.name).toLowerCase() as string
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // ── IMAGE / PDF: use GPT-4o vision ─────────────────────────────────────────
  if (IMAGE_EXT.has(ext) || ext === ".pdf") {
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".tif": "image/tiff",
      ".tiff": "image/tiff",
      ".pdf": "application/pdf",
    }
    const mime = mimeMap[ext] ?? "application/octet-stream"
    const b64 = buffer.toString("base64")

    const systemPrompt = `You are a document field extraction assistant. Extract all key fields from the document image.
Return ONLY a JSON object with field names as keys and their extracted values.
Focus on: truck number, product, quantity, client name, booking reference, date, driver name, seal numbers, weight, and any other visible fields.
If a field is not found, omit it. Be precise and literal — do not infer or guess.`

    let gptResult: Record<string, string | number> = {}
    let warnings: string[] = []
    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${b64}`, detail: "high" },
              },
              {
                type: "text",
                text: documentType
                  ? `Document type: ${documentType}. Extract all relevant fields.`
                  : "Extract all fields from this document.",
              },
            ],
          },
        ],
      })

      const raw = response.choices[0]?.message?.content ?? "{}"
      // Strip markdown code block if present
      const jsonStr = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()
      gptResult = JSON.parse(jsonStr)
    } catch (err) {
      warnings.push("Vision extraction failed; returned partial result")
    }

    return NextResponse.json({ fields: gptResult, confidence: 0.85, warnings, source: "vision" })
  }

  // ── TEXT / CSV: rule-based extraction ──────────────────────────────────────
  if (TEXT_EXT.has(ext)) {
    const rawText = buffer.toString("utf-8")
    const result = extractFromDocumentText(documentType || "GENERIC", rawText)
    return NextResponse.json({ ...result, source: "rules" })
  }

  return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 })
}
