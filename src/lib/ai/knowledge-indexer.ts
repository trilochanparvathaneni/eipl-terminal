import { prisma } from "@/lib/prisma"
import { chunkText } from "./chunker"
import { embedBatch, embeddingToSql } from "./embedder"
import { logger } from "@/lib/logger"
import { randomUUID } from "crypto"

export interface IndexResult {
  chunkCount: number
  vectorCount: number
  embeddingError: string | null
}

/**
 * Chunk a text, generate embeddings, and store KnowledgeChunks.
 */
export async function indexKnowledgeDocument(
  documentId: string,
  orgSlug: string,
  text: string
): Promise<IndexResult> {
  if (!text.trim()) return { chunkCount: 0, vectorCount: 0, embeddingError: null }

  const chunks = chunkText(text, { chunkSize: 500, overlap: 100 })
  if (chunks.length === 0) return { chunkCount: 0, vectorCount: 0, embeddingError: null }

  // Attempt to embed all chunks; fall back to NULL embeddings if unavailable.
  let embeddings: (number[] | null)[] = new Array(chunks.length).fill(null)
  let embeddingError: string | null = null
  try {
    const vecs = await embedBatch(chunks.map((c) => c.chunkText))
    embeddings = vecs
  } catch (err) {
    embeddingError = err instanceof Error ? err.message : String(err)
    logger.warn({ documentId, error: embeddingError }, "Embedding failed — storing chunks without vectors (text search only)")
  }

  // Delete any existing chunks for this document (re-index scenario)
  await prisma.knowledgeChunk.deleteMany({ where: { documentId } })

  // Insert chunks; use vector if available, otherwise leave embedding NULL
  for (let i = 0; i < chunks.length; i++) {
    const { chunkIndex, chunkText: text } = chunks[i]
    const vec = embeddings[i]

    if (vec) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" ("id", "documentId", "orgSlug", "chunkIndex", "chunkText", "embedding", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())`,
        randomUUID(), documentId, orgSlug, chunkIndex, text, embeddingToSql(vec)
      )
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" ("id", "documentId", "orgSlug", "chunkIndex", "chunkText", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        randomUUID(), documentId, orgSlug, chunkIndex, text
      )
    }
  }

  const vectorCount = embeddings.filter(Boolean).length

  if (embeddingError) {
    logger.info({ documentId, chunks: chunks.length }, "Chunks stored (text-only, no vectors)")
  }

  logger.info({ documentId, orgSlug, chunks: chunks.length, vectorCount }, "Knowledge document indexed")
  return { chunkCount: chunks.length, vectorCount, embeddingError }
}

/**
 * Remove all chunks for a document (used before re-indexing or on delete).
 */
export async function deleteKnowledgeChunks(documentId: string): Promise<void> {
  await prisma.knowledgeChunk.deleteMany({ where: { documentId } })
}
