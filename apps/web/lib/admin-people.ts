import { apiRequest } from '@/lib/api';
import { VerificationStatus } from '@/lib/user-documents';

export type AdminPersonRole = 'passenger' | 'driver' | 'admin';
export type AdminOperationalStatus = 'active' | 'suspended';
export type AdminRecognitionLevel = 'standard' | 'excellent';

export interface AdminPeopleSummary {
  total: number;
  passengers: number;
  drivers: number;
  admins: number;
  active: number;
  suspended: number;
  excellent: number;
  pendingVerifications: number;
  trialUsers?: number;
  activeSubscriptions?: number;
  expiredSubscriptions?: number;
}

export interface AdminPersonDocument {
  id: string;
  documentType: string;
  documentNumber: string | null;
  fileName: string | null;
  filePath: string | null;
  fileUrl: string | null;
  notes: string | null;
  status: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPersonVehicle {
  id: string;
  plates: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  seatCount: number;
  insurancePolicy: string | null;
  status: string;
  documents: AdminPersonDocument[];
}

export interface AdminPerson {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: AdminPersonRole;
  verificationStatus: VerificationStatus;
  operationalStatus: AdminOperationalStatus;
  recognitionLevel: AdminRecognitionLevel;
  subscription?: {
    status: string;
    planType: string | null;
    trialDaysRemaining: number;
    trialEndsAt: string | null;
    subscriptionExpiresAt: string | null;
    isTrialActive: boolean;
    isActivePaid: boolean;
  };
  adminNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  driverProfileStatus: VerificationStatus | null;
  passengerProfileStatus: VerificationStatus | null;
  vehicle: AdminPersonVehicle | null;
  documents: AdminPersonDocument[];
  counts: {
    reservations: number;
    trips: number;
    routes: number;
    routeOffers: number;
    weeklyPayouts: number;
    userDocuments: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchAdminPeopleSummary(token: string) {
  return apiRequest<AdminPeopleSummary>('/admin/people/summary', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function fetchAdminPeople(token: string, filters: { q?: string; role?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  const query = params.toString();
  return apiRequest<AdminPerson[]>(`/admin/people${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function runAdminPersonAction(token: string, userId: string, action: 'suspend' | 'activate' | 'promote' | 'standard' | 'activate-subscription' | 'expire-subscription', notes?: string) {
  return apiRequest<AdminPerson>(`/admin/people/${userId}/${action}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ notes: notes?.trim() || undefined })
  });
}

export function deleteAdminPerson(token: string, userId: string) {
  return apiRequest<{ userId: string; deleted: boolean; message: string }>(`/admin/people/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}
