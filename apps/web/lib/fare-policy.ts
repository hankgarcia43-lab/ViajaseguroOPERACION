export type FarePolicyMode = 'fixed_per_km' | 'max_per_km';

export interface FarePolicy {
  id: string;
  mode: FarePolicyMode;
  ratePerKm: number;
  appCommissionPercent: 5 | 10 | 15;
  currency: string;
  isActive: boolean;
  notes: string | null;
  createdByAdminUserId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByAdmin?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface FarePolicyPayload {
  mode: FarePolicyMode;
  ratePerKm: number;
  appCommissionPercent: 5 | 10 | 15;
  currency?: string;
  notes?: string;
}
