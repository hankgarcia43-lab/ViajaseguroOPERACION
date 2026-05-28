-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driver_user_id" TEXT NOT NULL,
    "plates" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT,
    "seat_count" INTEGER NOT NULL,
    "insurance_policy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vehicles_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_name" TEXT,
    "file_path" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vehicle_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_driver_user_id_key" ON "vehicles"("driver_user_id");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicle_id_idx" ON "vehicle_documents"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_documents_status_idx" ON "vehicle_documents"("status");

-- CreateIndex
CREATE INDEX "vehicle_documents_document_type_idx" ON "vehicle_documents"("document_type");

-- RedefineIndex
DROP INDEX "payments_reservationId_idx";
CREATE INDEX "payments_reservation_id_idx" ON "payments"("reservation_id");

-- RedefineIndex
DROP INDEX "reservations_qrToken_idx";
CREATE INDEX "reservations_qr_token_idx" ON "reservations"("qr_token");

-- RedefineIndex
DROP INDEX "reservations_numericCode_idx";
CREATE INDEX "reservations_numeric_code_idx" ON "reservations"("numeric_code");

