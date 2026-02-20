import { prisma } from "@/lib/prisma"
import { chunkText } from "./chunker"
import { embedBatch, embeddingToSql } from "./embedder"
import { logger } from "@/lib/logger"
import { randomUUID } from "crypto"

/**
 * Chunk a text, generate embeddings, and store KnowledgeChunks.
 * Returns the number of chunks created.
 */
export async function indexKnowledgeDocument(
  documentId: string,
  orgSlug: string,
  text: string
): Promise<number> {
  if (!text.trim()) return 0

  const chunks = chunkText(text, { chunkSize: 500, overlap: 100 })
  if (chunks.length === 0) return 0

  // Embed all chunks in one batched call
  const embeddings = await embedBatch(chunks.map((c) => c.chunkText))

  // Delete any existing chunks for this document (re-index scenario)
  await prisma.knowledgeChunk.deleteMany({ where: { documentId } })

  // Insert chunks with embeddings via raw SQL (Prisma can't write vector type)
  for (let i = 0; i < chunks.length; i++) {
    const { chunkIndex, chunkText: text } = chunks[i]
    const embLiteral = embeddingToSql(embeddings[i])

    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeChunk" ("id", "documentId", "orgSlug", "chunkIndex", "chunkText", "embedding", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
      randomUUID(),
      documentId,
      orgSlug,
      chunkIndex,
      text,
      embLiteral
    )
  }

  logger.info({ documentId, orgSlug, chunks: chunks.length }, "Knowledge document indexed")
  return chunks.length
}

/**
 * Remove all chunks for a document (used before re-indexing or on delete).
 */
export async function deleteKnowledgeChunks(documentId: string): Promise<void> {
  await prisma.knowledgeChunk.deleteMany({ where: { documentId } })
}
