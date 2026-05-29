import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BASE_ROUTE_TEMPLATES, BaseRouteTemplate } from './base-routes.catalog';

const SYSTEM_ROUTE_ADMIN_EMAIL = 'sistema.rutas@viajaseguro.local';
const SYSTEM_ROUTE_ADMIN_NAME = 'Sistema Rutas Base';
const SYSTEM_ROUTE_ADMIN_PHONE = '5500000000';
const SYSTEM_ROUTE_ADMIN_PASSWORD_HASH = '$2b$10$tbW4xgoFuvuzcNXOG0I02Oo0endaADDPCWPdtonj8FkdItdG4gn.u';
const MAX_PRICE_PER_SEAT = 500;

@Injectable()
export class BaseRoutesSyncService implements OnModuleInit {
  private readonly logger = new Logger(BaseRoutesSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const rawSyncFlag = process.env.ROUTE_TEMPLATE_SYNC_ENABLED;
    const syncEnabled = rawSyncFlag ? rawSyncFlag.toLowerCase() === 'true' : process.env.NODE_ENV === 'production';
    if (!syncEnabled) {
      this.logger.log('Sincronizacion automatica de rutas base desactivada (ROUTE_TEMPLATE_SYNC_ENABLED=false).');
      return;
    }

    try {
      await this.syncBaseRoutes();
    } catch (error) {
      this.logger.warn(
        `No se pudo sincronizar rutas base: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async syncBaseRoutes() {
    const systemAdmin = await this.ensureSystemRouteAdmin();

    for (const template of BASE_ROUTE_TEMPLATES) {
      await this.upsertTemplateRoute(template, systemAdmin.id);
    }

    this.logger.log(`Rutas base sincronizadas: ${BASE_ROUTE_TEMPLATES.length}`);
  }

  private async ensureSystemRouteAdmin() {
    const existing = await this.prisma.user.findUnique({ where: { email: SYSTEM_ROUTE_ADMIN_EMAIL } });
    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        fullName: SYSTEM_ROUTE_ADMIN_NAME,
        phone: SYSTEM_ROUTE_ADMIN_PHONE,
        email: SYSTEM_ROUTE_ADMIN_EMAIL,
        passwordHash: SYSTEM_ROUTE_ADMIN_PASSWORD_HASH,
        role: 'admin',
        verificationStatus: 'approved'
      }
    });
  }

  private async upsertTemplateRoute(template: BaseRouteTemplate, systemAdminId: string) {
    const recommendedPrice = this.roundCurrency(template.recommendedPricePerSeat);
    const boundedPrice = Math.min(Math.max(recommendedPrice, 1), MAX_PRICE_PER_SEAT);

    const existing = await (this.prisma as any).route.findUnique({
      where: { templateKey: template.templateKey }
    });

    const baseData = {
      driverUserId: systemAdminId,
      farePolicyId: null,
      title: template.title,
      origin: template.origin,
      destination: template.destination,
      stopsText: template.stopsText,
      weekdaysText: JSON.stringify(template.weekdays),
      departureTime: template.departureTime,
      estimatedArrivalTime: template.estimatedArrivalTime,
      availableSeats: template.availableSeats,
      distanceKm: this.roundCurrency(template.distanceKm),
      pricePerSeat: boundedPrice,
      farePolicyMode: null,
      fareRatePerKmApplied: null,
      maxAllowedPrice: MAX_PRICE_PER_SEAT,
      status: 'active'
    };

    if (existing) {
      await (this.prisma as any).route.update({
        where: { id: existing.id },
        data: baseData
      });
      return;
    }

    await (this.prisma as any).route.create({
      data: {
        publicId: await this.nextPublicId('route'),
        templateKey: template.templateKey,
        ...baseData
      }
    });
  }

  private async nextPublicId(entity: string) {
    const counter = await this.prisma.entityCounter.upsert({
      where: { entity },
      create: { entity, value: 1 },
      update: { value: { increment: 1 } }
    });

    return counter.value;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }
}
