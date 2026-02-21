-- Add capacity configuration fields to Terminal for forecast engine
ALTER TABLE "Terminal"
  ADD COLUMN IF NOT EXISTS "insideYardLimit"   INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "outsideQueueLimit" INTEGER NOT NULL DEFAULT 15;
