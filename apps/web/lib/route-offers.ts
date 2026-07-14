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
  createdAt?: string;
  updatedAt?: string;
  latestOfferUpdatedAt?: string | null;
  latestActivityAt?: string;
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
  referralDiscountRequested?: boolean;
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



function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function routeActivityTimestamp(route: Pick<BaseRouteSummary, 'latestActivityAt' | 'latestOfferUpdatedAt' | 'updatedAt' | 'createdAt'>) {
  return Math.max(
    toTimestamp(route.latestActivityAt),
    toTimestamp(route.latestOfferUpdatedAt),
    toTimestamp(route.updatedAt),
    toTimestamp(route.createdAt)
  );
}

export function sortRoutesForFeed<T extends BaseRouteSummary>(routes: T[], options: { preferLowerCompetition?: boolean } = {}) {
  return [...routes].sort((a, b) => {
    const statusRank = (route: BaseRouteSummary) => (String(route.status).toLowerCase() === 'active' ? 0 : 1);
    const statusDiff = statusRank(a) - statusRank(b);
    if (statusDiff !== 0) return statusDiff;

    const activityDiff = routeActivityTimestamp(b) - routeActivityTimestamp(a);
    if (activityDiff !== 0) return activityDiff;

    const aDrivers = a.activeDriversCount ?? 0;
    const bDrivers = b.activeDriversCount ?? 0;
    if (aDrivers !== bDrivers) {
      return options.preferLowerCompetition ? aDrivers - bDrivers : bDrivers - aDrivers;
    }

    return (b.publicId ?? 0) - (a.publicId ?? 0);
  });
}
