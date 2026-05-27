-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "route_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "trip_date" DATETIME NOT NULL,
    "departure_time_snapshot" TEXT NOT NULL,
    "estimated_arrival_time_snapshot" TEXT NOT NULL,
    "available_seats_snapshot" INTEGER NOT NULL,
    "price_per_seat_snapshot" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trips_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trip_id" TEXT NOT NULL,
    "passenger_user_id" TEXT NOT NULL,
    "total_seats" INTEGER NOT NULL,
    "companion_count" INTEGER NOT NULL,
    "total_amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reservations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reservations_passenger_user_id_fkey" FOREIGN KEY ("passenger_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "trips_route_id_idx" ON "trips"("route_id");

-- CreateIndex
CREATE INDEX "trips_driver_user_id_idx" ON "trips"("driver_user_id");

-- CreateIndex
CREATE INDEX "trips_trip_date_idx" ON "trips"("trip_date");

-- CreateIndex
CREATE INDEX "reservations_trip_id_idx" ON "reservations"("trip_id");

-- CreateIndex
CREATE INDEX "reservations_passenger_user_id_idx" ON "reservations"("passenger_user_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");
