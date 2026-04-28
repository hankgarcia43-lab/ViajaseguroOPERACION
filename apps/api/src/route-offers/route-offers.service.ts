import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateRouteOfferDto } from './dto/create-route-offer.dto';
import { UpdateRouteOfferDto } from './dto/update-route-offer.dto';

const OFFER_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused'
} as const;

@Injectable()
export class RouteOffersService {
  constructor(private readonly prisma: PrismaService, private readonly vehiclesService: VehiclesService) {}

  async listBaseRoutes() {
    const routes = await this.routeDelegate().findMany({ where: { status: 'active' }, orderBy: [{ createdAt: 'desc' }] });
    const routeIds = routes.map((route: any) => route.id);

    const offers = routeIds.length
      ? await this.routeOfferDelegate().findMany({
          where: { routeId: { in: routeIds }, status: OFFER_STATUS.ACTIVE },
          select: { routeId: true }
        })
      : [];

    const activeDriversByRoute = new Map<string, number>();
    for (const offer of offers) {
      activeDriversByRoute.set(offer.routeId, (activeDriversByRoute.get(offer.routeId) ?? 0) + 1);
    }

    return routes.map((route: any) => ({
      id: route.id,
      publicId: route.publicId ?? null,
      templateKey: route.templateKey ?? null,
      title: route.title,
      origin: route.origin,
      destination: route.destination,
      weekdays: this.parseWeekdays(route.weekdaysText),
      departureTime: route.departureTime,
      estimatedArrivalTime: route.estimatedArrivalTime,
      distanceKm: route.distanceKm,
      pricePerSeat: route.pricePerSeat,
      status: route.status,
      stopsText: route.stopsText ?? null,
      activeDriversCount: activeDriversByRoute.get(route.id) ?? 0
    }));
  }

  async create(driverUserId: string, dto: CreateRouteOfferDto) {
    await this.vehiclesService.ensureDriverCanOperate(driverUserId);

    const route = await this.routeDelegate().findUnique({ where: { id: dto.routeId } });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    if (route.status !== 'active') throw new ForbiddenException('Solo puedes adherirte a rutas activas');

    if (dto.serviceType === 'one_time' && dto.weekdays.length !== 1) {
      throw new BadRequestException('Para servicio unico debes elegir exactamente un dia de operacion.');
    }

    const existing = await this.routeOfferDelegate().findFirst({
      where: { routeId: dto.routeId, driverUserId, status: OFFER_STATUS.ACTIVE }
    });

    if (existing) {
      throw new BadRequestException('Ya tienes una oferta activa para esta ruta. Actualizala en lugar de crear otra.');
    }

    const offer = await this.routeOfferDelegate().create({
      data: {
        publicId: await this.nextPublicId('route_offer'),
        routeId: dto.routeId,
        driverUserId,
        boardingReference: dto.boardingReference,
        weekdaysText: JSON.stringify([...new Set(dto.weekdays)]),
        serviceType: dto.serviceType,
        pricePerSeat: route.pricePerSeat,
        availableSeats: dto.availableSeats,
        status: OFFER_STATUS.ACTIVE
      },
      include: this.offerInclude()
    });

    return this.mapOffer(offer);
  }

  async myOffers(driverUserId: string) {
    await this.vehiclesService.ensureDriverCanOperate(driverUserId);

    const offers = await this.routeOfferDelegate().findMany({
      where: { driverUserId },
      include: this.offerInclude(),
      orderBy: [{ createdAt: 'desc' }]
    });

    return offers.map((offer: any) => this.mapOffer(offer));
  }

