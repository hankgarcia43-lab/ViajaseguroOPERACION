export type TripStatus = 'scheduled' | 'started' | 'finished' | 'cancelled';

export interface DriverTripRouteSummary {
  id: string;
  title: string | null;
  origin: string;
  destination: string;
  status: string;
}

export interface DriverTrip {
  id: string;
  publicId: number | null;
  routeId: string;
  driverUserId: string;
  tripDate: string;
  departureTimeSnapshot: string;
  estimatedArrivalTimeSnapshot: string;
  availableSeatsSnapshot: number;
  pricePerSeatSnapshot: number;
  boardingReference: string | null;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
  route: DriverTripRouteSummary | null;
  driver?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  reservationSummary?: {
    reservationsCount: number;
    reservedSeats: number;
    remainingSeats: number;
    boardedReservationsCount?: number;
    boardedSeats?: number;
    pendingReservationsCount?: number;
    pendingSeats?: number;
  };
  earningsSummary?: {
    grossCollected: number;
    appCommissionAmount: number;
    driverNetAmount: number;
    refundedAmount: number;
    driverNetAfterRefunds: number;
  };
}

export interface CreateTripPayload {
  routeId: string;
  tripDate: string;
  boardingReference: string;
}


