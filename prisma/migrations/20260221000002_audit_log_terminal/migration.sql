-- Add terminalId directly to AuditLog for immutable tenant scoping.
-- Nullable so SUPER_ADMIN global actions (no terminal context) are still allowed.
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "terminalId" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_terminalId_idx" ON "AuditLog" ("terminalId");
