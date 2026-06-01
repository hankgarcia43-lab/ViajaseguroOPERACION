import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { AvailableTripsQueryDto } from './dto/available-trips-query.dto';
import { CreateTripDto } from './dto/create-trip.dto';

type RouteRecord = {
  id: string;
  driverUserId: string;
  title: string | null;
  origin: string;
  destination: string;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  originPlaceId?: string | null;
  destinationPlaceId?: string | null;
  departureTime: string;
  estimatedArrivalTime: string;
  weekdaysText?: string | null;
  availableSeats: number;
  pricePerSeat: number;
  status: string;
};

type TripRecord = {
  id: string;
  publicId: number | null;
  routeId: string;
  routeOfferId: string | null;
  driverUserId: string;
  tripDate: Date;
  departureTimeSnapshot: string;
  estimatedArrivalTimeSnapshot: string;
  availableSeatsSnapshot: number;
  pricePerSeatSnapshot: number;
  boardingReference: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  route?: RouteRecord;
  driver?: {
    id: string;
    fullName: string;
    email: string;
  };
};

type TripReservationSummary = {
  reservationsCount: number;
  reservedSeats: number;
  remainingSeats: number;
};

type TripEarningsSummary = {
  grossCollected: number;
  appCommissionAmount: number;
  driverNetAmount: number;
  refundedAmount: number;
  driverNetAfterRefunds: number;
};

