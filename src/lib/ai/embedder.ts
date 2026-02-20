import { getGeminiClient, GEMINI_EMBED_MODEL } from "./gemini-client"

/**
 * Generate an embedding vector for a single text string.
 * Uses Gemini text-embedding-004 → 768 dimensions.
 */
export async function embedText(text: string): Promise<number[]> {
  const model = getGeminiClient().getGenerativeModel({ model: GEMINI_EMBED_MODEL })
  const result = await model.embedContent(text.slice(0, 8000))
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
