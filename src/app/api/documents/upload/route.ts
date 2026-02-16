import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"
import { NextRequest, NextResponse } from "next/server"
import { createHash, randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff",
  ".txt", ".json", ".csv", ".log",
])

export async function POST(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.DOCUMENT_UPLOAD,
    headers: request.headers,
  })
  if (error) return error

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "file is required.",
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: `File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes.`,
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    const originalName = file.name || "document"
    const ext = path.extname(originalName).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: `Unsupported file type: ${ext || "unknown"}.`,
            requestId: ctx.requestId,
          },
        },
        { status: 400 }
      )
    }

    const safeBase = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 64) || "doc"
    const y = new Date().getUTCFullYear().toString()
    const m = String(new Date().getUTCMonth() + 1).padStart(2, "0")
    const relDir = `/uploads/documents/${y}/${m}`
    const absDir = path.join(process.cwd(), "public", relDir)
    await fs.mkdir(absDir, { recursive: true })

    const fileName = `${safeBase}_${randomUUID().slice(0, 8)}${ext}`
    const absPath = path.join(absDir, fileName)
    const bytes = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(absPath, bytes)

    const checksum = createHash("sha256").update(bytes).digest("hex")
    const fileUrl = `${relDir}/${fileName}`

    return NextResponse.json(
      {
        requestId: ctx.requestId,
        fileUrl,
        checksum,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to upload file.",
          requestId: ctx.requestId,
        },
      },
      { status: 500 }
    )
  }
}
