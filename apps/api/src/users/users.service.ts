import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: this.coreUserSelect()
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.coreUserSelect()
    });
  }

  async createUser(data: Prisma.UserCreateInput) {
    const now = new Date();
    const trialEndsAt = this.addDays(now, this.getTrialDays());

    try {
      return await this.prisma.user.create({
        data: {
          trialStartedAt: now,
          trialEndsAt,
          subscriptionStatus: 'trial',
          ...data
        } as Prisma.UserCreateInput,
        select: this.coreUserSelect()
      });
    } catch (error) {
      if (!this.isMissingSubscriptionColumnError(error)) {
        throw error;
      }

      return this.prisma.user.create({
        data,
        select: this.coreUserSelect()
      });
    }
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
      select: {
        ...this.coreUserSelect(),
        driverProfile: true,
        passengerProfile: true
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const subscriptionFields = await this.loadSubscriptionFieldsForUser(user.id, user.createdAt);
    const profileUser = { ...user, ...subscriptionFields };

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: this.mapRole(user.role),
      verificationStatus: this.mapStatus(user.verificationStatus),
      operationalStatus: this.mapOperationalStatus((user as any).operationalStatus),
      recognitionLevel: this.mapRecognitionLevel((user as any).recognitionLevel),
      subscription: this.mapSubscriptionSnapshot(profileUser),
      access: this.mapAccessSnapshot(profileUser),
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

    const subscriptionCounts = await this.getSafeSubscriptionCounts();

    return {
      total,
      passengers,
      drivers,
      admins,
      active,
      suspended,
      excellent,
      pendingVerifications,
      ...subscriptionCounts
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

  async activateSubscriptionForAdmin(adminUserId: string, userId: string, notes?: string) {
    await this.ensureAdminActionAllowed(adminUserId, userId, 'activar plan pagado');
    const current = await this.findAdminPersonOrThrow(userId);
    const now = new Date();
    const accessDays = this.getAccessDays();
    const updated = await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'active',
        planType: 'pilot_weekly',
        subscriptionExpiresAt: this.addDays(now, accessDays),
        adminNotes: this.appendAdminNote(current.adminNotes, notes, `Plan semanal activado por admin por ${accessDays} dias`)
      },
      include: this.adminPeopleInclude()
    });

    return this.mapAdminPerson(updated);
  }

  async expireSubscriptionForAdmin(adminUserId: string, userId: string, notes?: string) {
    await this.ensureAdminActionAllowed(adminUserId, userId, 'vencer plan');
    const current = await this.findAdminPersonOrThrow(userId);
    const updated = await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'expired',
        subscriptionExpiresAt: new Date(),
        adminNotes: this.appendAdminNote(current.adminNotes, notes, 'Plan marcado como vencido por admin')
      },
      include: this.adminPeopleInclude()
    });

    return this.mapAdminPerson(updated);
  }
  async activateSubscriptionFromProvider(
    userId: string,
    options: { planType: string; days: number; provider: string; providerReference: string; rawStatus?: string | null }
  ) {
    const current = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const providerReference = String(options.providerReference || '').trim();
    const existingNotes = String(current.adminNotes ?? '');
    if (providerReference && existingNotes.includes(`providerReference=${providerReference}`)) {
      return this.getCurrentUserProfile(userId);
    }

    const days = Number.isFinite(options.days) && options.days > 0 ? Math.floor(options.days) : 30;
    const now = new Date();
    const currentExpiresAt = current.subscriptionExpiresAt ? new Date(current.subscriptionExpiresAt) : null;
    const periodStart = current.subscriptionStatus === 'active' && currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;
    const subscriptionExpiresAt = this.addDays(periodStart, days);
    const note = [
      `plan=${options.planType}`,
      `provider=${options.provider}`,
      `providerReference=${providerReference || 'sin-referencia'}`,
      options.rawStatus ? `status=${options.rawStatus}` : null,
      `dias=${days}`
    ].filter(Boolean).join('; ');

    await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'active',
        planType: options.planType,
        subscriptionExpiresAt,
        adminNotes: this.appendAdminNote(current.adminNotes, note, 'Plan activado automaticamente')
      }
    });

    return this.getCurrentUserProfile(userId);
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
  async ensurePremiumAccess(userId: string, actionLabel = 'usar funciones premium') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.coreUserSelect()
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const userWithSubscription = {
      ...user,
      ...(await this.loadSubscriptionFieldsForUser(user.id, user.createdAt))
    };

    if (this.mapRole(user.role) === 'admin') {
      return userWithSubscription;
    }

    const access = this.mapAccessSnapshot(userWithSubscription);
    if (access.canUsePremiumFeatures) {
      return userWithSubscription;
    }

    throw new ForbiddenException(
      `Tu prueba gratis termino. Activa tu acceso para ${actionLabel}. El acceso habilita funciones digitales de la comunidad; no paga traslados.`
    );
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

  private coreUserSelect(): Prisma.UserSelect {
    return {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      passwordHash: true,
      role: true,
      verificationStatus: true,
      operationalStatus: true,
      recognitionLevel: true,
      adminNotes: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      createdAt: true,
      updatedAt: true
    };
  }

  private async loadSubscriptionFieldsForUser(userId: string, createdAt: Date) {
    try {
      const rows = await this.prisma.$queryRaw<Array<{
        trialStartedAt: Date | null;
        trialEndsAt: Date | null;
        subscriptionStatus: string | null;
        planType: string | null;
        subscriptionExpiresAt: Date | null;
      }>>`
        SELECT
          "trial_started_at" AS "trialStartedAt",
          "trial_ends_at" AS "trialEndsAt",
          "subscription_status" AS "subscriptionStatus",
          "plan_type" AS "planType",
          "subscription_expires_at" AS "subscriptionExpiresAt"
        FROM "users"
        WHERE "id" = ${userId}
        LIMIT 1
      `;

      if (rows[0]) {
        return rows[0];
      }
    } catch {
      // Mantiene login y /auth/me disponibles si produccion aun no termina migraciones de acceso.
    }

    const trialStartedAt = createdAt;
    return {
      trialStartedAt,
      trialEndsAt: this.addDays(new Date(createdAt), this.getTrialDays()),
      subscriptionStatus: 'trial',
      planType: null,
      subscriptionExpiresAt: null
    };
  }

  private async getSafeSubscriptionCounts() {
    const user = (this.prisma as any).user;
    try {
      const [trialUsers, activeSubscriptions, expiredSubscriptions] = await Promise.all([
        user.count({ where: { subscriptionStatus: 'trial' } }),
        user.count({ where: { subscriptionStatus: 'active' } }),
        user.count({ where: { subscriptionStatus: 'expired' } })
      ]);

      return { trialUsers, activeSubscriptions, expiredSubscriptions };
    } catch {
      return { trialUsers: 0, activeSubscriptions: 0, expiredSubscriptions: 0 };
    }
  }

  private isMissingSubscriptionColumnError(error: unknown) {
    const code = String((error as any)?.code ?? '');
    const message = String((error as any)?.message ?? '').toLowerCase();
    const subscriptionColumns = ['trial_started_at', 'trial_ends_at', 'subscription_status', 'plan_type', 'subscription_expires_at'];
    return code === 'P2022' || subscriptionColumns.some((column) => message.includes(column));
  }
  private mapSubscriptionSnapshot(user: any) {
    const now = new Date();
    const trialStartedAt = user.trialStartedAt ?? user.createdAt ?? null;
    const trialEndsAt = user.trialEndsAt ?? (user.createdAt ? this.addDays(new Date(user.createdAt), this.getTrialDays()) : null);
    const subscriptionExpiresAt = user.subscriptionExpiresAt ?? null;
    const rawStatus = String(user.subscriptionStatus || 'trial').toLowerCase();
    const isActivePaid = rawStatus === 'active' && (!subscriptionExpiresAt || new Date(subscriptionExpiresAt).getTime() >= now.getTime());
    const isTrialActive = rawStatus === 'trial' && trialEndsAt && new Date(trialEndsAt).getTime() >= now.getTime();
    const effectiveStatus = isActivePaid ? 'active' : isTrialActive ? 'trial' : rawStatus === 'cancelled' || rawStatus === 'past_due' ? rawStatus : 'expired';
    const trialDaysRemaining = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86400000)) : 0;

    return {
      status: effectiveStatus,
      storedStatus: rawStatus,
      planType: user.planType ?? null,
      trialStartedAt,
      trialEndsAt,
      trialDaysRemaining,
      subscriptionExpiresAt,
      isTrialActive: Boolean(isTrialActive),
      isActivePaid: Boolean(isActivePaid)
    };
  }

  private mapAccessSnapshot(user: any) {
    const subscription = this.mapSubscriptionSnapshot(user);
    const role = this.mapRole(user.role || 'passenger');
    const canUsePremiumFeatures = role === 'admin' || subscription.isTrialActive || subscription.isActivePaid;

    return {
      canUsePremiumFeatures,
      canPublishRouteNeed: role === 'passenger' && canUsePremiumFeatures,
      canRequestJoinRoute: role === 'passenger' && canUsePremiumFeatures,
      canPublishDriverRoute: role === 'driver' && canUsePremiumFeatures,
      canTakeRequestedRoute: role === 'driver' && canUsePremiumFeatures,
      reason: canUsePremiumFeatures ? null : 'trial_or_subscription_required'
    };
  }

  private getTrialDays() {
    const value = Number.parseInt(process.env.TRIAL_DAYS || '7', 10);
    return Number.isFinite(value) && value > 0 ? value : 7;
  }

  private getAccessDays() {
    const value = Number.parseInt(process.env.MERCADOPAGO_SUBSCRIPTION_DAYS || '7', 10);
    return Number.isFinite(value) && value > 0 ? value : 7;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
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
      subscription: this.mapSubscriptionSnapshot(user),
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
