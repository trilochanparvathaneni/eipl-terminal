import { searchKnowledge } from "@/lib/ai/knowledge-search"
import type { ChatToolFn } from "./types"

export const searchKnowledgeTool: ChatToolFn = async (params, ctx) => {
  const query = params.query as string
  const filters = params.filters as
    | { document_type?: string; link_type?: string; link_id?: string }
    | undefined

  const results = await searchKnowledge(
    query,
    ctx.user,
    filters
      ? {
          documentType: filters.document_type,
          linkType: filters.link_type,
          linkId: filters.link_id,
        }
      : undefined,
    10
  )

  return {
    data: results.map((r) => ({
      text: r.chunkText,
      documentType: r.documentType,
      linkType: r.linkType,
      linkId: r.linkId,
      relevance: r.rank,
    })),
    citations: results.map((r) => ({
      documentId: r.documentRecordId,
      snippet: r.chunkText.slice(0, 200),
    })),
  }
}
