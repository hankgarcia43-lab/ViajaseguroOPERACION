export type RequestedRouteStatus = 'open' | 'driver_offered' | 'confirmed' | 'cancelled' | 'expired';
export type DriverRouteProposalStatus = 'pending_user_response' | 'accepted_by_user' | 'rejected_by_user' | 'cancelled_by_driver';

export interface DriverRouteProposal {
  id: string;
  requestedRouteId: string;
  driverId: string;
  proposedTime: string;
  boardingPoint: string;
  boardingReference: string;
  suggestedCashContribution: number;
  availableSeats: number;
  messageToUser: string | null;
  status: DriverRouteProposalStatus;
  driver: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    verificationStatus: string;
    vehicle: {
      id: string;
      plates: string;
      brand: string;
      model: string;
      year: number;
      color: string | null;
      seatCount: number;
      status: string;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestedRoute {
  id: string;
  userId: string;
  originText: string;
  destinationText: string;
  desiredDate: string | null;
  recurrenceDays: string[];
  desiredTime: string;
  seatsNeeded: number;
  message: string | null;
  status: RequestedRouteStatus;
  proposals: DriverRouteProposal[];
  createdAt: string;
  updatedAt: string;
}

export const WEEKDAY_OPTIONS = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miercoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sabado' },
  { value: 'sunday', label: 'Domingo' }
];

export function formatWeekdays(values?: string[]) {
  if (!values?.length) return 'Fecha unica o por definir';
  return values.map((value) => WEEKDAY_OPTIONS.find((option) => option.value === value)?.label ?? value).join(', ');
}

export function getRequestedRouteStatusLabel(status: string) {
  const map: Record<string, string> = {
    open: 'Abierta',
    driver_offered: 'Con propuesta de conductor',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    expired: 'Expirada'
  };
  return map[status] ?? status;
}

export function getProposalStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending_user_response: 'Pendiente de tu respuesta',
    accepted_by_user: 'Aceptada por usuario',
    rejected_by_user: 'Rechazada',
    cancelled_by_driver: 'Cancelada por conductor'
  };
  return map[status] ?? status;
}