const TRIP_STATUS = {
  SCHEDULED: 'scheduled',
  STARTED: 'started',
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
} as const;

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService
  ) {}

  async create(driverUserId: string, dto: CreateTripDto) {
    await this.ensureVerifiedDriver(driverUserId);

    const route = (await this.routeDelegate().findUnique({
      where: { id: dto.routeId }
    })) as RouteRecord | null;

    if (!route) {
      throw new NotFoundException('Ruta no encontrada');
    }


    if (route.status !== 'active') {
      throw new ForbiddenException('La ruta debe estar activa para crear un viaje');
    }

    const tripDate = this.normalizeTripDate(dto.tripDate);
    const duplicateTrip = (await this.tripDelegate().findFirst({
      where: {
        routeId: route.id,
        tripDate,
        status: {
          in: [TRIP_STATUS.SCHEDULED, TRIP_STATUS.STARTED, TRIP_STATUS.FINISHED]
        }
      },
      select: { id: true }
    })) as { id: string } | null;

    if (duplicateTrip) {
      throw new ForbiddenException('Ya existe un viaje para esa ruta en la fecha seleccionada');
    }

    const tripPublicId = await this.nextPublicId("trip");
    const trip = (await this.tripDelegate().create({
      data: {
        publicId: tripPublicId,
        routeId: route.id,
        driverUserId,
        tripDate,
        departureTimeSnapshot: route.departureTime,
        estimatedArrivalTimeSnapshot: route.estimatedArrivalTime,
        availableSeatsSnapshot: route.availableSeats,
        pricePerSeatSnapshot: route.pricePerSeat,
        boardingReference: dto.boardingReference.trim(),
        status: TRIP_STATUS.SCHEDULED
      },
      include: {
        route: true
      }
    })) as TripRecord;

    return this.withReservationSummary(trip);
  }

  async findMyTrips(driverUserId: string) {
    await this.ensureDriver(driverUserId);

    const trips = (await this.tripDelegate().findMany({
      where: { driverUserId },
      include: {
        route: true
      },
      orderBy: [{ tripDate: 'desc' }, { createdAt: 'desc' }]
    })) as TripRecord[];

    return this.withReservationSummaryList(trips);
  }

  async findAllForAdmin() {
    const trips = (await this.tripDelegate().findMany({
      include: {
        route: true,
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: [{ tripDate: 'desc' }, { createdAt: 'desc' }]
    })) as TripRecord[];

    return this.withReservationSummaryList(trips);
  }

  async findByIdForAdmin(tripId: string) {
    const trip = (await this.tripDelegate().findUnique({
      where: { id: tripId },
      include: {
        route: true,
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })) as TripRecord | null;

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    return this.withReservationSummary(trip);
  }

  async findAvailableForPassenger(passengerUserId: string, query: AvailableTripsQueryDto) {
    await this.ensurePassenger(passengerUserId);

    const where: Record<string, unknown> = {
      status: {
        in: [TRIP_STATUS.SCHEDULED, TRIP_STATUS.STARTED]
      },
      route: {
        is: {
          status: 'active'
        }
      }
    };

    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      const end = new Date(`${query.date}T23:59:59.999Z`);
      where.tripDate = {
        gte: start,
        lte: end
      };
    }

    const hasReferencePoint = typeof query.lat === 'number' && typeof query.lng === 'number';
    if (hasReferencePoint) {
      this.assertWithinCoverage(query.lat as number, query.lng as number);
    }

    const trips = (await this.tripDelegate().findMany({
      where,
      include: {
        route: true
      },
      orderBy: [{ tripDate: 'asc' }, { createdAt: 'asc' }]
    })) as TripRecord[];

    const remainingSeatsMap = await this.getRemainingSeatsMapForTrips(trips);
    const enriched = trips.map((trip) => {
      const remainingSeats = remainingSeatsMap.get(trip.id) ?? trip.availableSeatsSnapshot;
      const nearDistanceKm =
        hasReferencePoint && this.hasValidCoordinates(trip.route?.originLat, trip.route?.originLng)
          ? Number(
              this.haversineDistanceKm(
                query.lat as number,
                query.lng as number,
                trip.route?.originLat as number,
                trip.route?.originLng as number
              ).toFixed(2)
            )
          : null;

      return {
        ...this.mapTrip(trip),
        remainingSeats,
        nearbyDistanceKm: nearDistanceKm,
        isNearUser: typeof nearDistanceKm === 'number' ? nearDistanceKm <= 15 : false,
        isReservable: remainingSeats > 0
      };
    });

    return enriched
      .filter((trip) => trip.remainingSeats > 0)
      .sort((a, b) => {
        const aDist = typeof a.nearbyDistanceKm === 'number' ? a.nearbyDistanceKm : Number.POSITIVE_INFINITY;
        const bDist = typeof b.nearbyDistanceKm === 'number' ? b.nearbyDistanceKm : Number.POSITIVE_INFINITY;

        if (aDist !== bDist) {
          return aDist - bDist;
        }

        return new Date(a.tripDate).getTime() - new Date(b.tripDate).getTime();
      });
  }

  async findAvailableByIdForPassenger(passengerUserId: string, tripId: string) {
    await this.ensurePassenger(passengerUserId);

    const trip = (await this.tripDelegate().findUnique({
      where: { id: tripId },
      include: {
        route: true
      }
    })) as TripRecord | null;

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (![TRIP_STATUS.SCHEDULED, TRIP_STATUS.STARTED].includes(trip.status as any) || trip.route?.status !== 'active') {
      throw new ForbiddenException('El viaje no esta disponible para reservacion');
    }

    const remainingSeats = await this.getRemainingSeats(trip.id, trip.availableSeatsSnapshot);

    return {
      ...this.mapTrip(trip),
      remainingSeats,
      isReservable: remainingSeats > 0
    };
  }

  async findById(driverUserId: string, tripId: string) {
    const trip = await this.findOwnedTripOrThrow(driverUserId, tripId);
    return this.withReservationSummary(trip);
  }

  async start(driverUserId: string, tripId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const trip = await this.findOwnedTripOrThrow(driverUserId, tripId);

    if (trip.status !== TRIP_STATUS.SCHEDULED) {
      throw new ForbiddenException('Solo viajes en estado programado pueden iniciarse');
    }

    const updated = (await this.tripDelegate().update({
      where: { id: tripId },
      data: { status: TRIP_STATUS.STARTED },
      include: { route: true }
    })) as TripRecord;

    return this.mapTrip(updated);
  }

  async finish(driverUserId: string, tripId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const trip = await this.findOwnedTripOrThrow(driverUserId, tripId);

    if (trip.status !== TRIP_STATUS.STARTED) {
      throw new ForbiddenException('Solo viajes en curso pueden finalizarse');
    }

    const updated = (await this.tripDelegate().update({
      where: { id: tripId },
      data: { status: TRIP_STATUS.FINISHED },
      include: { route: true }
    })) as TripRecord;

    return this.mapTrip(updated);
  }

  async cancel(driverUserId: string, tripId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const trip = await this.findOwnedTripOrThrow(driverUserId, tripId);

    if (trip.status !== TRIP_STATUS.SCHEDULED && trip.status !== TRIP_STATUS.STARTED) {
      throw new ForbiddenException('Solo viajes programados o en curso pueden cancelarse');
    }

    const updated = (await this.tripDelegate().update({
      where: { id: tripId },
      data: { status: TRIP_STATUS.CANCELLED },
      include: { route: true }
    })) as TripRecord;

    return this.mapTrip(updated);
  }

  private async findOwnedTripOrThrow(driverUserId: string, tripId: string) {
    await this.ensureDriver(driverUserId);

    const trip = (await this.tripDelegate().findUnique({
      where: { id: tripId },
      include: { route: true }
    })) as TripRecord | null;

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (trip.driverUserId !== driverUserId) {
      throw new ForbiddenException('No puedes operar viajes de otro conductor');
    }

    return trip;
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
      throw new ForbiddenException('Solo conductores pueden operar viajes');
    }

    if (!user.driverProfile) {
      throw new ForbiddenException('El usuario no tiene perfil de conductor');
    }
  }

  private async nextPublicId(entity: string) {
    const counter = await this.prisma.entityCounter.upsert({
      where: { entity },
      create: {
        entity,
        value: 1
      },
      update: {
        value: {
          increment: 1
        }
      }
    });

    return counter.value;
  }
  private async ensurePassenger(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passengerProfile: true }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role.toLowerCase() !== 'passenger') {
      throw new ForbiddenException('Solo pasajeros pueden buscar viajes');
    }

    if (!user.passengerProfile) {
      throw new ForbiddenException('El usuario no tiene perfil de pasajero');
    }
  }

  private async ensureVerifiedDriver(userId: string) {
    await this.vehiclesService.ensureDriverCanOperate(userId);
  }
  private async getRemainingSeatsMapForTrips(trips: TripRecord[]) {
    const map = new Map<string, number>();
    const uniqueTripIds = Array.from(new Set(trips.map((trip) => trip.id)));

    if (uniqueTripIds.length === 0) {
      return map;
    }

    const activeReservationStatuses = ['confirmed', 'paid', 'boarded', 'completed'];
    const grouped = (await this.reservationDelegate().groupBy({
      by: ['tripId'],
      where: {
        tripId: {
          in: uniqueTripIds
        },
        status: {
          in: activeReservationStatuses
        }
      },
      _sum: {
        totalSeats: true
      }
    })) as Array<{ tripId: string; _sum: { totalSeats: number | null } }>;

    const reservedMap = new Map<string, number>();
    for (const row of grouped) {
      reservedMap.set(row.tripId, row._sum.totalSeats ?? 0);
    }

    for (const trip of trips) {
      const reservedSeats = reservedMap.get(trip.id) ?? 0;
      map.set(trip.id, Math.max(0, trip.availableSeatsSnapshot - reservedSeats));
    }

    return map;
  }

  private async getRemainingSeats(tripId: string, availableSeatsSnapshot: number) {
    const summary = await this.getReservationSummary(tripId, availableSeatsSnapshot);
    return summary.remainingSeats;
  }

  private async getReservationSummary(tripId: string, availableSeatsSnapshot: number): Promise<TripReservationSummary> {
    const activeReservationStatuses = ['confirmed', 'paid', 'boarded', 'completed'];

    const reservations = (await this.reservationDelegate().findMany({
      where: {
        tripId,
        status: {
          in: activeReservationStatuses
        }
      },
      select: {
        totalSeats: true
      }
    })) as Array<{ totalSeats: number }>;

    const reservedSeats = reservations.reduce((sum, item) => sum + item.totalSeats, 0);
    return {
      reservationsCount: reservations.length,
      reservedSeats,
      remainingSeats: Math.max(0, availableSeatsSnapshot - reservedSeats)
    };
  }

  private async getEarningsSummary(tripId: string): Promise<TripEarningsSummary> {
    const payments = (await this.paymentDelegate().findMany({
      where: {
        reservation: {
          tripId
        }
      },
      select: {
        amount: true,
        status: true,
        appCommissionAmount: true,
        driverNetAmount: true
      }
    })) as Array<{
      amount: number;
      status: string;
      appCommissionAmount: number;
      driverNetAmount: number;
    }>;

    const approvedStatuses = new Set(['approved', 'paid']);
    const refundedStatuses = new Set(['refunded']);

    let grossCollected = 0;
    let appCommissionAmount = 0;
    let driverNetAmount = 0;
    let refundedAmount = 0;
    let refundedDriverNetAmount = 0;

    for (const payment of payments) {
      const status = this.normalizePaymentStatus(payment.status);

      if (approvedStatuses.has(status)) {
        grossCollected += payment.amount;
        appCommissionAmount += payment.appCommissionAmount;
        driverNetAmount += payment.driverNetAmount;
      }

      if (refundedStatuses.has(status)) {
        refundedAmount += payment.amount;
        refundedDriverNetAmount += payment.driverNetAmount;
      }
    }

    const driverNetAfterRefunds = Math.max(0, driverNetAmount - refundedDriverNetAmount);

    return {
      grossCollected: this.roundCurrency(grossCollected),
      appCommissionAmount: this.roundCurrency(appCommissionAmount),
      driverNetAmount: this.roundCurrency(driverNetAmount),
      refundedAmount: this.roundCurrency(refundedAmount),
      driverNetAfterRefunds: this.roundCurrency(driverNetAfterRefunds)
    };
  }

  private async withReservationSummary(trip: TripRecord) {
    const [reservationSummary, earningsSummary] = await Promise.all([
      this.getReservationSummary(trip.id, trip.availableSeatsSnapshot),
      this.getEarningsSummary(trip.id)
    ]);

    return {
      ...this.mapTrip(trip),
      reservationSummary,
      earningsSummary
    };
  }

  private async withReservationSummaryList(trips: TripRecord[]) {
    return Promise.all(trips.map((trip) => this.withReservationSummary(trip)));
  }

  private normalizeTripDate(rawTripDate: string) {
    const parsed = new Date(rawTripDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new ForbiddenException('La fecha del viaje no es valida');
    }

    const normalized = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0));
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));

    if (normalized < todayUtc) {
      throw new ForbiddenException('No puedes crear viajes en fechas pasadas');
    }

    return normalized;
  }

  private normalizePaymentStatus(status: string) {
    return String(status || '').toLowerCase();
  }

  private routeDelegate() {
    return (this.prisma as unknown as { route: any }).route;
  }

  private tripDelegate() {
    return (this.prisma as unknown as { trip: any }).trip;
  }

  private reservationDelegate() {
    return (this.prisma as unknown as { reservation: any }).reservation;
  }

  private paymentDelegate() {
    return (this.prisma as unknown as { payment: any }).payment;
  }

  private mapTrip(trip: TripRecord) {
    return {
      id: trip.id,
      publicId: trip.publicId,
      routeId: trip.routeId,
      routeOfferId: trip.routeOfferId ?? null,
      driverUserId: trip.driverUserId,
      tripDate: trip.tripDate,
      departureTimeSnapshot: trip.departureTimeSnapshot,
      estimatedArrivalTimeSnapshot: trip.estimatedArrivalTimeSnapshot,
      availableSeatsSnapshot: trip.availableSeatsSnapshot,
      pricePerSeatSnapshot: trip.pricePerSeatSnapshot,
      boardingReference: trip.boardingReference,
      status: trip.status,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      route: trip.route
        ? {
            id: trip.route.id,
            title: trip.route.title,
            origin: trip.route.origin,
            destination: trip.route.destination,
            weekdays: this.parseWeekdays(trip.route.weekdaysText),
            originLat: trip.route.originLat ?? null,
            originLng: trip.route.originLng ?? null,
            destinationLat: trip.route.destinationLat ?? null,
            destinationLng: trip.route.destinationLng ?? null,
            originPlaceId: trip.route.originPlaceId ?? null,
            destinationPlaceId: trip.route.destinationPlaceId ?? null,
            status: trip.route.status
          }
        : null,
      driver: trip.driver
        ? {
            id: trip.driver.id,
            fullName: trip.driver.fullName,
            email: trip.driver.email
          }
        : null
    };
  }


  private parseWeekdays(value?: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  private assertWithinCoverage(lat: number, lng: number) {
    const inCdmx = lat >= 19.048 && lat <= 19.592 && lng >= -99.365 && lng <= -98.94;
    const inEdomex = lat >= 18.3 && lat <= 20.35 && lng >= -100.9 && lng <= -98.35;

    if (!inCdmx && !inEdomex) {
      throw new ForbiddenException('La ubicacion de referencia esta fuera de cobertura (CDMX y Estado de Mexico).');
    }
  }

  private hasValidCoordinates(lat?: number | null, lng?: number | null) {
    return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
  }

  private haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLng = toRadians(lng2 - lng1);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }
  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }
}
