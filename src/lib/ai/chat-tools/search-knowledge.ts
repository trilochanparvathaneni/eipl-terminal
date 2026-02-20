import { searchKnowledge } from "@/lib/ai/knowledge-search"
import { searchKnowledgeVector } from "@/lib/ai/knowledge-vector-search"
import type { ChatToolFn } from "./types"

export const searchKnowledgeTool: ChatToolFn = async (params, ctx) => {
  const query = params.query as string
  const filters = params.filters as
    | { document_type?: string; link_type?: string; link_id?: string }
    | undefined

  // Run full-text search (booking docs) + vector search (SOP knowledge base) in parallel
  const [textResults, vectorResults] = await Promise.all([
    searchKnowledge(
      query,
      ctx.user,
      filters
        ? {
            documentType: filters.document_type,
            linkType: filters.link_type,
            linkId: filters.link_id,
          }
        : undefined,
      8
    ),
    searchKnowledgeVector(query, ctx.user, 6),
  ])

  // Merge and deduplicate (vector results use documentId, text results use documentRecordId)
  const combined = [
    ...textResults.map((r) => ({
      text: r.chunkText,
      documentType: r.documentType ?? "document",
      source: "full-text" as const,
      relevance: r.rank,
      documentId: r.documentRecordId,
      snippet: r.chunkText.slice(0, 200),
    })),
    ...vectorResults.map((r) => ({
      text: r.chunkText,
      documentType: r.title,
      source: "knowledge-base" as const,
      relevance: 1 - r.distance, // convert distance → similarity score
      documentId: r.documentId,
      snippet: r.chunkText.slice(0, 200),
    })),
  ]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 12)

  return {
    data: combined.map(({ text, documentType, source, relevance }) => ({
      text,
      documentType,
      source,
      relevance: Math.round(relevance * 100) / 100,
    })),
    citations: combined.map(({ documentId, snippet, source }) => ({
      documentId,
      snippet,
      source,
    })),
  }
}
