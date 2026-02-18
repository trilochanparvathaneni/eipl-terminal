import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import type { SessionUser } from "@/lib/auth-utils"

export interface SearchResult {
  chunkId: string
  chunkText: string
  chunkIndex: number
  documentRecordId: string
  documentType: string | null
  linkType: string | null
  linkId: string | null
  rank: number
}

interface SearchFilters {
  documentType?: string
  linkType?: string
  linkId?: string
}

/**
 * Full-text search over DocumentChunk using PostgreSQL ts_vector.
 * Falls back to ILIKE if tsquery returns nothing.
 */
export async function searchKnowledge(
  query: string,
  user: SessionUser,
  filters?: SearchFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50)

  // Build RBAC filter: CLIENT users only see chunks linked to their bookings
  let rbacJoin = ""
  let rbacWhere = ""
  if (user.role === Role.CLIENT && user.clientId) {
    rbacJoin = `JOIN "DocumentRecord" dr ON dc."documentRecordId" = dr.id`
    rbacWhere = `AND (dr."linkType" = 'BOOKING' AND dr."linkId" IN (
      SELECT id FROM "Booking" WHERE "clientId" = '${user.clientId}'
    ))`
  } else if (user.role === Role.TRANSPORTER && user.transporterId) {
    rbacJoin = `JOIN "DocumentRecord" dr ON dc."documentRecordId" = dr.id`
    rbacWhere = `AND (dr."linkType" = 'BOOKING' AND dr."linkId" IN (
      SELECT id FROM "Booking" WHERE "transporterId" = '${user.transporterId}'
    ))`
  } else {
    rbacJoin = `JOIN "DocumentRecord" dr ON dc."documentRecordId" = dr.id`
    rbacWhere = ""
  }

  // Metadata filters
  let metaWhere = ""
  if (filters?.documentType) {
    metaWhere += ` AND dc.metadata->>'documentType' = '${filters.documentType}'`
  }
  if (filters?.linkType) {
    metaWhere += ` AND dc.metadata->>'linkType' = '${filters.linkType}'`
  }
  if (filters?.linkId) {
    metaWhere += ` AND dc.metadata->>'linkId' = '${filters.linkId}'`
  }

  // Try full-text search first
  const tsResults = await prisma.$queryRawUnsafe<SearchResult[]>(`
    SELECT
      dc.id AS "chunkId",
      dc."chunkText",
      dc."chunkIndex",
      dc."documentRecordId",
      dc.metadata->>'documentType' AS "documentType",
      dc.metadata->>'linkType' AS "linkType",
      dc.metadata->>'linkId' AS "linkId",
      ts_rank(to_tsvector('english', dc."chunkText"), plainto_tsquery('english', $1)) AS rank
    FROM "DocumentChunk" dc
    ${rbacJoin}
    WHERE to_tsvector('english', dc."chunkText") @@ plainto_tsquery('english', $1)
    ${rbacWhere}
    ${metaWhere}
    ORDER BY rank DESC
    LIMIT $2
  `, query, safeLimit)

  if (tsResults.length > 0) return tsResults

  // Fallback to ILIKE
  const ilikeResults = await prisma.$queryRawUnsafe<SearchResult[]>(`
    SELECT
      dc.id AS "chunkId",
      dc."chunkText",
      dc."chunkIndex",
      dc."documentRecordId",
      dc.metadata->>'documentType' AS "documentType",
      dc.metadata->>'linkType' AS "linkType",
      dc.metadata->>'linkId' AS "linkId",
      1.0 AS rank
    FROM "DocumentChunk" dc
    ${rbacJoin}
    WHERE dc."chunkText" ILIKE '%' || $1 || '%'
    ${rbacWhere}
    ${metaWhere}
    ORDER BY dc."createdAt" DESC
    LIMIT $2
  `, query, safeLimit)

  return ilikeResults
}
