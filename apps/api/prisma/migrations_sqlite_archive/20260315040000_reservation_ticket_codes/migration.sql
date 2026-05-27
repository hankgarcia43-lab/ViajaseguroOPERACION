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

INSERT INTO "new_reservations" (
  "id",
  "trip_id",
  "passenger_user_id",
  "total_seats",
  "companion_count",
  "total_amount",
  "numeric_code",
  "qr_token",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "trip_id",
  "passenger_user_id",
  "total_seats",
  "companion_count",
  "total_amount",
  printf('%08d', abs(random()) % 100000000),
  lower(hex(randomblob(16))),
  "status",
  "created_at",
  "updated_at"
FROM "reservations";

DROP TABLE "reservations";
ALTER TABLE "new_reservations" RENAME TO "reservations";

CREATE UNIQUE INDEX "reservations_numeric_code_key" ON "reservations"("numeric_code");
CREATE UNIQUE INDEX "reservations_qr_token_key" ON "reservations"("qr_token");
CREATE INDEX "reservations_trip_id_idx" ON "reservations"("trip_id");
CREATE INDEX "reservations_passenger_user_id_idx" ON "reservations"("passenger_user_id");
CREATE INDEX "reservations_status_idx" ON "reservations"("status");
CREATE INDEX "reservations_numericCode_idx" ON "reservations"("numeric_code");
CREATE INDEX "reservations_qrToken_idx" ON "reservations"("qr_token");

PRAGMA foreign_keys=ON;
