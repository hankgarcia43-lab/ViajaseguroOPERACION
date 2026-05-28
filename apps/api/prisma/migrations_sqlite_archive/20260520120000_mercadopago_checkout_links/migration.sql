ALTER TABLE "payments" ADD COLUMN "provider_preference_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "checkout_url" TEXT;
ALTER TABLE "payments" ADD COLUMN "init_point" TEXT;
ALTER TABLE "payments" ADD COLUMN "sandbox_init_point" TEXT;

CREATE INDEX "payments_provider_preference_id_idx" ON "payments"("provider_preference_id");