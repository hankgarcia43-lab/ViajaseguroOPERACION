ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "operational_status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "recognition_level" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "admin_notes" TEXT;

CREATE INDEX IF NOT EXISTS "users_operational_status_idx" ON "users"("operational_status");
CREATE INDEX IF NOT EXISTS "users_recognition_level_idx" ON "users"("recognition_level");