export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type UserDocumentType = 'identity_document_front' | 'identity_document_back' | 'identity_document';

export const USER_DOCUMENT_TYPE_OPTIONS: Array<{ value: UserDocumentType; label: string }> = [
  { value: 'identity_document_front', label: 'INE frente' },
  { value: 'identity_document_back', label: 'INE reverso' },
  { value: 'identity_document', label: 'INE (legado)' }
];

export interface UserDocument {
  id: string;
  userId: string;
  userRole: 'passenger' | 'driver';
  documentType: UserDocumentType;
  documentNumber: string | null;
  fileName: string | null;
  filePath: string | null;
  fileUrl: string | null;
  notes: string | null;
  status: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'passenger' | 'driver';
  verificationStatus: VerificationStatus;
  driverProfileStatus: VerificationStatus | null;
  passengerProfileStatus: VerificationStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingVerificationSummary {
  userId: string;
  fullName: string;
  email: string;
  role: 'passenger' | 'driver';
  verificationStatus: VerificationStatus;
  pendingDocumentsCount: number;
  lastDocumentAt: string | null;
}

export interface VerificationDetail {
  user: VerificationProfile;
  documents: UserDocument[];
}
