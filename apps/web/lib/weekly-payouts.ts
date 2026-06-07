export interface WeeklyPayout {
  id: string;
  driverUserId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  appCommissionAmount: number;
  refundedAmount: number;
  netAmount: number;
  status: 'pending' | 'requested' | 'paid' | string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  driver: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface WeeklyPayoutStatsTotals {
  totalCompletedTrips: number;
  totalMoney: number;
  appCommissionAmount: number;
  appCommissionPercent: number;
  netAmount: number;
}

export interface WeeklyPayoutStatsByDriver {
  driverUserId: string;
  driver: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  completedTrips: number;
  totalMoney: number;
  appCommissionAmount: number;
  appCommissionPercent: number;
  netAmount: number;
}

export interface WeeklyPayoutStatsResponse {
  periodStart: string | null;
  periodEnd: string | null;
  totals: WeeklyPayoutStatsTotals;
  byDriver: WeeklyPayoutStatsByDriver[];
}

export interface GenerateWeeklyPayoutPayload {
  periodStart: string;
  periodEnd: string;
  driverUserId?: string;
}

export interface MarkPayoutPaidPayload {
  notes?: string;
}

export interface DriverBankDetails {
  isComplete: boolean;
  message?: string;
}

export interface UpdateDriverBankDetailsPayload {}
