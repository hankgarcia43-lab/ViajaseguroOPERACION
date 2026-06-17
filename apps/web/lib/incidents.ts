export type IncidentQuickType =
  | 'sos'
  | 'fraud_suspicion'
  | 'attempted_theft'
  | 'suspicious_behavior'
  | 'payment_problem'
  | 'driver_mismatch'
  | 'vehicle_mismatch'
  | 'off_platform_payment_request'
  | 'passenger_mismatch'
  | 'wrong_code'
  | 'unvalidated_boarding_attempt'
  | 'fake_payment_attempt'
  | 'unsafe_boarding_point'
  | 'other_problem';

export type IncidentType = 'comment' | 'report' | 'alert' | IncidentQuickType;

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  comment: 'Comentario',
  report: 'Reporte',
  alert: 'Alerta',
  sos: 'Emergencia / SOS',
  fraud_suspicion: 'Sospecha de fraude',
  attempted_theft: 'Intento de robo',
  suspicious_behavior: 'Conducta sospechosa',
  payment_problem: 'Problema con pago',
  driver_mismatch: 'El conductor no coincide',
  vehicle_mismatch: 'El vehiculo no coincide',
  off_platform_payment_request: 'Me pidieron pago fuera de la plataforma',
  passenger_mismatch: 'El pasajero no coincide',
  wrong_code: 'Codigo incorrecto',
  unvalidated_boarding_attempt: 'Intento de abordar sin validacion',
  fake_payment_attempt: 'Intento de pago falso',
  unsafe_boarding_point: 'Punto de abordaje inseguro',
  other_problem: 'Otro problema'
};

export const PASSENGER_QUICK_REPORT_OPTIONS: Array<{ value: IncidentQuickType; label: string }> = [
  { value: 'driver_mismatch', label: INCIDENT_TYPE_LABELS.driver_mismatch },
  { value: 'vehicle_mismatch', label: INCIDENT_TYPE_LABELS.vehicle_mismatch },
  { value: 'off_platform_payment_request', label: INCIDENT_TYPE_LABELS.off_platform_payment_request },
  { value: 'unsafe_boarding_point', label: INCIDENT_TYPE_LABELS.unsafe_boarding_point },
  { value: 'fraud_suspicion', label: INCIDENT_TYPE_LABELS.fraud_suspicion },
  { value: 'attempted_theft', label: INCIDENT_TYPE_LABELS.attempted_theft },
  { value: 'suspicious_behavior', label: INCIDENT_TYPE_LABELS.suspicious_behavior },
  { value: 'sos', label: INCIDENT_TYPE_LABELS.sos },
  { value: 'other_problem', label: INCIDENT_TYPE_LABELS.other_problem }
];

export const DRIVER_QUICK_REPORT_OPTIONS: Array<{ value: IncidentQuickType; label: string }> = [
  { value: 'passenger_mismatch', label: INCIDENT_TYPE_LABELS.passenger_mismatch },
  { value: 'wrong_code', label: INCIDENT_TYPE_LABELS.wrong_code },
  { value: 'unvalidated_boarding_attempt', label: INCIDENT_TYPE_LABELS.unvalidated_boarding_attempt },
  { value: 'suspicious_behavior', label: INCIDENT_TYPE_LABELS.suspicious_behavior },
  { value: 'fake_payment_attempt', label: INCIDENT_TYPE_LABELS.fake_payment_attempt },
  { value: 'unsafe_boarding_point', label: INCIDENT_TYPE_LABELS.unsafe_boarding_point },
  { value: 'attempted_theft', label: INCIDENT_TYPE_LABELS.attempted_theft },
  { value: 'sos', label: INCIDENT_TYPE_LABELS.sos },
  { value: 'other_problem', label: INCIDENT_TYPE_LABELS.other_problem }
];

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  message: string;
  status: 'open' | 'reviewing' | 'resolved' | 'false_alarm';
  routeId: string | null;
  routeOfferId: string | null;
  tripId: string | null;
  reservationId: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  reviewedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export interface CreateIncidentPayload {
  type: IncidentType;
  title: string;
  message: string;
  routeId?: string;
  routeOfferId?: string;
  tripId?: string;
  reservationId?: string;
}
