import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { getGeminiClient, GEMINI_CHAT_MODEL } from "@/lib/ai/gemini-client"
import { FORM_SCHEMAS } from "@/lib/ai/form-schemas"
import { createAuditLog } from "@/lib/audit"
import { redactParams } from "@/lib/ai/redact"

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!hasPermission(user!.role, "form:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const formType = formData.get("formType") as string | null

  if (!file || !formType) {
    return NextResponse.json({ error: "file and formType are required" }, { status: 400 })
  }

  const schema = FORM_SCHEMAS[formType]
  if (!schema) {
    return NextResponse.json(
      { error: `Unknown form type: ${formType}. Available: ${Object.keys(FORM_SCHEMAS).join(", ")}` },
      { status: 400 }
    )
  }

  // Process entirely in memory — no file-system writes
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.split(".").pop() ?? "").toLowerCase()

  // Build the prompt
  const fieldDescriptions = Object.entries(schema.fields)
    .map(([key, f]) => `- ${key}: ${f.label} (${f.required ? "required" : "optional"})`)
    .join("\n")

  const emptyTemplate = Object.fromEntries(
    Object.keys(schema.fields).map((key) => [
      key,
      { value: "", confidence: 0, source_quote: "", page_or_section: "" },
    ])
  )

  const prompt = `You are a document extraction assistant. Extract the following fields from the provided document.

For each field return a JSON object with:
- value: extracted text (empty string if not found)
- confidence: float 0.0–1.0
- source_quote: exact text from the document this was extracted from (empty string if not found)
- page_or_section: page number or section name where found (empty string if unknown)

Fields to extract:
${fieldDescriptions}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
${JSON.stringify(emptyTemplate, null, 2)}

If a field is not found set confidence to 0 and value to empty string.`

  try {
    const gemini = getGeminiClient()
    const model = gemini.getGenerativeModel({ model: GEMINI_CHAT_MODEL })

    const textLike = new Set(["txt", "json", "csv", "log"])
    let result

    if (textLike.has(ext)) {
      // Plain text — pass as string
      const text = buffer.toString("utf-8")
      result = await model.generateContent([
        prompt,
        `\n\nDocument content:\n${text}`,
      ])
    } else {
      // PDF or image — pass as inline base64 data
      const base64 = buffer.toString("base64")
      const mimeType =
        ext === "pdf"
          ? "application/pdf"
          : ext === "png"
          ? "image/png"
          : "image/jpeg"
      result = await model.generateContent([
        { inlineData: { data: base64, mimeType } },
        prompt,
      ])
    }

    const responseText = result.response.text()

    // Strip markdown code fences if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(jsonStr.trim())
    } catch {
      return NextResponse.json({ error: "Failed to parse extraction result" }, { status: 500 })
    }

    await createAuditLog({
      actorUserId: user!.id,
      entityType: "form_extraction",
      entityId: formType,
      action: "extract",
      after: redactParams(extracted),
    })

    return NextResponse.json({
      formType,
      schema: {
        label: schema.label,
        fields: schema.fields,
      },
      extracted,
    })
  } catch (err) {
    console.error("Gemini extraction error:", err)
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 })
  }
}
