-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'passenger',
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bank_account_number" TEXT,
    "bank_clabe" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passenger_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passenger_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fare_policies" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'max_per_km',
    "rate_per_km" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by_admin_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fare_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "public_id" INTEGER,
    "template_key" TEXT,
    "driver_user_id" TEXT NOT NULL,
    "fare_policy_id" TEXT,
    "title" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "origin_place_id" TEXT,
    "destination_place_id" TEXT,
    "origin_lat" DOUBLE PRECISION,
    "origin_lng" DOUBLE PRECISION,
    "destination_lat" DOUBLE PRECISION,
    "destination_lng" DOUBLE PRECISION,
    "stops_text" TEXT,
    "weekdays" TEXT NOT NULL,
    "departure_time" TEXT NOT NULL,
    "estimated_arrival_time" TEXT NOT NULL,
    "available_seats" INTEGER NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "price_per_seat" DOUBLE PRECISION NOT NULL,
    "fare_policy_mode" TEXT,
    "fare_rate_per_km_applied" DOUBLE PRECISION,
    "max_allowed_price" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "public_id" INTEGER,
    "route_id" TEXT NOT NULL,
    "route_offer_id" TEXT,
    "driver_user_id" TEXT NOT NULL,
    "trip_date" TIMESTAMP(3) NOT NULL,
    "departure_time_snapshot" TEXT NOT NULL,
    "estimated_arrival_time_snapshot" TEXT NOT NULL,
    "available_seats_snapshot" INTEGER NOT NULL,
    "price_per_seat_snapshot" DOUBLE PRECISION NOT NULL,
    "boarding_reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "public_id" INTEGER,
    "trip_id" TEXT NOT NULL,
    "route_offer_id" TEXT,
    "passenger_user_id" TEXT NOT NULL,
    "total_seats" INTEGER NOT NULL,
    "companion_count" INTEGER NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "numeric_code" TEXT NOT NULL,
    "qr_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'manual_transfer',
    "provider_reference" TEXT,
    "provider_preference_id" TEXT,
    "checkout_url" TEXT,
    "init_point" TEXT,
    "sandbox_init_point" TEXT,
    "payment_method_label" TEXT,
    "payment_instructions" TEXT,
    "proof_file_name" TEXT,
    "proof_file_path" TEXT,
    "reviewed_by_admin_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "app_commission_amount" DOUBLE PRECISION NOT NULL,
    "driver_net_amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "admin_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_payouts" (
    "id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "gross_amount" DOUBLE PRECISION NOT NULL,
    "app_commission_amount" DOUBLE PRECISION NOT NULL,
    "refunded_amount" DOUBLE PRECISION NOT NULL,
    "net_amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT,
    "file_name" TEXT,
    "file_path" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "plates" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT,
    "seat_count" INTEGER NOT NULL,
    "insurance_policy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_name" TEXT,
    "file_path" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_counters" (
    "entity" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_counters_pkey" PRIMARY KEY ("entity")
);

