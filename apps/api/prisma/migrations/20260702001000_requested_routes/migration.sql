CREATE TABLE IF NOT EXISTS "requested_routes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "origin_text" TEXT NOT NULL,
  "destination_text" TEXT NOT NULL,
  "desired_date" TIMESTAMP(3),
  "recurrence_days" TEXT,
  "desired_time" TEXT NOT NULL,
  "seats_needed" INTEGER NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requested_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "driver_route_proposals" (
  "id" TEXT NOT NULL,
  "requested_route_id" TEXT NOT NULL,
  "driver_id" TEXT NOT NULL,
  "proposed_time" TEXT NOT NULL,
  "boarding_point" TEXT NOT NULL,
  "boarding_reference" TEXT NOT NULL,
  "suggested_cash_contribution" DOUBLE PRECISION NOT NULL,
  "available_seats" INTEGER NOT NULL,
  "message_to_user" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending_user_response',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_route_proposals_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "requested_routes" ADD CONSTRAINT "requested_routes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "driver_route_proposals" ADD CONSTRAINT "driver_route_proposals_requested_route_id_fkey" FOREIGN KEY ("requested_route_id") REFERENCES "requested_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "driver_route_proposals" ADD CONSTRAINT "driver_route_proposals_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "requested_routes_user_id_idx" ON "requested_routes"("user_id");
CREATE INDEX IF NOT EXISTS "requested_routes_status_idx" ON "requested_routes"("status");
CREATE INDEX IF NOT EXISTS "requested_routes_created_at_idx" ON "requested_routes"("created_at");
CREATE INDEX IF NOT EXISTS "driver_route_proposals_requested_route_id_idx" ON "driver_route_proposals"("requested_route_id");
CREATE INDEX IF NOT EXISTS "driver_route_proposals_driver_id_idx" ON "driver_route_proposals"("driver_id");
CREATE INDEX IF NOT EXISTS "driver_route_proposals_status_idx" ON "driver_route_proposals"("status");
CREATE INDEX IF NOT EXISTS "driver_route_proposals_created_at_idx" ON "driver_route_proposals"("created_at");
