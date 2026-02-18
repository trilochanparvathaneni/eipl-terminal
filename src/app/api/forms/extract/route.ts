import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { getOpenAIClient, CHAT_MODEL } from "@/lib/ai/openai-client"
import { FORM_SCHEMAS } from "@/lib/ai/form-schemas"
import { extractTextFromUploadedDocument } from "@/lib/document-extraction"
import { createAuditLog } from "@/lib/audit"
import { redactParams } from "@/lib/ai/redact"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

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

  // Save file temporarily
  const uploadDir = path.join(process.cwd(), "uploads", "forms")
  await mkdir(uploadDir, { recursive: true })
  const ext = path.extname(file.name) || ".pdf"
  const fileName = `${randomUUID()}${ext}`
  const filePath = path.join(uploadDir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  // Extract text
  const text = await extractTextFromUploadedDocument(filePath)
  if (!text) {
    return NextResponse.json(
      { error: "Could not extract text from the uploaded file" },
      { status: 422 }
    )
  }

  // Call OpenAI with structured output
  const completion = await getOpenAIClient().chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a document extraction assistant. Extract the following fields from the provided document text. For each field, provide the extracted value, a confidence score (0-1), and the source quote from the document. If a field is not found, set confidence to 0 and leave value empty.`,
      },
      {
        role: "user",
        content: `Extract the fields for "${schema.label}" from this document:\n\n${text}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: schema.openaiJsonSchema as any,
    },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: "No extraction result" }, { status: 500 })
  }

  let extracted: Record<string, unknown>
  try {
    extracted = JSON.parse(content)
  } catch {
    return NextResponse.json({ error: "Failed to parse extraction result" }, { status: 500 })
  }

  // Audit log with redacted data
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
}
