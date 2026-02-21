import { prisma } from "@/lib/prisma"
import { embedText, embeddingToSql } from "./embedder"
import type { SessionUser } from "@/lib/auth-utils"
import { Role } from "@prisma/client"

export interface VectorSearchResult {
  chunkId: string
  documentId: string
  chunkText: string
  chunkIndex: number
  title: string
  distance: number // cosine distance — lower is more similar
}

const INTERNAL_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.TERMINAL_ADMIN,
  Role.SECURITY,
  Role.SURVEYOR,
  Role.HSE_OFFICER,
  Role.AUDITOR,
  Role.TRAFFIC_CONTROLLER,
])

function resolveOrgSlug(user: SessionUser): string | null {
  if (INTERNAL_ROLES.has(user.role as Role)) return "eipl"
  if (user.role === Role.CLIENT && user.clientId) return user.clientId
  if (user.role === Role.TRANSPORTER && user.transporterId) return user.transporterId
  return null
}

/** External roles (CLIENT, TRANSPORTER) may only read documents marked ORG_ONLY. */
function isExternalUser(user: SessionUser): boolean {
  return user.role === Role.CLIENT || user.role === Role.TRANSPORTER
}

/**
 * Semantic vector search over KnowledgeChunks using pgvector cosine distance.
 * Scoped to the user's org. External users are further restricted to
 * documents with permissions = 'ORG_ONLY' (not INTERNAL_ONLY).
 */
export async function searchKnowledgeVector(
  query: string,
  user: SessionUser,
  limit: number = 8
): Promise<VectorSearchResult[]> {
  const orgSlug = resolveOrgSlug(user)
  if (!orgSlug) return []

  const safeLimit = Math.min(Math.max(limit, 1), 50)

  // Embed the query
  const queryVec = await embedText(query)
  const vecLiteral = embeddingToSql(queryVec)

  // External users can only see ORG_ONLY documents
  const permissionsFilter = isExternalUser(user)
    ? `AND kd.permissions = 'ORG_ONLY'`
    : ""

  // pgvector cosine distance operator: <=>
  const rows = await prisma.$queryRawUnsafe<
    {
      chunkId: string
      documentId: string
      chunkText: string
      chunkIndex: number
      title: string
      distance: number
    }[]
  >(
    `SELECT
       kc.id          AS "chunkId",
       kc."documentId",
       kc."chunkText",
       kc."chunkIndex",
       kd.title,
       kc.embedding <=> $1::vector AS distance
     FROM "KnowledgeChunk" kc
     JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
     WHERE kc."orgSlug" = $2
       AND kc.embedding IS NOT NULL
       ${permissionsFilter}
     ORDER BY distance ASC
     LIMIT $3`,
    vecLiteral,
    orgSlug,
    safeLimit
  )

  return rows
}
