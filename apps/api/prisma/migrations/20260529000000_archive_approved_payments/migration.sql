ALTER TABLE "payments" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "archived_by_admin_user_id" TEXT;

UPDATE "payments"
SET "archived_at" = COALESCE("reviewed_at", "updated_at")
WHERE LOWER("status") IN ('approved', 'paid')
  AND "archived_at" IS NULL;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_archived_by_admin_user_id_fkey"
FOREIGN KEY ("archived_by_admin_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "payments_archived_at_idx" ON "payments"("archived_at");
CREATE INDEX "payments_archived_by_admin_user_id_idx" ON "payments"("archived_by_admin_user_id");