import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserDocumentsService } from '../user-documents/user-documents.service';
import { UpsertVehicleDto } from './dto/upsert-vehicle.dto';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { ReviewVehicleDto } from './dto/review-vehicle.dto';

type VehicleRecord = {
  id: string;
  driverUserId: string;
  plates: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  seatCount: number;
  insurancePolicy: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  documents?: VehicleDocumentRecord[];
  driver?: any;
};

type VehicleDocumentRecord = {
  id: string;
  vehicleId: string;
  documentType: string;
  fileName: string | null;
  filePath: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const VEHICLE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

const REQUIRED_VEHICLE_DOCUMENT_TYPES = ['insurance_policy', 'vehicle_registration', 'vehicle_photo', 'driver_photo'] as const;

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userDocumentsService: UserDocumentsService
  ) {}

  async create(driverUserId: string, dto: UpsertVehicleDto) {
    await this.userDocumentsService.ensureUserApprovedForRole(driverUserId, 'driver');

    const existingVehicle = await this.vehicleDelegate().findUnique({
      where: { driverUserId },
      include: { documents: { orderBy: [{ createdAt: 'desc' }] } }
    });

    if (existingVehicle) {
      throw new BadRequestException('Ya existe un vehiculo registrado. Usa editar mi vehiculo.');
    }

    const vehicle = await this.vehicleDelegate().create({
      data: {
        driverUserId,
        plates: dto.plates,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        seatCount: dto.seatCount,
        insurancePolicy: dto.insurancePolicy ?? null,
        status: VEHICLE_STATUS.PENDING
      },
      include: {
        documents: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    });

    return this.mapVehicle(vehicle as VehicleRecord);
  }

  async myVehicle(driverUserId: string) {
    await this.ensureDriver(driverUserId);

    const vehicle = await this.vehicleDelegate().findUnique({
      where: { driverUserId },
      include: {
        documents: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    });

    if (!vehicle) {
      throw new NotFoundException('Aun no has registrado un vehiculo');
    }

    return this.mapVehicle(vehicle as VehicleRecord);
  }

  async update(driverUserId: string, dto: UpsertVehicleDto) {
    await this.userDocumentsService.ensureUserApprovedForRole(driverUserId, 'driver');

    const vehicle = await this.findOwnedVehicle(driverUserId);

    const updated = await this.vehicleDelegate().update({
      where: { id: vehicle.id },
      data: {
        plates: dto.plates,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        seatCount: dto.seatCount,
        insurancePolicy: dto.insurancePolicy ?? null,
        status: vehicle.status === VEHICLE_STATUS.REJECTED ? VEHICLE_STATUS.PENDING : vehicle.status
      },
      include: {
        documents: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    });

    return this.mapVehicle(updated as VehicleRecord);
  }

  async addDocument(driverUserId: string, dto: CreateVehicleDocumentDto, file: any) {
    await this.userDocumentsService.ensureUserApprovedForRole(driverUserId, 'driver');

    const vehicle = await this.findOwnedVehicle(driverUserId);

    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo de evidencia');
    }

    const document = await this.prisma.vehicleDocument.create({
      data: {
        vehicleId: vehicle.id,
        documentType: dto.documentType,
        fileName: file.originalname,
        filePath: `/uploads/vehicle-documents/${file.filename}`,
        notes: dto.notes || null,
        status: VEHICLE_STATUS.PENDING
      }
    });

    if (vehicle.status === VEHICLE_STATUS.REJECTED) {
      await this.vehicleDelegate().update({
        where: { id: vehicle.id },
        data: { status: VEHICLE_STATUS.PENDING }
      });
    }

    return this.mapVehicleDocument(document as VehicleDocumentRecord);
  }

  async findPendingVehicles() {
    const vehicles = await this.vehicleDelegate().findMany({
      where: {
        status: VEHICLE_STATUS.PENDING
      },
      include: {
        driver: true,
        documents: {
          orderBy: [{ createdAt: 'desc' }]
        }
      },
      orderBy: [{ updatedAt: 'asc' }]
    });

    const readyVehicles = (vehicles as VehicleRecord[]).filter((vehicle) => this.hasAllRequiredDocuments(vehicle.documents ?? []));

    return readyVehicles.map((vehicle) => ({
      id: vehicle.id,
      vehicleId: vehicle.id,
      driverUserId: vehicle.driverUserId,
      driverName: vehicle.driver?.fullName ?? 'Conductor',
      driverEmail: vehicle.driver?.email ?? '',
      status: this.mapStatus(vehicle.status),
      plates: vehicle.plates,
      brand: vehicle.brand,
      model: vehicle.model,
      pendingDocumentsCount: (vehicle.documents ?? []).filter((document) => document.status === VEHICLE_STATUS.PENDING).length,
      updatedAt: vehicle.updatedAt
    }));
  }

  async findByIdForAdmin(vehicleId: string) {
    const vehicle = await this.vehicleDelegate().findUnique({
      where: { id: vehicleId },
      include: {
        driver: true,
        documents: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    });

    if (!vehicle) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    return this.mapVehicle(vehicle as VehicleRecord, true);
  }

  async approve(vehicleId: string, dto: ReviewVehicleDto) {
    return this.reviewVehicle(vehicleId, VEHICLE_STATUS.APPROVED, dto);
  }

  async reject(vehicleId: string, dto: ReviewVehicleDto) {
    return this.reviewVehicle(vehicleId, VEHICLE_STATUS.REJECTED, dto);
  }

  async ensureDriverCanOperate(driverUserId: string) {
    await this.userDocumentsService.ensureUserApprovedForRole(driverUserId, 'driver');

    const vehicle = await this.vehicleDelegate().findUnique({
      where: { driverUserId }
    });

    if (!vehicle) {
      throw new ForbiddenException('Necesitas registrar y aprobar tu vehiculo para operar rutas o trips');
    }

    if (vehicle.status !== VEHICLE_STATUS.APPROVED) {
      throw new ForbiddenException('Necesitas un vehiculo aprobado para operar rutas o trips');
    }

    return vehicle;
  }

  private async reviewVehicle(
    vehicleId: string,
    status: (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS],
    dto: ReviewVehicleDto
  ) {
    const vehicle = await this.findByIdForAdmin(vehicleId);

    if (vehicle.documents.length === 0) {
      throw new BadRequestException('El vehiculo no tiene documentos para revisar');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { status }
      });

      const pendingDocuments = await tx.vehicleDocument.findMany({
        where: {
          vehicleId,
          status: VEHICLE_STATUS.PENDING
        }
      });

      for (const document of pendingDocuments) {
        await tx.vehicleDocument.update({
          where: { id: document.id },
          data: {
            status,
            notes: this.mergeNotes(document.notes, dto.notes, status)
          }
        });
      }
    });

    return this.findByIdForAdmin(vehicleId);
  }

  private async findOwnedVehicle(driverUserId: string) {
    await this.ensureDriver(driverUserId);

    const vehicle = await this.vehicleDelegate().findUnique({
      where: { driverUserId },
      include: {
        documents: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    });

    if (!vehicle) {
      throw new NotFoundException('Aun no has registrado un vehiculo');
    }

    return vehicle as VehicleRecord;
  }

  private async ensureDriver(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role.toLowerCase() !== 'driver') {
      throw new ForbiddenException('Solo conductores pueden operar vehiculos');
    }

    if (!user.driverProfile) {
      throw new ForbiddenException('No existe perfil de conductor');
    }

    return user;
  }

  private mergeNotes(current: string | null, incoming?: string, status?: string) {
    if (!incoming) {
      return current;
    }

    const prefix = status === VEHICLE_STATUS.REJECTED ? 'Revision admin vehiculo: rechazo' : 'Revision admin vehiculo: aprobacion';
    const next = `${prefix} - ${incoming}`;
    return current ? `${current}\n${next}` : next;
  }

  private mapStatus(status: string): 'pending' | 'approved' | 'rejected' {
    if (status.toLowerCase() === 'approved') return 'approved';
    if (status.toLowerCase() === 'rejected') return 'rejected';
    return 'pending';
  }

  private hasAllRequiredDocuments(documents: VehicleDocumentRecord[]) {
    return REQUIRED_VEHICLE_DOCUMENT_TYPES.every((requiredType) =>
      documents.some(
        (document) =>
          document.documentType === requiredType &&
          String(document.status).toLowerCase() !== VEHICLE_STATUS.REJECTED
      )
    );
  }

  requiredVehicleDocumentsStatus(documents: VehicleDocumentRecord[]) {
    return {
      insurance_policy: documents.some((document) => document.documentType === 'insurance_policy'),
      vehicle_registration: documents.some((document) => document.documentType === 'vehicle_registration'),
      vehicle_photo: documents.some((document) => document.documentType === 'vehicle_photo'),
      driver_photo: documents.some((document) => document.documentType === 'driver_photo')
    };
  }
  private mapVehicleDocument(document: VehicleDocumentRecord) {
    return {
      id: document.id,
      vehicleId: document.vehicleId,
      documentType: document.documentType,
      fileName: document.fileName,
      filePath: document.filePath,
      fileUrl: document.filePath,
      notes: document.notes,
      status: this.mapStatus(document.status),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }

  private mapVehicle(vehicle: VehicleRecord, includeDriver = false) {
    return {
      id: vehicle.id,
      driverUserId: vehicle.driverUserId,
      plates: vehicle.plates,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      seatCount: vehicle.seatCount,
      insurancePolicy: vehicle.insurancePolicy,
      status: this.mapStatus(vehicle.status),
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
      driver: includeDriver && vehicle.driver
        ? {
            id: vehicle.driver.id,
            fullName: vehicle.driver.fullName,
            email: vehicle.driver.email,
            phone: vehicle.driver.phone
          }
        : null,
      documents: (vehicle.documents ?? []).map((document) => this.mapVehicleDocument(document)),
      requiredDocuments: this.requiredVehicleDocumentsStatus(vehicle.documents ?? [])
    };
  }

  private vehicleDelegate() {
    return (this.prisma as unknown as { vehicle: any }).vehicle;
  }
}









