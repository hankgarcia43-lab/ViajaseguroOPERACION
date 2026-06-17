export type ReservationStatus =
  | 'paid'
  | 'confirmed'
  | 'boarded'
  | 'cancelled'
  | 'no_show'
  | 'refunded'
  | 'completed';

export type ReservationPaymentStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'refunded';

export interface ReservationPayment {
  id: string;
  reservationId: string;
  amount: number;
  status: ReservationPaymentStatus;
  provider: string;
  providerReference: string | null;
  providerPreferenceId: string | null;
  checkoutUrl: string | null;
  initPoint: string | null;
  sandboxInitPoint: string | null;
  paymentLink: string | null;
  paymentMethodLabel: string | null;
  paymentBeneficiary: string | null;
  paymentReference: string | null;
  paymentBusinessAccount: string | null;
  paymentProcessorLabel: string | null;
  paymentProcessingMessage: string | null;
  paymentInstructions: string | null;
  proofFileName: string | null;
  proofFilePath: string | null;
  proofFileUrl: string | null;
  reviewedByAdminUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  appCommissionAmount: number;
  driverNetAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationRouteSummary {
  id: string;
  title: string | null;
  origin: string;
  destination: string;
}

export interface ReservationTripSummary {
  id: string;
  publicId?: number | null;
  tripDate: string;
  status: string;
  departureTimeSnapshot: string;
  estimatedArrivalTimeSnapshot: string;
  availableSeatsSnapshot: number;
  pricePerSeatSnapshot: number;
  boardingReference: string | null;
  route: ReservationRouteSummary | null;
  driver?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  vehiclePhotoUrl?: string | null;
}

export interface Reservation {
  id: string;
  publicId: number | null;
  tripId: string;
  passengerUserId: string;
  weeklyReservationGroupId: string | null;
  isWeeklyPaymentPrimary: boolean;
  totalSeats: number;
  companionCount: number;
  totalAmount: number;
  numericCode: string | null;
  qrToken: string | null;
  qrValue: string | null;
  boardingCodeEnabled: boolean;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  remainingSeats: number | null;
  payment: ReservationPayment | null;
  trip: ReservationTripSummary | null;
  passenger?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface CreateReservationPayload {
  tripId: string;
  totalSeats: number;
  selectedWeekdays?: string[];
}

export interface ValidateBoardingPayload {
  numericCode?: string;
  qrToken?: string;
  tripId?: string;
}

export interface AvailableTrip {
  id: string;
  publicId: number | null;
  routeId: string;
  routeOfferId: string | null;
  driverUserId: string;
  tripDate: string;
  departureTimeSnapshot: string;
  estimatedArrivalTimeSnapshot: string;
  availableSeatsSnapshot: number;
  pricePerSeatSnapshot: number;
  status: string;
  remainingSeats: number;
  nearbyDistanceKm?: number | null;
  isNearUser?: boolean;
  isReservable: boolean;
  route: {
    id: string;
    title: string | null;
    origin: string;
    destination: string;
    weekdays?: string[];
    originLat?: number | null;
    originLng?: number | null;
    destinationLat?: number | null;
    destinationLng?: number | null;
    originPlaceId?: string | null;
    destinationPlaceId?: string | null;
    stopsText?: string | null;
    status: string;
  } | null;
}
