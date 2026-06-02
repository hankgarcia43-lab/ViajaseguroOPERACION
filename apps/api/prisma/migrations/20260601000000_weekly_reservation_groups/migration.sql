ALTER TABLE "reservations" ADD COLUMN "weekly_reservation_group_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN "is_weekly_payment_primary" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "payments" ADD COLUMN "weekly_reservation_group_id" TEXT;

CREATE INDEX "reservations_weekly_reservation_group_id_idx" ON "reservations"("weekly_reservation_group_id");
CREATE INDEX "payments_weekly_reservation_group_id_idx" ON "payments"("weekly_reservation_group_id");