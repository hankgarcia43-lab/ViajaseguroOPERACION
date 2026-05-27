CREATE TABLE "fare_policies" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "mode" TEXT NOT NULL DEFAULT 'max_per_km',
  "rate_per_km" REAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_by_admin_user_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "fare_policies_created_by_admin_user_id_fkey" FOREIGN KEY ("created_by_admin_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "routes" ADD COLUMN "fare_policy_id" TEXT;
ALTER TABLE "routes" ADD COLUMN "distance_km" REAL NOT NULL DEFAULT 1;
ALTER TABLE "routes" ADD COLUMN "fare_policy_mode" TEXT;
ALTER TABLE "routes" ADD COLUMN "fare_rate_per_km_applied" REAL;
ALTER TABLE "routes" ADD COLUMN "max_allowed_price" REAL;

CREATE INDEX "fare_policies_is_active_idx" ON "fare_policies"("is_active");
CREATE INDEX "fare_policies_created_by_admin_user_id_idx" ON "fare_policies"("created_by_admin_user_id");
CREATE INDEX "routes_fare_policy_id_idx" ON "routes"("fare_policy_id");