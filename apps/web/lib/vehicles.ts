export type VehicleStatus = 'pending' | 'approved' | 'rejected';
export type VehicleDocumentType = 'vehicle_registration' | 'insurance_policy' | 'vehicle_photo' | 'driver_photo';

export const VEHICLE_DOCUMENT_TYPE_OPTIONS: Array<{ value: VehicleDocumentType; label: string }> = [
  { value: 'vehicle_registration', label: 'Tarjeta de circulacion' },
  { value: 'insurance_policy', label: 'Poliza de seguro' },
  { value: 'vehicle_photo', label: 'Foto del vehiculo' },
  { value: 'driver_photo', label: 'Foto del conductor' }
];

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  documentType: VehicleDocumentType;
  fileName: string | null;
  filePath: string | null;
  fileUrl: string | null;
  notes: string | null;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  driverUserId: string;
  plates: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  seatCount: number;
  insurancePolicy: string | null;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
  documents: VehicleDocument[];
  requiredDocuments?: {
    insurance_policy: boolean;
    vehicle_registration: boolean;
    vehicle_photo: boolean;
    driver_photo: boolean;
  };
}

export interface AdminVehicleDetail extends Vehicle {
  driver: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
}

export interface PendingVehicleSummary {
  vehicleId: string;
  driverUserId: string;
  driverName: string;
  driverEmail: string;
  status: VehicleStatus;
  plates: string;
  brand: string;
  model: string;
  pendingDocumentsCount: number;
  updatedAt: string;
}

export interface VehiclePayload {
  plates: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  seatCount: number;
  insurancePolicy?: string;
}