-- CreateTable
CREATE TABLE "route_offers" (
    "id" TEXT NOT NULL,
    "public_id" INTEGER,
    "route_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "boarding_reference" TEXT NOT NULL,
    "weekdays" TEXT NOT NULL,
    "service_type" TEXT NOT NULL DEFAULT 'weekly',
    "price_per_seat" DOUBLE PRECISION NOT NULL,
    "available_seats" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_chat_messages" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "route_offer_id" TEXT,
    "sender_user_id" TEXT NOT NULL,
    "receiver_user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "reporter_user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "route_id" TEXT,
    "route_offer_id" TEXT,
    "trip_id" TEXT,
    "reservation_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_user_id_key" ON "driver_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "passenger_profiles_user_id_key" ON "passenger_profiles"("user_id");

-- CreateIndex
CREATE INDEX "fare_policies_is_active_idx" ON "fare_policies"("is_active");

-- CreateIndex
CREATE INDEX "fare_policies_created_by_admin_user_id_idx" ON "fare_policies"("created_by_admin_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_public_id_key" ON "routes"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_template_key_key" ON "routes"("template_key");

-- CreateIndex
CREATE INDEX "routes_driver_user_id_idx" ON "routes"("driver_user_id");

-- CreateIndex
CREATE INDEX "routes_fare_policy_id_idx" ON "routes"("fare_policy_id");

-- CreateIndex
CREATE INDEX "routes_public_id_idx" ON "routes"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "trips_public_id_key" ON "trips"("public_id");

-- CreateIndex
CREATE INDEX "trips_route_id_idx" ON "trips"("route_id");

-- CreateIndex
CREATE INDEX "trips_driver_user_id_idx" ON "trips"("driver_user_id");

-- CreateIndex
CREATE INDEX "trips_trip_date_idx" ON "trips"("trip_date");

-- CreateIndex
CREATE INDEX "trips_route_offer_id_idx" ON "trips"("route_offer_id");

-- CreateIndex
CREATE INDEX "trips_public_id_idx" ON "trips"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_public_id_key" ON "reservations"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_numeric_code_key" ON "reservations"("numeric_code");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_qr_token_key" ON "reservations"("qr_token");

-- CreateIndex
CREATE INDEX "reservations_trip_id_idx" ON "reservations"("trip_id");

-- CreateIndex
CREATE INDEX "reservations_passenger_user_id_idx" ON "reservations"("passenger_user_id");

-- CreateIndex
CREATE INDEX "reservations_route_offer_id_idx" ON "reservations"("route_offer_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_numeric_code_idx" ON "reservations"("numeric_code");

-- CreateIndex
CREATE INDEX "reservations_qr_token_idx" ON "reservations"("qr_token");

-- CreateIndex
CREATE INDEX "reservations_public_id_idx" ON "reservations"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reservation_id_key" ON "payments"("reservation_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_reservation_id_idx" ON "payments"("reservation_id");

-- CreateIndex
CREATE INDEX "payments_provider_preference_id_idx" ON "payments"("provider_preference_id");

-- CreateIndex
CREATE INDEX "payments_reviewed_by_admin_user_id_idx" ON "payments"("reviewed_by_admin_user_id");

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

-- CreateIndex
CREATE INDEX "user_documents_user_id_idx" ON "user_documents"("user_id");

-- CreateIndex
CREATE INDEX "user_documents_status_idx" ON "user_documents"("status");

-- CreateIndex
CREATE INDEX "user_documents_document_type_idx" ON "user_documents"("document_type");

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

-- CreateIndex
CREATE UNIQUE INDEX "route_offers_public_id_key" ON "route_offers"("public_id");

-- CreateIndex
CREATE INDEX "route_offers_route_id_idx" ON "route_offers"("route_id");

-- CreateIndex
CREATE INDEX "route_offers_driver_user_id_idx" ON "route_offers"("driver_user_id");

-- CreateIndex
CREATE INDEX "route_offers_status_idx" ON "route_offers"("status");

-- CreateIndex
CREATE INDEX "route_offers_public_id_idx" ON "route_offers"("public_id");

-- CreateIndex
CREATE INDEX "trip_chat_messages_reservation_id_idx" ON "trip_chat_messages"("reservation_id");

-- CreateIndex
CREATE INDEX "trip_chat_messages_trip_id_idx" ON "trip_chat_messages"("trip_id");

-- CreateIndex
CREATE INDEX "trip_chat_messages_route_offer_id_idx" ON "trip_chat_messages"("route_offer_id");

-- CreateIndex
CREATE INDEX "trip_chat_messages_sender_user_id_idx" ON "trip_chat_messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "trip_chat_messages_receiver_user_id_idx" ON "trip_chat_messages"("receiver_user_id");

-- CreateIndex
CREATE INDEX "trip_chat_messages_created_at_idx" ON "trip_chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "incident_reports_reporter_user_id_idx" ON "incident_reports"("reporter_user_id");

-- CreateIndex
CREATE INDEX "incident_reports_status_idx" ON "incident_reports"("status");

-- CreateIndex
CREATE INDEX "incident_reports_type_idx" ON "incident_reports"("type");

-- CreateIndex
CREATE INDEX "incident_reports_route_id_idx" ON "incident_reports"("route_id");

-- CreateIndex
CREATE INDEX "incident_reports_route_offer_id_idx" ON "incident_reports"("route_offer_id");

-- CreateIndex
CREATE INDEX "incident_reports_trip_id_idx" ON "incident_reports"("trip_id");

-- CreateIndex
CREATE INDEX "incident_reports_reservation_id_idx" ON "incident_reports"("reservation_id");

-- CreateIndex
CREATE INDEX "incident_reports_reviewed_by_id_idx" ON "incident_reports"("reviewed_by_id");

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passenger_profiles" ADD CONSTRAINT "passenger_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_policies" ADD CONSTRAINT "fare_policies_created_by_admin_user_id_fkey" FOREIGN KEY ("created_by_admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_fare_policy_id_fkey" FOREIGN KEY ("fare_policy_id") REFERENCES "fare_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_offer_id_fkey" FOREIGN KEY ("route_offer_id") REFERENCES "route_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_route_offer_id_fkey" FOREIGN KEY ("route_offer_id") REFERENCES "route_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_passenger_user_id_fkey" FOREIGN KEY ("passenger_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_admin_user_id_fkey" FOREIGN KEY ("reviewed_by_admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_payouts" ADD CONSTRAINT "weekly_payouts_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_offers" ADD CONSTRAINT "route_offers_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_offers" ADD CONSTRAINT "route_offers_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_chat_messages" ADD CONSTRAINT "trip_chat_messages_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_chat_messages" ADD CONSTRAINT "trip_chat_messages_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_chat_messages" ADD CONSTRAINT "trip_chat_messages_route_offer_id_fkey" FOREIGN KEY ("route_offer_id") REFERENCES "route_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_chat_messages" ADD CONSTRAINT "trip_chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_chat_messages" ADD CONSTRAINT "trip_chat_messages_receiver_user_id_fkey" FOREIGN KEY ("receiver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
