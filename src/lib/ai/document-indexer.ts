import { prisma } from "@/lib/prisma"
import { extractTextFromUploadedDocument } from "@/lib/document-extraction"
import { chunkText } from "./chunker"
import { logger } from "@/lib/logger"

/**
 * Index a document's text into searchable chunks.
 * Returns the number of chunks created.
 */
export async function indexDocument(documentRecordId: string): Promise<number> {
  const doc = await prisma.documentRecord.findUnique({
    where: { id: documentRecordId },
    include: { documentType: true },
  })

  if (!doc) {
    logger.warn({ documentRecordId }, "Document not found for indexing")
    return 0
  }

  const text = await extractTextFromUploadedDocument(doc.fileUrl)
  if (!text) {
    logger.warn({ documentRecordId }, "No text extracted from document")
    return 0
  }

  const chunks = chunkText(text)
  if (chunks.length === 0) return 0

  await prisma.documentChunk.createMany({
    data: chunks.map((c) => ({
      documentRecordId,
      chunkIndex: c.chunkIndex,
      chunkText: c.chunkText,
      metadata: {
        documentType: doc.documentType.code,
        linkType: doc.linkType,
        linkId: doc.linkId,
      },
    })),
  })

  return chunks.length
}

/**
 * Delete existing chunks and re-index.
 */
export async function reindexDocument(documentRecordId: string): Promise<number> {
  await prisma.documentChunk.deleteMany({
    where: { documentRecordId },
  })
  return indexDocument(documentRecordId)
}

/**
 * Ensure a document has chunks; index on demand if missing.
 */
export async function ensureIndexed(documentRecordId: string): Promise<void> {
  const count = await prisma.documentChunk.count({
    where: { documentRecordId },
  })
  if (count === 0) {
    await indexDocument(documentRecordId)
  }
}
