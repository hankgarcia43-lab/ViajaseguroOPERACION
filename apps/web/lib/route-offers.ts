export type RouteOfferServiceType = 'one_time' | 'weekly' | 'round_trip';
export type RouteOfferStatus = 'active' | 'paused';

export interface BaseRouteSummary {
  id: string;
  publicId: number | null;
  templateKey?: string | null;
  title: string | null;
  origin: string;
  destination: string;
  weekdays: string[];
  departureTime: string;
  estimatedArrivalTime: string;
  distanceKm: number;
  pricePerSeat: number;
  status: string;
  stopsText?: string | null;
  activeDriversCount?: number;
}

export interface RouteOffer {
  id: string;
  publicId: number | null;
  routeId: string;
  driverUserId: string;
  boardingReference: string;
  weekdays: string[];
  serviceType: RouteOfferServiceType;
  pricePerSeat: number;
  availableSeats: number;
  status: RouteOfferStatus;
  createdAt: string;
  updatedAt: string;
  route: {
    id: string;
    publicId: number | null;
    title: string | null;
    origin: string;
    destination: string;
    departureTime: string;
    estimatedArrivalTime: string;
    distanceKm: number;
    stopsText?: string | null;
  } | null;
  driver: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  vehiclePhotoUrl: string | null;
}

export interface RouteOffersByRouteResponse {
  route: BaseRouteSummary;
  offers: RouteOffer[];
}

export interface CreateRouteOfferPayload {
  routeId: string;
  boardingReference: string;
  weekdays: string[];
  serviceType: RouteOfferServiceType;
  availableSeats: number;
}

export interface CreateReservationByOfferPayload {
  offerId: string;
  selectedWeekdays: string[];
  totalSeats: number;
}

export interface ReservationByOfferResponse {
  routeId: string;
  routeOfferId: string;
  totalDays: number;
  totalSeats: number;
  grossAmount: number;
  totalAmount: number;
  finalAmount: number;
  weeklyDiscountApplied: boolean;
  reservations: any[];
  message: string;
}


