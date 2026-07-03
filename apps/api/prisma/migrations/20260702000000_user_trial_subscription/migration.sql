ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscription_status" TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS "plan_type" TEXT,
  ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMP(3);

UPDATE "users"
SET
  "trial_started_at" = COALESCE("trial_started_at", "created_at"),
  "trial_ends_at" = COALESCE("trial_ends_at", "created_at" + INTERVAL '15 days'),
  "subscription_status" = COALESCE(NULLIF("subscription_status", ''), 'trial')
WHERE "trial_started_at" IS NULL
   OR "trial_ends_at" IS NULL
   OR "subscription_status" IS NULL
   OR "subscription_status" = '';

CREATE INDEX IF NOT EXISTS "users_subscription_status_idx" ON "users"("subscription_status");
CREATE INDEX IF NOT EXISTS "users_trial_ends_at_idx" ON "users"("trial_ends_at");