  async update(driverUserId: string, offerId: string, dto: UpdateRouteOfferDto) {
    await this.vehiclesService.ensureDriverCanOperate(driverUserId);

    const existing = await this.routeOfferDelegate().findUnique({ where: { id: offerId } });
    if (!existing) throw new NotFoundException('Oferta no encontrada');
    if (existing.driverUserId !== driverUserId) throw new ForbiddenException('No puedes modificar ofertas de otro conductor');

    if (dto.serviceType === 'one_time' && dto.weekdays && dto.weekdays.length !== 1) {
      throw new BadRequestException('Para servicio unico debes elegir exactamente un dia de operacion.');
    }

    const nextWeekdays = dto.weekdays ? [...new Set(dto.weekdays)] : undefined;
    const serviceType = dto.serviceType ?? existing.serviceType;
    const route = await this.routeDelegate().findUnique({ where: { id: existing.routeId } });
    if (!route) throw new NotFoundException('Ruta no encontrada');

    if (serviceType === 'one_time') {
      const effectiveWeekdays = nextWeekdays ?? this.parseWeekdays(existing.weekdaysText);
      if (effectiveWeekdays.length !== 1) {
        throw new BadRequestException('Servicio unico requiere un solo dia operativo.');
      }
    }

    const updated = await this.routeOfferDelegate().update({
      where: { id: offerId },
      data: {
        boardingReference: dto.boardingReference,
        weekdaysText: nextWeekdays ? JSON.stringify(nextWeekdays) : undefined,
        serviceType: dto.serviceType,
        availableSeats: dto.availableSeats,
        pricePerSeat: route.pricePerSeat,
        status: dto.status
      },
      include: this.offerInclude()
    });

    return this.mapOffer(updated);
  }

  async listByRoute(routeId: string) {
    const route = await this.routeDelegate().findUnique({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Ruta no encontrada');

    const offers = await this.routeOfferDelegate().findMany({
      where: { routeId, status: OFFER_STATUS.ACTIVE },
      include: this.offerInclude(),
      orderBy: [{ createdAt: 'desc' }]
    });

    return {
      route: {
        id: route.id,
        publicId: route.publicId ?? null,
        templateKey: route.templateKey ?? null,
        title: route.title,
        origin: route.origin,
        destination: route.destination,
        weekdays: this.parseWeekdays(route.weekdaysText),
        departureTime: route.departureTime,
        estimatedArrivalTime: route.estimatedArrivalTime,
        distanceKm: route.distanceKm,
        pricePerSeat: route.pricePerSeat,
        status: route.status,
        stopsText: route.stopsText ?? null
      },
      offers: offers.map((offer: any) => this.mapOffer(offer))
    };
  }

  async findOfferOrThrow(offerId: string) {
    const offer = await this.routeOfferDelegate().findUnique({ where: { id: offerId }, include: this.offerInclude() });
    if (!offer) throw new NotFoundException('Oferta no encontrada');
    return offer;
  }

  private offerInclude() {
    return {
      route: true,
      driver: {
        select: {
          id: true,
          fullName: true,
          email: true,
          vehicle: {
            include: {
              documents: {
                where: { documentType: 'vehicle_photo', status: 'approved' },
                orderBy: [{ createdAt: 'desc' }]
              }
            }
          }
        }
      }
    };
  }

  private mapOffer(offer: any) {
    return {
      id: offer.id,
      publicId: offer.publicId,
      routeId: offer.routeId,
      driverUserId: offer.driverUserId,
      boardingReference: offer.boardingReference,
      weekdays: this.parseWeekdays(offer.weekdaysText),
      serviceType: offer.serviceType,
      pricePerSeat: offer.pricePerSeat,
      availableSeats: offer.availableSeats,
      status: offer.status,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      route: offer.route
        ? {
            id: offer.route.id,
            publicId: offer.route.publicId ?? null,
            title: offer.route.title,
            origin: offer.route.origin,
            destination: offer.route.destination,
            departureTime: offer.route.departureTime,
            estimatedArrivalTime: offer.route.estimatedArrivalTime,
            distanceKm: offer.route.distanceKm,
            stopsText: offer.route.stopsText ?? null
          }
        : null,
      driver: offer.driver
        ? {
            id: offer.driver.id,
            fullName: offer.driver.fullName,
            email: offer.driver.email
          }
        : null,
      vehiclePhotoUrl: offer.driver?.vehicle?.documents?.[0]?.filePath ?? null
    };
  }

  private parseWeekdays(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async nextPublicId(entity: string) {
    const counter = await this.prisma.entityCounter.upsert({
      where: { entity },
      create: { entity, value: 1 },
      update: { value: { increment: 1 } }
    });
    return counter.value;
  }

  private routeOfferDelegate() {
    return (this.prisma as any).routeOffer;
  }

  private routeDelegate() {
    return (this.prisma as any).route;
  }
}





