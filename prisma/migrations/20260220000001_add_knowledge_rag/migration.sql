-- Enable pgvector extension (Neon Postgres has it pre-installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeDocument: org-scoped SOP / compliance knowledge base
CREATE TABLE "KnowledgeDocument" (
  "id"              TEXT NOT NULL,
  "orgSlug"         TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "sourceType"      TEXT NOT NULL DEFAULT 'UPLOAD',
  "storagePath"     TEXT NOT NULL,
  "permissions"     TEXT NOT NULL DEFAULT 'INTERNAL_ONLY',
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- KnowledgeChunk: text chunks with 1536-dim embeddings (text-embedding-3-small)
CREATE TABLE "KnowledgeChunk" (
  "id"         TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "orgSlug"    TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "chunkText"  TEXT NOT NULL,
  "embedding"  vector(1536),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "KnowledgeChunk"
  ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FK from KnowledgeDocument to User
ALTER TABLE "KnowledgeDocument"
  ADD CONSTRAINT "KnowledgeDocument_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "KnowledgeDocument_orgSlug_idx" ON "KnowledgeDocument"("orgSlug");
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");
CREATE INDEX "KnowledgeChunk_orgSlug_idx"    ON "KnowledgeChunk"("orgSlug");

-- IVFFlat index for approximate nearest-neighbour cosine search
-- lists=50 is appropriate for up to ~500k chunks
CREATE INDEX "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
