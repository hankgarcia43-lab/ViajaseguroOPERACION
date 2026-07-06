ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscription_status" TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS "plan_type" TEXT,
  ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMP(3);

UPDATE "users"
SET
  "trial_started_at" = COALESCE("trial_started_at", "created_at"),
  "trial_ends_at" = COALESCE("trial_started_at", "created_at") + INTERVAL '7 days',
  "subscription_status" = COALESCE(NULLIF("subscription_status", ''), 'trial')
WHERE COALESCE(NULLIF("subscription_status", ''), 'trial') = 'trial';

ALTER TABLE "users"
  ALTER COLUMN "subscription_status" SET DEFAULT 'trial',
  ALTER COLUMN "subscription_status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "users_subscription_status_idx" ON "users"("subscription_status");
CREATE INDEX IF NOT EXISTS "users_trial_ends_at_idx" ON "users"("trial_ends_at");
