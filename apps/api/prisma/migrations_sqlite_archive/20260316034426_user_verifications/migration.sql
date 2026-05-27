-- CreateTable
CREATE TABLE "user_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT,
    "file_name" TEXT,
    "file_path" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_documents_user_id_idx" ON "user_documents"("user_id");

-- CreateIndex
CREATE INDEX "user_documents_status_idx" ON "user_documents"("status");

-- CreateIndex
CREATE INDEX "user_documents_document_type_idx" ON "user_documents"("document_type");

-- RedefineIndex
DROP INDEX "payments_reservationId_idx";
CREATE INDEX "payments_reservation_id_idx" ON "payments"("reservation_id");

-- RedefineIndex
DROP INDEX "reservations_qrToken_idx";
CREATE INDEX "reservations_qr_token_idx" ON "reservations"("qr_token");

-- RedefineIndex
DROP INDEX "reservations_numericCode_idx";
CREATE INDEX "reservations_numeric_code_idx" ON "reservations"("numeric_code");
