import { NextRequest, NextResponse } from "next/server"
import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import path from "path"
import { indexKnowledgeDocument } from "@/lib/ai/knowledge-indexer"
import { createAuditLog } from "@/lib/audit"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXT = new Set([".pdf", ".txt", ".md", ".csv"])

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

  // ── Extract text from buffer in memory (no disk write — works on Vercel) ───
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  let extractedText = ""
  if (ext === ".txt" || ext === ".md" || ext === ".csv") {
    extractedText = buffer.toString("utf-8")
  } else if (ext === ".pdf") {
    // Naive printable-ASCII extraction for text-based PDFs.
    // Binary/scanned PDFs should go through /api/ai/ocr instead.
    extractedText = buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/ {3,}/g, " ")
  }

  if (!extractedText.trim()) {
    return NextResponse.json(
      { error: "Could not extract text. For scanned PDFs or images use /api/ai/ocr instead." },
      { status: 422 }
    )
  }

  // ── Persist KnowledgeDocument (storagePath = "memory" — no file stored) ───
  const orgSlug = resolveOrgSlug(ctx.user)

  let doc: { id: string }
  try {
    doc = await prisma.knowledgeDocument.create({
      data: {
        orgSlug,
        title,
        storagePath: "memory",
        createdByUserId: ctx.user.id,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "DB error creating document", detail: msg }, { status: 500 })
  }

  // ── Chunk + embed + store KnowledgeChunks ──────────────────────────────────
  let chunkCount = 0
  try {
    chunkCount = await indexKnowledgeDocument(doc.id, orgSlug, extractedText)
  } catch (err) {
    // Clean up the document record if indexing fails
    await prisma.knowledgeDocument.delete({ where: { id: doc.id } }).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Indexing failed", detail: msg }, { status: 500 })
  }

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
