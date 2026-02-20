import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { promises as fs } from "fs"
import path from "path"
import { randomUUID } from "crypto"
import { indexKnowledgeDocument } from "@/lib/ai/knowledge-indexer"
import { createAuditLog } from "@/lib/audit"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXT = new Set([".pdf", ".txt", ".md", ".csv"])

// Resolve the org slug for the uploading user.
// Internal staff upload to the shared "eipl" knowledge base.
function resolveOrgSlug(user: { role: string; clientId?: string | null }): string {
  if (user.role === "CLIENT" && user.clientId) return user.clientId
  return "eipl"
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await authorize({ permission: P.AI_UPLOAD, headers: req.headers })
  if (error) return error

  const formData = await req.formData()
  const file = formData.get("file")
  const title = (formData.get("title") as string | null)?.trim()

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be 1 byte – 10 MB" }, { status: 400 })
  }

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type ${ext}. Allowed: ${Array.from(ALLOWED_EXT).join(", ")}` },
      { status: 400 }
    )
  }

  // ── Save file to uploads directory ─────────────────────────────────────────
  const uploadsDir = path.join(process.cwd(), "uploads", "knowledge")
  await fs.mkdir(uploadsDir, { recursive: true })
  const fileName = `${randomUUID()}${ext}`
  const filePath = path.join(uploadsDir, fileName)
  const bytes = await file.arrayBuffer()
  await fs.writeFile(filePath, Buffer.from(bytes))

  // ── Extract text from file ──────────────────────────────────────────────────
  let extractedText = ""
  if (ext === ".txt" || ext === ".md" || ext === ".csv") {
    extractedText = Buffer.from(bytes).toString("utf-8")
  } else if (ext === ".pdf") {
    // For PDFs, read raw bytes and try to extract printable ASCII text.
    // Production should use a proper PDF parser or OCR.
    extractedText = Buffer.from(bytes).toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ")
  }

  if (!extractedText.trim()) {
    await fs.unlink(filePath).catch(() => {})
    return NextResponse.json({ error: "Could not extract text from document" }, { status: 422 })
  }

  // ── Persist KnowledgeDocument ───────────────────────────────────────────────
  const orgSlug = resolveOrgSlug(ctx.user)
  const doc = await prisma.knowledgeDocument.create({
    data: {
      orgSlug,
      title,
      storagePath: `uploads/knowledge/${fileName}`,
      createdByUserId: ctx.user.id,
    },
  })

  // ── Chunk + embed + index (async but awaited so we can report chunk count) ─
  const chunkCount = await indexKnowledgeDocument(doc.id, orgSlug, extractedText)

  await createAuditLog({
    actorUserId: ctx.user.id,
    entityType: "knowledge_document",
    entityId: doc.id,
    action: "upload",
    after: { title, orgSlug, chunkCount },
  })

  return NextResponse.json(
    { documentId: doc.id, title, orgSlug, chunkCount },
    { status: 201 }
  )
}
