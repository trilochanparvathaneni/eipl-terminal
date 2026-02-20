import { getOpenAIClient } from "./openai-client"

const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small"
// text-embedding-3-small → 1536 dims (matches vector(1536) in DB)

/**
 * Generate an embedding vector for a single text string.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAIClient().embeddings.create({
    model: EMBED_MODEL,
    input: text.slice(0, 8191), // model token limit guard
  })
  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in one batched API call.
 * Max 2048 inputs per call per OpenAI limits.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const response = await getOpenAIClient().embeddings.create({
    model: EMBED_MODEL,
    input: texts.map((t) => t.slice(0, 8191)),
  })
  // Results are returned in the same order as input
  return response.data.map((d) => d.embedding)
}

/**
 * Serialise a number[] embedding to the Postgres literal format
 * that pgvector accepts: '[0.1,0.2,...]'
 */
export function embeddingToSql(vec: number[]): string {
  return `[${vec.join(",")}]`
}
