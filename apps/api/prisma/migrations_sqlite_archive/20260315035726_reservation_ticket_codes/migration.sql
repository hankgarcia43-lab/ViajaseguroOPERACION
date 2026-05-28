/*
  Warnings:

  - Added the required column `numeric_code` to the `reservations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qr_token` to the `reservations` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trip_id" TEXT NOT NULL,
    "passenger_user_id" TEXT NOT NULL,
    "total_seats" INTEGER NOT NULL,
    "companion_count" INTEGER NOT NULL,
    "total_amount" REAL NOT NULL,
    "numeric_code" TEXT NOT NULL,
    "qr_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reservations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reservations_passenger_user_id_fkey" FOREIGN KEY ("passenger_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_reservations" ("companion_count", "created_at", "id", "passenger_user_id", "status", "total_amount", "total_seats", "trip_id", "updated_at") SELECT "companion_count", "created_at", "id", "passenger_user_id", "status", "total_amount", "total_seats", "trip_id", "updated_at" FROM "reservations";
DROP TABLE "reservations";
ALTER TABLE "new_reservations" RENAME TO "reservations";
CREATE UNIQUE INDEX "reservations_numeric_code_key" ON "reservations"("numeric_code");
CREATE UNIQUE INDEX "reservations_qr_token_key" ON "reservations"("qr_token");
CREATE INDEX "reservations_trip_id_idx" ON "reservations"("trip_id");
CREATE INDEX "reservations_passenger_user_id_idx" ON "reservations"("passenger_user_id");
CREATE INDEX "reservations_status_idx" ON "reservations"("status");
CREATE INDEX "reservations_numeric_code_idx" ON "reservations"("numeric_code");
CREATE INDEX "reservations_qr_token_idx" ON "reservations"("qr_token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
