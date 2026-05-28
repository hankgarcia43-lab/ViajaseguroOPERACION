CREATE TABLE IF NOT EXISTS "trip_chat_messages" (
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

CREATE INDEX IF NOT EXISTS "trip_chat_messages_reservation_id_idx" ON "trip_chat_messages"("reservation_id");
CREATE INDEX IF NOT EXISTS "trip_chat_messages_trip_id_idx" ON "trip_chat_messages"("trip_id");
CREATE INDEX IF NOT EXISTS "trip_chat_messages_route_offer_id_idx" ON "trip_chat_messages"("route_offer_id");
CREATE INDEX IF NOT EXISTS "trip_chat_messages_sender_user_id_idx" ON "trip_chat_messages"("sender_user_id");
CREATE INDEX IF NOT EXISTS "trip_chat_messages_receiver_user_id_idx" ON "trip_chat_messages"("receiver_user_id");
CREATE INDEX IF NOT EXISTS "trip_chat_messages_created_at_idx" ON "trip_chat_messages"("created_at");

DO $$ BEGIN
  ALTER TABLE "trip_chat_messages"
    ADD CONSTRAINT "trip_chat_messages_reservation_id_fkey"
      FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trip_chat_messages"
    ADD CONSTRAINT "trip_chat_messages_trip_id_fkey"
      FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trip_chat_messages"
    ADD CONSTRAINT "trip_chat_messages_route_offer_id_fkey"
      FOREIGN KEY ("route_offer_id") REFERENCES "route_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trip_chat_messages"
    ADD CONSTRAINT "trip_chat_messages_sender_user_id_fkey"
      FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trip_chat_messages"
    ADD CONSTRAINT "trip_chat_messages_receiver_user_id_fkey"
      FOREIGN KEY ("receiver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
