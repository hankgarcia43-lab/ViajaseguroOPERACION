import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { DriverProfilesService } from '../driver-profiles/driver-profiles.service';
import { PassengerProfilesService } from '../passenger-profiles/passenger-profiles.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateUserDocumentDto } from './dto/create-user-document.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';

type UserDocumentRecord = {
  id: string;
  userId: string;
  userRole: string;
  documentType: string;
  documentNumber: string | null;
  fileName: string | null;
  filePath: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const DOCUMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

const ALLOWED_USER_ROLES = ['passenger', 'driver'] as const;
const INE_FRONT_TYPE = 'identity_document_front';
const INE_BACK_TYPE = 'identity_document_back';
const LEGACY_INE_TYPE = 'identity_document';
const SUBSCRIPTION_PAYMENT_PROOF_TYPE = 'subscription_payment_proof';

@Injectable()
export class UserDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly passengerProfilesService: PassengerProfilesService
  ) {}

  async createForUser(userId: string, dto: CreateUserDocumentDto, file: any) {
    const user = await this.ensureVerifiableUser(userId);

    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo de evidencia');
    }

    const role = this.usersService.mapRole(user.role) as 'passenger' | 'driver';
    const allowedDocumentTypes = new Set([INE_FRONT_TYPE, INE_BACK_TYPE, LEGACY_INE_TYPE, SUBSCRIPTION_PAYMENT_PROOF_TYPE]);

    if (!allowedDocumentTypes.has(dto.documentType)) {
      throw new BadRequestException('Tipo de documento no permitido para esta etapa');
    }

    const document = await this.prisma.userDocument.create({
      data: {
        userId: user.id,
        userRole: role,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber || null,
        fileName: file.originalname,
        filePath: '/uploads/user-documents/' + file.filename,
        notes: dto.notes || null,
        status: DOCUMENT_STATUS.PENDING
      }
    });

    if (dto.documentType !== SUBSCRIPTION_PAYMENT_PROOF_TYPE && this.usersService.mapStatus(user.verificationStatus) === 'rejected') {
      await this.syncUserVerificationStatus(user.id, role, DOCUMENT_STATUS.PENDING);
    }

    return this.mapDocument(document);
  }

  async findMyDocuments(userId: string) {
    await this.ensureVerifiableUser(userId);

    const documents = await this.prisma.userDocument.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }]
    });

    return documents.map((document) => this.mapDocument(document));
  }

  async findPendingVerifications() {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [...ALLOWED_USER_ROLES] },
        verificationStatus: DOCUMENT_STATUS.PENDING,
        userDocuments: {
          some: {
            status: DOCUMENT_STATUS.PENDING
          }
        }
      },
      include: {
        userDocuments: {
          where: { status: DOCUMENT_STATUS.PENDING },
          orderBy: [{ createdAt: 'desc' }]
        }
      },
      orderBy: [{ createdAt: 'asc' }]
    });

    return users.map((user) => ({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: this.usersService.mapRole(user.role),
      verificationStatus: this.usersService.mapStatus(user.verificationStatus),
      pendingDocumentsCount: user.userDocuments.length,
      lastDocumentAt: user.userDocuments[0]?.createdAt ?? null
    }));
  }

  async findVerificationByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
        passengerProfile: true,
        userDocuments: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const role = this.usersService.mapRole(user.role) as 'passenger' | 'driver' | 'admin';
    if (role !== 'passenger' && role !== 'driver') {
      throw new ForbiddenException('Solo usuarios y conductores tienen flujo de verificacion documental');
    }

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: role as 'passenger' | 'driver',
        verificationStatus: this.usersService.mapStatus(user.verificationStatus),
        driverProfileStatus: user.driverProfile ? this.usersService.mapStatus(user.driverProfile.status) : null,
        passengerProfileStatus: user.passengerProfile ? this.usersService.mapStatus(user.passengerProfile.status) : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      documents: user.userDocuments.map((document) => this.mapDocument(document))
    };
  }

  async approveVerification(userId: string, dto: ReviewVerificationDto) {
    return this.reviewVerification(userId, DOCUMENT_STATUS.APPROVED, dto);
  }

  async rejectVerification(userId: string, dto: ReviewVerificationDto) {
    return this.reviewVerification(userId, DOCUMENT_STATUS.REJECTED, dto);
  }

  async ensureUserApprovedForRole(userId: string, requiredRole: 'passenger' | 'driver') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
        passengerProfile: true
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const role = this.usersService.mapRole(user.role) as 'passenger' | 'driver' | 'admin';
    if (role !== requiredRole) {
      throw new ForbiddenException('No tienes permisos para esta accion');
    }

    if (this.usersService.mapStatus(user.verificationStatus) !== 'approved') {
      throw new ForbiddenException(
        requiredRole === 'driver'
          ? 'Debes completar y aprobar tu verificacion para operar rutas o trips'
          : 'Debes completar y aprobar tu verificacion para solicitar rutas'
      );
    }

    if (requiredRole === 'driver' && (!user.driverProfile || this.usersService.mapStatus(user.driverProfile.status) !== 'approved')) {
      throw new ForbiddenException('Tu perfil de conductor debe estar aprobado para operar rutas o trips');
    }

    if (
      requiredRole === 'passenger' &&
      (!user.passengerProfile || this.usersService.mapStatus(user.passengerProfile.status) !== 'approved')
    ) {
      throw new ForbiddenException('Tu perfil de usuario debe estar aprobado para solicitar rutas');
    }

    return user;
  }

  private async reviewVerification(
    userId: string,
    status: (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS],
    dto: ReviewVerificationDto
  ) {
    const detail = await this.findVerificationByUserId(userId);

    if (detail.documents.length === 0) {
      throw new BadRequestException('El usuario no tiene documentos para revisar');
    }

    if (status === DOCUMENT_STATUS.APPROVED && !this.hasIneFrontAndBack(detail.documents)) {
      throw new BadRequestException('No puedes aprobar: faltan INE frente y/o INE reverso del usuario');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { verificationStatus: status }
      });

      if (detail.user.role === 'driver') {
        await tx.driverProfile.updateMany({
          where: { userId },
          data: { status }
        });
      }

      if (detail.user.role === 'passenger') {
        await tx.passengerProfile.updateMany({
          where: { userId },
          data: { status }
        });
      }

      const pendingDocuments = await tx.userDocument.findMany({
        where: {
          userId,
          status: DOCUMENT_STATUS.PENDING
        }
      });

      for (const document of pendingDocuments) {
        await tx.userDocument.update({
          where: { id: document.id },
          data: {
            status,
            notes: this.mergeNotes(document.notes, dto.notes, status)
          }
        });
      }
    });

    return this.findVerificationByUserId(userId);
  }

  private async syncUserVerificationStatus(
    userId: string,
    role: 'passenger' | 'driver',
    status: 'pending' | 'approved' | 'rejected'
  ) {
    await this.usersService.updateVerificationStatus(userId, status);

    if (role === 'driver') {
      await this.driverProfilesService.updateStatusForUser(userId, status);
      return;
    }

    await this.passengerProfilesService.updateStatusForUser(userId, status);
  }

  private async ensureVerifiableUser(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const role = this.usersService.mapRole(user.role) as 'passenger' | 'driver' | 'admin';
    if (role !== 'passenger' && role !== 'driver') {
      throw new ForbiddenException('Solo usuarios y conductores pueden subir documentos de verificacion');
    }

    return user;
  }

  private hasIneFrontAndBack(documents: Array<{ documentType: string; notes: string | null; status: string }>) {
    const activeDocs = documents.filter((document) => this.usersService.mapStatus(document.status) !== DOCUMENT_STATUS.REJECTED);

    const hasFront = activeDocs.some((document) => {
      const type = String(document.documentType || '').toLowerCase();
      if (type === INE_FRONT_TYPE) return true;
      if (type === LEGACY_INE_TYPE) {
        const notes = String(document.notes || '').toLowerCase();
        return notes.includes('frente') || notes.includes('front');
      }
      return false;
    });

    const hasBack = activeDocs.some((document) => {
      const type = String(document.documentType || '').toLowerCase();
      if (type === INE_BACK_TYPE) return true;
      if (type === LEGACY_INE_TYPE) {
        const notes = String(document.notes || '').toLowerCase();
        return notes.includes('reverso') || notes.includes('back');
      }
      return false;
    });

    return hasFront && hasBack;
  }

  private mergeNotes(current: string | null, incoming?: string, status?: string) {
    if (!incoming) {
      return current;
    }

    const prefix = status === DOCUMENT_STATUS.REJECTED ? 'Revision admin: rechazo' : 'Revision admin: aprobacion';
    const next = prefix + ' - ' + incoming;
    return current ? current + '\n' + next : next;
  }

  private mapDocument(document: UserDocumentRecord) {
    return {
      id: document.id,
      userId: document.userId,
      userRole: document.userRole,
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      fileName: document.fileName,
      filePath: document.filePath,
      fileUrl: document.filePath,
      notes: document.notes,
      status: this.usersService.mapStatus(document.status),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }
}
