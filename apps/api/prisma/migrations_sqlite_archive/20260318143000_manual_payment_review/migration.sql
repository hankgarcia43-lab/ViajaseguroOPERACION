ALTER TABLE "payments" ADD COLUMN "payment_method_label" TEXT;
ALTER TABLE "payments" ADD COLUMN "payment_instructions" TEXT;
ALTER TABLE "payments" ADD COLUMN "proof_file_name" TEXT;
ALTER TABLE "payments" ADD COLUMN "proof_file_path" TEXT;
ALTER TABLE "payments" ADD COLUMN "reviewed_by_admin_user_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "reviewed_at" DATETIME;
ALTER TABLE "payments" ADD COLUMN "review_notes" TEXT;