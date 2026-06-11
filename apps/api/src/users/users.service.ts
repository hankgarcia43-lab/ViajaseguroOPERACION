import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  async updateVerificationStatus(userId: string, status: 'pending' | 'approved' | 'rejected' | 'suspended') {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: status
      }
    });
  }

  async getCurrentUserProfile(userId: string) {
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

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: this.mapRole(user.role),
      verificationStatus: this.mapStatus(user.verificationStatus),
      operationalStatus: this.mapOperationalStatus((user as any).operationalStatus),
      recognitionLevel: this.mapRecognitionLevel((user as any).recognitionLevel),
      adminNotes: (user as any).adminNotes ?? null,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      driverProfile: user.driverProfile
        ? {
            id: user.driverProfile.id,
            status: this.mapStatus(user.driverProfile.status),
            bankAccountNumber: user.driverProfile.bankAccountNumber,
            bankClabe: user.driverProfile.bankClabe
          }
        : null,
      passengerProfile: user.passengerProfile
        ? {
            id: user.passengerProfile.id,
            status: this.mapStatus(user.passengerProfile.status)
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  async getAdminPeopleSummary() {
    const user = (this.prisma as any).user;
    const [total, passengers, drivers, admins, active, suspended, excellent, pendingVerifications] = await Promise.all([
      user.count(),
      user.count({ where: { role: 'passenger' } }),
      user.count({ where: { role: 'driver' } }),
      user.count({ where: { role: 'admin' } }),
      user.count({ where: { operationalStatus: 'active' } }),
      user.count({ where: { operationalStatus: 'suspended' } }),
      user.count({ where: { recognitionLevel: 'excellent' } }),
      user.count({ where: { verificationStatus: 'pending' } })
    ]);

    return {
      total,
      passengers,
      drivers,
      admins,
      active,
      suspended,
      excellent,
      pendingVerifications
    };
  }

  async findPeopleForAdmin(filters: { q?: string; role?: string; status?: string }) {
    const where: any = {};
    const role = String(filters.role || '').toLowerCase();
    const status = String(filters.status || '').toLowerCase();
    const q = String(filters.q || '').trim();

    if (['passenger', 'driver', 'admin'].includes(role)) {
      where.role = role;
    }

    if (['active', 'suspended'].includes(status)) {
      where.operationalStatus = status;
    }

    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } }
      ];
    }

    const users = await (this.prisma as any).user.findMany({
      where,
      include: this.adminPeopleInclude(),
      orderBy: [{ createdAt: 'desc' }]
    });

    return users.map((user: any) => this.mapAdminPerson(user));
  }

  async suspendUserForAdmin(adminUserId: string, userId: string, notes?: string) {
    await this.ensureAdminActionAllowed(adminUserId, userId, 'suspender');
    return this.updatePersonStatus(userId, {
      operationalStatus: 'suspended',
      verificationStatus: 'suspended',
      profileStatus: 'suspended',
      notes,
      actionLabel: 'Suspendido por admin'
    });
  }

  async activateUserForAdmin(adminUserId: string, userId: string, notes?: string) {
    await this.ensureAdminActionAllowed(adminUserId, userId, 'reactivar');
    return this.updatePersonStatus(userId, {
      operationalStatus: 'active',
      verificationStatus: 'approved',
      profileStatus: 'approved',
      notes,
      actionLabel: 'Reactivado/aprobado por admin'
    });
  }

  async promoteUserForAdmin(adminUserId: string, userId: string, notes?: string) {
    await this.ensureAdminActionAllowed(adminUserId, userId, 'destacar');
    const current = await this.findAdminPersonOrThrow(userId);
    const updated = await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        recognitionLevel: 'excellent',
        adminNotes: this.appendAdminNote(current.adminNotes, notes, 'Marcado como destacado por buen trabajo')
      },
      include: this.adminPeopleInclude()
    });

    return this.mapAdminPerson(updated);
  }

  async setStandardUserForAdmin(adminUserId: string, userId: string, notes?: string) {
    await this.ensureAdminActionAllowed(adminUserId, userId, 'quitar destacado');
    const current = await this.findAdminPersonOrThrow(userId);
    const updated = await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        recognitionLevel: 'standard',
        adminNotes: this.appendAdminNote(current.adminNotes, notes, 'Regresado a nivel estandar por admin')
      },
      include: this.adminPeopleInclude()
    });

    return this.mapAdminPerson(updated);
  }

  async deleteUserForAdmin(adminUserId: string, userId: string) {
    await this.ensureAdminActionAllowed(adminUserId, userId, 'eliminar');
    const target = await this.findAdminPersonOrThrow(userId);
    if (String(target.role || '').toLowerCase() === 'admin') {
      throw new ForbiddenException('No se pueden eliminar cuentas admin desde este panel');
    }

    const blockers = await this.getUserDeleteBlockers(userId);
    if (blockers.length > 0) {
      throw new BadRequestException(`No se puede eliminar porque tiene historial: ${blockers.join(', ')}. Usa Suspender para conservar trazabilidad.`);
    }

    await (this.prisma as any).user.delete({ where: { id: userId } });
    return { userId, deleted: true, message: 'Usuario eliminado correctamente.' };
  }
  validateRole(userRole: string, requiredRole: 'passenger' | 'driver' | 'admin') {
    if (this.mapRole(userRole) !== requiredRole) {
      throw new ForbiddenException('No tienes permisos para este recurso');
    }
  }

  mapRole(role: string): 'passenger' | 'driver' | 'admin' {
    if (role.toLowerCase() === 'driver') return 'driver';
    if (role.toLowerCase() === 'admin') return 'admin';
    return 'passenger';
  }

  mapStatus(status: string): 'pending' | 'approved' | 'rejected' | 'suspended' {
    const normalized = status.toLowerCase();
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'suspended') return 'suspended';
    return 'pending';
  }

  private mapOperationalStatus(status: string | null | undefined): 'active' | 'suspended' {
    return String(status || '').toLowerCase() === 'suspended' ? 'suspended' : 'active';
  }

  private mapRecognitionLevel(level: string | null | undefined): 'standard' | 'excellent' {
    return String(level || '').toLowerCase() === 'excellent' ? 'excellent' : 'standard';
  }

  private adminPeopleInclude() {
    return {
      driverProfile: true,
      passengerProfile: true,
      userDocuments: { orderBy: [{ createdAt: 'desc' }] },
      vehicle: { include: { documents: { orderBy: [{ createdAt: 'desc' }] } } },
      _count: {
        select: {
          reservations: true,
          trips: true,
          routes: true,
          routeOffers: true,
          weeklyPayouts: true,
          userDocuments: true
        }
      }
    };
  }

  private mapAdminPerson(user: any) {
    const documents = Array.isArray(user.userDocuments) ? user.userDocuments : [];
    const vehicleDocuments = Array.isArray(user.vehicle?.documents) ? user.vehicle.documents : [];
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: this.mapRole(user.role),
      verificationStatus: this.mapStatus(user.verificationStatus),
      operationalStatus: this.mapOperationalStatus(user.operationalStatus),
      recognitionLevel: this.mapRecognitionLevel(user.recognitionLevel),
      adminNotes: user.adminNotes ?? null,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      driverProfileStatus: user.driverProfile ? this.mapStatus(user.driverProfile.status) : null,
      passengerProfileStatus: user.passengerProfile ? this.mapStatus(user.passengerProfile.status) : null,
      vehicle: user.vehicle
        ? {
            id: user.vehicle.id,
            plates: user.vehicle.plates,
            brand: user.vehicle.brand,
            model: user.vehicle.model,
            year: user.vehicle.year,
            color: user.vehicle.color,
            seatCount: user.vehicle.seatCount,
            insurancePolicy: user.vehicle.insurancePolicy,
            status: user.vehicle.status,
            documents: vehicleDocuments.map((document: any) => this.mapAdminDocument(document))
          }
        : null,
      documents: documents.map((document: any) => this.mapAdminDocument(document)),
      counts: user._count ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private mapAdminDocument(document: any) {
    return {
      id: document.id,
      documentType: document.documentType,
      documentNumber: document.documentNumber ?? null,
      fileName: document.fileName ?? null,
      filePath: document.filePath ?? null,
      fileUrl: document.filePath ?? null,
      notes: document.notes ?? null,
      status: this.mapStatus(document.status),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }

  private async findAdminPersonOrThrow(userId: string) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: this.adminPeopleInclude()
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async ensureAdminActionAllowed(adminUserId: string, targetUserId: string, action: string) {
    if (adminUserId === targetUserId) {
      throw new ForbiddenException(`No puedes ${action} tu propia cuenta admin desde este panel`);
    }
    await this.findAdminPersonOrThrow(targetUserId);
  }

  private async updatePersonStatus(
    userId: string,
    options: {
      operationalStatus: 'active' | 'suspended';
      verificationStatus: 'approved' | 'suspended';
      profileStatus: 'approved' | 'suspended';
      notes?: string;
      actionLabel: string;
    }
  ) {
    const current = await this.findAdminPersonOrThrow(userId);
    const role = this.mapRole(current.role);
    const data: any = {
      operationalStatus: options.operationalStatus,
      verificationStatus: options.verificationStatus,
      adminNotes: this.appendAdminNote(current.adminNotes, options.notes, options.actionLabel)
    };

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).user.update({ where: { id: userId }, data });
      if (role === 'driver') {
        await (tx as any).driverProfile.updateMany({ where: { userId }, data: { status: options.profileStatus } });
      }
      if (role === 'passenger') {
        await (tx as any).passengerProfile.updateMany({ where: { userId }, data: { status: options.profileStatus } });
      }
    });

    return this.mapAdminPerson(await this.findAdminPersonOrThrow(userId));
  }

  private appendAdminNote(current: string | null, incoming: string | undefined, actionLabel: string) {
    const note = incoming?.trim();
    const line = `[${new Date().toISOString()}] ${actionLabel}${note ? ` - ${note}` : ''}`;
    return current ? `${current}\n${line}` : line;
  }

  private async getUserDeleteBlockers(userId: string) {
    const prismaAny = this.prisma as any;
    const checks: Array<[string, Promise<number>]> = [
      ['reservas', prismaAny.reservation.count({ where: { passengerUserId: userId } })],
      ['viajes', prismaAny.trip.count({ where: { driverUserId: userId } })],
      ['rutas', prismaAny.route.count({ where: { driverUserId: userId } })],
      ['ofertas de ruta', prismaAny.routeOffer.count({ where: { driverUserId: userId } })],
      ['liquidaciones', prismaAny.weeklyPayout.count({ where: { driverUserId: userId } })],
      ['pagos revisados', prismaAny.payment.count({ where: { reviewedByAdminUserId: userId } })],
      ['pagos archivados', prismaAny.payment.count({ where: { archivedByAdminUserId: userId } })],
      ['reembolsos gestionados', prismaAny.refund.count({ where: { adminUserId: userId } })],
      ['reportes/incidencias', prismaAny.incidentReport.count({ where: { OR: [{ reporterUserId: userId }, { reviewedById: userId }] } })]
    ];

    const counts = await Promise.all(checks.map(async ([label, promise]) => ({ label, count: await promise })));
    return counts.filter((item) => item.count > 0).map((item) => item.label);
  }
}

