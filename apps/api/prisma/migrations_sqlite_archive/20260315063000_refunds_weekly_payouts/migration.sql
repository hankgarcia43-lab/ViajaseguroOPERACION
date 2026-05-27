-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "admin_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "refunds_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "refunds_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_payouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driver_user_id" TEXT NOT NULL,
    "period_start" DATETIME NOT NULL,
    "period_end" DATETIME NOT NULL,
    "gross_amount" REAL NOT NULL,
    "app_commission_amount" REAL NOT NULL,
    "refunded_amount" REAL NOT NULL,
    "net_amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "weekly_payouts_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "refunds_payment_id_key" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_reservation_id_idx" ON "refunds"("reservation_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_admin_user_id_idx" ON "refunds"("admin_user_id");

-- CreateIndex
CREATE INDEX "weekly_payouts_driver_user_id_idx" ON "weekly_payouts"("driver_user_id");

-- CreateIndex
CREATE INDEX "weekly_payouts_period_start_period_end_idx" ON "weekly_payouts"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_payouts_driver_user_id_period_start_period_end_key" ON "weekly_payouts"("driver_user_id", "period_start", "period_end");
