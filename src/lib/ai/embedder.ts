import { getGeminiClient, GEMINI_EMBED_MODEL, GEMINI_EMBED_DIMS } from "./gemini-client"

/**
 * Generate an embedding vector for a single text string.
 * Uses gemini-embedding-001, reduced to GEMINI_EMBED_DIMS (768) via outputDimensionality.
 */
export async function embedText(text: string): Promise<number[]> {
  const model = getGeminiClient().getGenerativeModel({ model: GEMINI_EMBED_MODEL })
  const result = await model.embedContent({
    content: { parts: [{ text: text.slice(0, 8000) }], role: "user" },
    outputDimensionality: GEMINI_EMBED_DIMS,
  })
  return result.embedding.values
}

/**
 * Generate embeddings for multiple texts using batchEmbedContents.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const model = getGeminiClient().getGenerativeModel({ model: GEMINI_EMBED_MODEL })
  const result = await model.batchEmbedContents({
    requests: texts.map((text) => ({
      content: { parts: [{ text: text.slice(0, 8000) }], role: "user" },
      outputDimensionality: GEMINI_EMBED_DIMS,
    })),
  })
  return result.embeddings.map((e) => e.values)
}

/**
 * Serialise a number[] embedding to the Postgres literal format
 * that pgvector accepts: '[0.1,0.2,...]'
 */
export function embeddingToSql(vec: number[]): string {
  return `[${vec.join(",")}]`
}
