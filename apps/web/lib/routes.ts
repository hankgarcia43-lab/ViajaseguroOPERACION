export const WEEKDAY_OPTIONS = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miercoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sabado' },
  { value: 'sunday', label: 'Domingo' }
] as const;

export type WeekdayValue = (typeof WEEKDAY_OPTIONS)[number]['value'];

export type RouteStatus = 'active' | 'paused';

export const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface RoutePublisher {
  id: string;
  fullName: string;
  email: string;
}

export interface FarePolicySummary {
  id: string;
  mode: 'fixed_per_km' | 'max_per_km';
  ratePerKm: number;
  currency: string;
  isActive?: boolean;
  notes?: string | null;
  createdByAdminUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdByAdmin?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface RouteInitialViaje {
  id: string;
  publicId: number | null;
  routeId: string;
  tripDate: string;
  departureTimeSnapshot: string;
  estimatedArrivalTimeSnapshot: string;
  availableSeatsSnapshot: number;
  pricePerSeatSnapshot: number;
  boardingReference: string | null;
  status: string;
}

export interface DriverRoute {
  id: string;
  publicId: number | null;
  driverUserId: string;
  farePolicyId: string | null;
  title: string | null;
  origin: string;
  destination: string;
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  nearbyDistanceKm?: number | null;
  stopsText: string | null;
  weekdays: WeekdayValue[];
  departureTime: string;
  estimatedArrivalTime: string;
  availableSeats: number;
  pricePerSeat: number;
  farePolicyMode: string | null;
  fareRatePerKmApplied: number | null;
  maxAllowedPrice: number | null;
  status: RouteStatus;
  createdAt: string;
  updatedAt: string;
  farePolicy?: FarePolicySummary | null;
  initialTrip?: RouteInitialViaje | null;
  initialViaje?: RouteInitialViaje | null;
  driver?: RoutePublisher | null;
  publishedBy?: RoutePublisher | null;
}


export interface TakeViajePayload {
  boardingReference?: string;
  departureTime?: string;
  estimatedArrivalTime?: string;
  availableSeats?: number;
}
export interface TakeViajeResponse {
  route: DriverRoute;
  trip: RouteInitialViaje;
  message: string;
}

export interface AssignableDriver {
  id: string;
  fullName: string;
  email: string;
  vehicleStatus: string;
}

export interface RoutePayload {
  title?: string;
  origin: string;
  destination: string;
  originPlaceId?: string;
  destinationPlaceId?: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  stopsText?: string;
  weekdays?: string[];
  departureTime?: string;
  estimatedArrivalTime?: string;
  availableSeats?: number;
  pricePerSeat?: number;
}

export interface NearbyRoutesQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}

export interface AdminRoutePayload extends RoutePayload {}

export function isValidTimeHHmm(value: string) {
  return HHMM_REGEX.test(value);
}

export function farePolicyModeLabel(mode?: string | null) {
  if (mode === 'fixed_per_km') return 'Tarifa fija por km';
  return 'Tarifa maxima por km';
}







