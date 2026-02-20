-- Resize KnowledgeChunk.embedding from vector(1536) to vector(768)
-- Required for Gemini text-embedding-004 which outputs 768-dimensional vectors.

-- Drop the existing ivfflat index first (can't alter indexed vector column)
DROP INDEX IF EXISTS "KnowledgeChunk_embedding_idx";

-- Change dimension (safe: existing rows all have NULL embeddings)
ALTER TABLE "KnowledgeChunk" ALTER COLUMN embedding TYPE vector(768);

-- Recreate ivfflat index for cosine similarity
CREATE INDEX "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
