import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { FarePolicyService } from '../fare-policy/fare-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { RouteOffersService } from '../route-offers/route-offers.service';
import { UserDocumentsService } from '../user-documents/user-documents.service';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateReservationByOfferDto } from './dto/create-reservation-by-offer.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ValidateBoardingDto } from './dto/validate-boarding.dto';

type ReservationRecord = {
  id: string;
  publicId: number | null;
  tripId: string;
  weeklyReservationGroupId?: string | null;
  isWeeklyPaymentPrimary?: boolean;
  passengerUserId: string;
  totalSeats: number;
  companionCount: number;
  totalAmount: number;
  numericCode: string;
  qrToken: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  trip?: any;
  passenger?: any;
  payment?: any;
};

type TripRecord = {
  id: string;
  routeId: string;
  routeOfferId?: string | null;
  driverUserId: string;
  tripDate: Date;
  departureTimeSnapshot: string;
  estimatedArrivalTimeSnapshot: string;
  availableSeatsSnapshot: number;
  pricePerSeatSnapshot: number;
  boardingReference: string | null;
  status: string;
  route?: any;
};

const RESERVATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED_BY_USER: 'cancelled_by_user',
  CANCELLED_BY_DRIVER: 'cancelled_by_driver',
  REPORTED: 'reported',
  PAID: 'paid',
  CONFIRMED: 'confirmed',
  BOARDED: 'boarded',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  REFUNDED: 'refunded',
  COMPLETED: 'completed'
} as const;

const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUNDED: 'refunded'
} as const;

const TRIP_STATUS = {
  SCHEDULED: 'scheduled',
  STARTED: 'started',
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
} as const;

const WEEKLY_RESERVATION_DISCOUNT_RATE = 0.1;
const WEEKLY_RESERVATION_MIN_DAYS = 5;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userDocumentsService: UserDocumentsService,
    private readonly vehiclesService: VehiclesService,
    private readonly routeOffersService: RouteOffersService,
    private readonly farePolicyService: FarePolicyService,
    private readonly usersService: UsersService
  ) {}

  async create(passengerUserId: string, dto: CreateReservationDto) {
    await this.usersService.ensurePremiumAccess(passengerUserId, 'enviar solicitudes de ruta');
    const passenger = await this.ensureVerifiedPassenger(passengerUserId);

    const companionCount = dto.companionCount ?? dto.totalSeats - 1;
    if (companionCount !== dto.totalSeats - 1) {
      throw new ForbiddenException('companionCount debe ser igual a totalSeats - 1');
    }

    const trip = (await this.tripDelegate().findUnique({
      where: { id: dto.tripId },
      include: {
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
          }
    })) as TripRecord | null;

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (trip.status === TRIP_STATUS.CANCELLED || trip.status === TRIP_STATUS.FINISHED) {
      throw new ForbiddenException('No se puede solicitar sobre rutas canceladas o finalizadas');
    }

    const reservedSeats = await this.getReservedSeats(trip.id);
    const remainingSeats = trip.availableSeatsSnapshot - reservedSeats;

    if (dto.totalSeats > remainingSeats) {
      throw new ForbiddenException('No hay lugares suficientes para esta solicitud');
    }

    const selectedWeekdays = this.normalizeSelectedWeekdays(dto.selectedWeekdays);
    if (selectedWeekdays.length > 0) {
      return this.createReservationsFromTripWeekdays(passenger.id, trip, selectedWeekdays, dto.totalSeats, companionCount, Boolean(dto.referralDiscountRequested));
    }

    const totalAmount = this.roundCurrency(dto.totalSeats * trip.pricePerSeatSnapshot);

    const reservation = await this.createReservationWithTicketAndPayment({
      tripId: trip.id,
      passengerUserId: passenger.id,
      totalSeats: dto.totalSeats,
      companionCount,
      totalAmount,
      status: RESERVATION_STATUS.PENDING,
      routeOfferId: trip.routeOfferId ?? undefined,
      createPayment: false
    });

    return this.mapReservation(reservation, remainingSeats - dto.totalSeats);
  }



  private async createReservationsFromTripWeekdays(
    passengerUserId: string,
    seedTrip: TripRecord,
    selectedWeekdays: string[],
    totalSeats: number,
    companionCount: number,
    referralDiscountRequested = false
  ) {
    if (selectedWeekdays.length === 0) {
      throw new BadRequestException('Selecciona al menos un dia para solicitar unirte.');
    }

    if (selectedWeekdays.length > 7) {
      throw new BadRequestException('Puedes seleccionar maximo 7 dias por semana en una sola solicitud.');
    }

    const weeklyReservationGroupId = randomUUID();
    const weeklyGrossAmount = this.roundCurrency(selectedWeekdays.length * totalSeats * seedTrip.pricePerSeatSnapshot);
    const weeklyDiscountApplied = referralDiscountRequested && selectedWeekdays.length >= WEEKLY_RESERVATION_MIN_DAYS;
    const weeklyDiscountAmount = weeklyDiscountApplied ? this.roundCurrency(weeklyGrossAmount * WEEKLY_RESERVATION_DISCOUNT_RATE) : 0;
    const weeklyTotalAmount = this.roundCurrency(weeklyGrossAmount - weeklyDiscountAmount);
    const items: ReservationRecord[] = [];

    for (const weekday of selectedWeekdays) {
      const tripDate = this.nextDateForWeekday(weekday);
      const where: Record<string, unknown> = {
        routeId: seedTrip.routeId,
        driverUserId: seedTrip.driverUserId,
        tripDate,
        status: {
          in: [TRIP_STATUS.SCHEDULED, TRIP_STATUS.STARTED]
        }
      };

      if (seedTrip.routeOfferId) {
        where.routeOfferId = seedTrip.routeOfferId;
      }

      let trip = (await this.tripDelegate().findFirst({ where })) as TripRecord | null;

      if (!trip) {
        trip = (await this.tripDelegate().create({
          data: {
            publicId: await this.nextPublicId('trip'),
            routeId: seedTrip.routeId,
            routeOfferId: seedTrip.routeOfferId ?? null,
            driverUserId: seedTrip.driverUserId,
            tripDate,
            departureTimeSnapshot: seedTrip.departureTimeSnapshot,
            estimatedArrivalTimeSnapshot: seedTrip.estimatedArrivalTimeSnapshot,
            availableSeatsSnapshot: seedTrip.availableSeatsSnapshot,
            pricePerSeatSnapshot: seedTrip.pricePerSeatSnapshot,
            boardingReference: seedTrip.boardingReference,
            status: TRIP_STATUS.SCHEDULED
          }
        })) as TripRecord;
      }

      const reservedSeats = await this.getReservedSeats(trip.id);
      const remainingSeats = trip.availableSeatsSnapshot - reservedSeats;

      if (totalSeats > remainingSeats) {
        throw new ForbiddenException(
          `No hay lugares suficientes para ${this.formatWeekdayLabel(weekday)}. Disponibles: ${Math.max(remainingSeats, 0)}.`
        );
      }

      const isPrimaryReservation = items.length === 0;
      const reservation = await this.createReservationWithTicketAndPayment({
        tripId: trip.id,
        passengerUserId,
        totalSeats,
        companionCount,
        totalAmount: weeklyDiscountApplied ? this.roundCurrency(totalSeats * trip.pricePerSeatSnapshot * (1 - WEEKLY_RESERVATION_DISCOUNT_RATE)) : this.roundCurrency(totalSeats * trip.pricePerSeatSnapshot),
        status: RESERVATION_STATUS.PENDING,
        routeOfferId: seedTrip.routeOfferId ?? undefined,
        weeklyReservationGroupId,
        isWeeklyPaymentPrimary: isPrimaryReservation,
        createPayment: false,
        paymentAmountOverride: isPrimaryReservation ? weeklyTotalAmount : undefined
      });

      items.push(reservation);
    }

    const mapped = await Promise.all(
      items.map(async (reservation) => {
        const remaining = await this.getRemainingSeats(reservation.tripId);
        return this.mapReservation(reservation, remaining);
      })
    );

    return {
      totalDays: mapped.length,
      totalSeats,
      selectedWeekdays,
      grossAmount: weeklyGrossAmount,
      discountAmount: weeklyDiscountAmount,
      discountRate: weeklyDiscountApplied ? WEEKLY_RESERVATION_DISCOUNT_RATE : 0,
      totalAmount: weeklyTotalAmount,
      finalAmount: weeklyTotalAmount,
      reservations: mapped,
      primaryReservationId: mapped[0]?.id ?? null,
      message: mapped.length === 1
        ? 'Solicitud enviada para 1 dia. El conductor debe aceptarla para habilitar el pase de ruta.'
        : 'Solicitud enviada para ' + mapped.length + ' dias. Con 5 dias o mas cuenta como viaje semanal; el conductor debe aceptar cada dia para habilitar los pases.'
    };
  }

  async createByOffer(passengerUserId: string, dto: CreateReservationByOfferDto) {
    await this.usersService.ensurePremiumAccess(passengerUserId, 'solicitar unirte a rutas');
    const passenger = await this.ensureVerifiedPassenger(passengerUserId);
    const offer = await this.routeOffersService.findOfferOrThrow(dto.offerId);

    if (String(offer.status || '').toLowerCase() !== 'active') {
      throw new ForbiddenException('La disponibilidad del conductor no esta activa.');
    }

    if (!offer.route || String(offer.route.status || '').toLowerCase() !== 'active') {
      throw new ForbiddenException('La ruta base no esta disponible.');
    }

    const selectedWeekdays = this.normalizeSelectedWeekdays(dto.selectedWeekdays);

    if (selectedWeekdays.length === 0) {
      throw new BadRequestException('Selecciona al menos un dia del viaje.');
    }

    if (selectedWeekdays.length > 7) {
      throw new BadRequestException('Puedes seleccionar maximo 7 dias por semana en una sola solicitud.');
    }

    const normalizedTotalSeats = dto.totalSeats;
    const companionCount = normalizedTotalSeats - 1;
    const weeklyReservationGroupId = randomUUID();
    const weeklyGrossAmount = this.roundCurrency(selectedWeekdays.length * normalizedTotalSeats * offer.pricePerSeat);
    const weeklyDiscountApplied = Boolean(dto.referralDiscountRequested) && selectedWeekdays.length >= WEEKLY_RESERVATION_MIN_DAYS;
    const weeklyDiscountAmount = weeklyDiscountApplied ? this.roundCurrency(weeklyGrossAmount * WEEKLY_RESERVATION_DISCOUNT_RATE) : 0;
    const weeklyTotalAmount = this.roundCurrency(weeklyGrossAmount - weeklyDiscountAmount);
    const items: ReservationRecord[] = [];

    for (const weekday of selectedWeekdays) {
      const tripDate = this.nextDateForWeekday(weekday);

      let trip = (await this.tripDelegate().findFirst({
        where: {
          routeOfferId: offer.id,
          tripDate,
          status: {
            in: [TRIP_STATUS.SCHEDULED, TRIP_STATUS.STARTED]
          }
        }
      })) as TripRecord | null;

      if (!trip) {
        trip = (await this.tripDelegate().create({
          data: {
            publicId: await this.nextPublicId('trip'),
            routeId: offer.routeId,
            routeOfferId: offer.id,
            driverUserId: offer.driverUserId,
            tripDate,
            departureTimeSnapshot: offer.route.departureTime,
            estimatedArrivalTimeSnapshot: offer.route.estimatedArrivalTime,
            availableSeatsSnapshot: offer.availableSeats,
            pricePerSeatSnapshot: offer.pricePerSeat,
            boardingReference: offer.boardingReference,
            status: TRIP_STATUS.SCHEDULED
          }
        })) as TripRecord;
      }

      const reservedSeats = await this.getReservedSeats(trip.id);
      const remainingSeats = trip.availableSeatsSnapshot - reservedSeats;

      if (normalizedTotalSeats > remainingSeats) {
        throw new ForbiddenException(
          `No hay lugares suficientes para ${this.formatWeekdayLabel(weekday)}. Disponibles: ${Math.max(remainingSeats, 0)}.`
        );
      }

      const totalAmount = normalizedTotalSeats * trip.pricePerSeatSnapshot;
      const isPrimaryReservation = items.length === 0;
      const reservation = await this.createReservationWithTicketAndPayment({
        tripId: trip.id,
        passengerUserId: passenger.id,
        totalSeats: normalizedTotalSeats,
        companionCount,
        totalAmount,
        status: RESERVATION_STATUS.PENDING,
        routeOfferId: offer.id,
        weeklyReservationGroupId,
        isWeeklyPaymentPrimary: isPrimaryReservation,
        createPayment: false,
        paymentAmountOverride: isPrimaryReservation ? weeklyTotalAmount : undefined
      });

      items.push(reservation);
    }

    const mapped = await Promise.all(
      items.map(async (reservation) => {
        const remainingSeats = await this.getRemainingSeats(reservation.tripId);
        return this.mapReservation(reservation, remainingSeats);
      })
    );

    return {
      routeId: offer.routeId,
      routeOfferId: offer.id,
      totalDays: mapped.length,
      totalSeats: normalizedTotalSeats,
      selectedWeekdays,
      grossAmount: weeklyGrossAmount,
      discountAmount: weeklyDiscountAmount,
      discountRate: weeklyDiscountApplied ? WEEKLY_RESERVATION_DISCOUNT_RATE : 0,
      totalAmount: weeklyTotalAmount,
      finalAmount: weeklyTotalAmount,
      weeklyDiscountApplied,
      reservations: mapped,
      primaryReservationId: mapped[0]?.id ?? null,
      message: selectedWeekdays.length === 1
        ? 'Solicitud enviada para ' + normalizedTotalSeats + ' lugar(es). El conductor la revisara antes de habilitar el pase.'
        : 'Solicitud semanal enviada para ' + selectedWeekdays.length + ' dias. Cada pase queda asociado a su fecha y no genera pago de traslado en la plataforma.'
    };
  }

  async myReservations(passengerUserId: string) {
    await this.ensurePassenger(passengerUserId);

    const reservations = (await this.reservationDelegate().findMany({
      where: { passengerUserId },
      include: {
        trip: {
          include: {
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
          }
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      },
      orderBy: [{ createdAt: 'desc' }]
    })) as ReservationRecord[];

    const remainingSeatsMap = await this.getRemainingSeatsMapForTrips(reservations.map((reservation) => reservation.tripId));
    return reservations.map((reservation) => this.mapReservation(reservation, remainingSeatsMap.get(reservation.tripId) ?? 0));
  }

  async findAllForAdmin() {
    const reservations = (await this.reservationDelegate().findMany({
      include: {
        trip: {
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
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      },
      orderBy: [{ createdAt: 'desc' }]
    })) as ReservationRecord[];

    const remainingSeatsMap = await this.getRemainingSeatsMapForTrips(reservations.map((reservation) => reservation.tripId));
    return reservations.map((reservation) => this.mapReservation(reservation, remainingSeatsMap.get(reservation.tripId) ?? 0));
  }

  async findByIdForAdmin(reservationId: string) {
    const reservation = (await this.reservationDelegate().findUnique({
      where: { id: reservationId },
      include: {
        trip: {
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
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      }
    })) as ReservationRecord | null;

    if (!reservation) {
      throw new NotFoundException('Reservation no encontrada');
    }

    const remainingSeats = await this.getRemainingSeats(reservation.tripId);
    return this.mapReservation(reservation, remainingSeats);
  }

  async findForDriverTrip(driverUserId: string, tripId: string) {
    await this.ensureDriver(driverUserId);

    const reservations = (await this.reservationDelegate().findMany({
      where: {
        tripId,
        trip: {
          driverUserId
        }
      },
      include: {
        trip: {
          include: {
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
          }
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      },
      orderBy: [{ createdAt: 'desc' }]
    })) as ReservationRecord[];

    const remainingSeats = await this.getRemainingSeats(tripId);
    return reservations.map((reservation) => this.mapReservation(reservation, remainingSeats));
  }
  async findByIdForPassenger(passengerUserId: string, reservationId: string) {
    await this.ensurePassenger(passengerUserId);

    const reservation = (await this.reservationDelegate().findUnique({
      where: { id: reservationId },
      include: {
        trip: {
          include: {
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
          }
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      }
    })) as ReservationRecord | null;

    if (!reservation) {
      throw new NotFoundException('Reservation no encontrada');
    }

    if (reservation.passengerUserId !== passengerUserId) {
      throw new ForbiddenException('No puedes ver solicitudes de otro usuario');
    }

    const remainingSeats = await this.getRemainingSeats(reservation.tripId);
    return this.mapReservation(reservation, remainingSeats);
  }

  async ticketForPassenger(passengerUserId: string, reservationId: string) {
    const reservation = await this.findOwnedReservationForPassenger(passengerUserId, reservationId);
    const remainingSeats = await this.getRemainingSeats(reservation.tripId);
    return this.mapReservation(reservation, remainingSeats);
  }

  async cancelByPassenger(passengerUserId: string, reservationId: string) {
    const reservation = await this.findOwnedReservationForPassenger(passengerUserId, reservationId);

    if (![RESERVATION_STATUS.PENDING, RESERVATION_STATUS.ACCEPTED, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PAID].includes(reservation.status as any)) {
      throw new ForbiddenException('Solo solicitudes pendientes o aceptadas pueden cancelarse');
    }

    const updated = (await this.reservationDelegate().update({
      where: { id: reservationId },
      data: { status: RESERVATION_STATUS.CANCELLED_BY_USER },
      include: {
        trip: {
          include: {
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
          }
        },
        payment: true
      }
    })) as ReservationRecord;

    const remainingSeats = await this.getRemainingSeats(updated.tripId);
    return this.mapReservation(updated, remainingSeats);
  }

  async acceptByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);

    if (![RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED].includes(reservation.status as any)) {
      throw new ForbiddenException('Solo solicitudes pendientes pueden aceptarse');
    }

    return this.updateReservationStatus(reservationId, RESERVATION_STATUS.ACCEPTED);
  }

  async rejectByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);

    if (![RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.ACCEPTED].includes(reservation.status as any)) {
      throw new ForbiddenException('Solo solicitudes pendientes o aceptadas pueden rechazarse');
    }

    return this.updateReservationStatus(reservationId, RESERVATION_STATUS.REJECTED);
  }
  async boardByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);
    this.validateStatusForBoarding(reservation.status, reservation.payment?.status);

    if (reservation.trip?.status !== TRIP_STATUS.STARTED) {
      throw new ForbiddenException('La ruta debe estar iniciada para validar el pase');
    }

    return this.markBoardedAtomically(reservationId);
  }

  async validateBoarding(driverUserId: string, dto: ValidateBoardingDto) {
    await this.ensureVerifiedDriver(driverUserId);

    if (!dto.numericCode && !dto.qrToken) {
      throw new BadRequestException('Debes enviar numericCode o qrToken');
    }

    const reservation = (await this.reservationDelegate().findFirst({
      where: {
        OR: [
          dto.numericCode ? { numericCode: dto.numericCode } : undefined,
          dto.qrToken ? { qrToken: dto.qrToken } : undefined
        ].filter(Boolean)
      },
      include: {
        trip: {
          include: {
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
          }
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      }
    })) as ReservationRecord | null;

    if (!reservation) {
      throw new NotFoundException('No encontramos una solicitud aceptada con ese codigo. Revisa que sean los 6 digitos del pase correcto.');
    }

    if (dto.tripId && reservation.tripId !== dto.tripId) {
      throw new ForbiddenException('Este pase no corresponde a la ruta compartida de hoy. Revisa la fecha antes de permitir el abordaje.');
    }

    if (reservation.trip?.driverUserId !== driverUserId) {
      throw new ForbiddenException('No puedes validar pase de viajes de otro conductor');
    }

    this.validateStatusForBoarding(reservation.status, reservation.payment?.status);

    if (reservation.trip?.status !== TRIP_STATUS.STARTED) {
      throw new ForbiddenException('Esta ruta aun no esta lista para validacion. Primero inicia la ruta desde Mis rutas.');
    }

    return this.markBoardedAtomically(reservation.id);
  }

  async noShowByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);

    if (![RESERVATION_STATUS.ACCEPTED, RESERVATION_STATUS.PAID].includes(reservation.status as any)) {
      throw new ForbiddenException('Solo solicitudes aceptadas pueden marcarse no_show');
    }

    return this.updateReservationStatus(reservationId, RESERVATION_STATUS.NO_SHOW);
  }

  async completeByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);

    if (reservation.status !== RESERVATION_STATUS.BOARDED) {
      throw new ForbiddenException('Solo solicitudes boarded pueden completarse');
    }

    if (reservation.trip?.status !== TRIP_STATUS.FINISHED) {
      throw new ForbiddenException('La ruta debe estar finalizada para completar la solicitud');
    }

    return this.updateReservationStatus(reservationId, RESERVATION_STATUS.COMPLETED);
  }

  private async updateReservationStatus(
    reservationId: string,
    status: (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS]
  ) {
    const updated = (await this.reservationDelegate().update({
      where: { id: reservationId },
      data: { status },
      include: {
        trip: {
          include: {
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
          }
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      }
    })) as ReservationRecord;

    const remainingSeats = await this.getRemainingSeats(updated.tripId);
    return this.mapReservation(updated, remainingSeats);
  }

  private async markBoardedAtomically(reservationId: string) {
    const updateResult = await this.reservationDelegate().updateMany({
      where: {
        id: reservationId,
        status: {
          in: [RESERVATION_STATUS.ACCEPTED, RESERVATION_STATUS.PAID]
        }
      },
      data: {
        status: RESERVATION_STATUS.BOARDED
      }
    });

    if (updateResult.count === 0) {
      throw new ForbiddenException('La solicitud ya fue validada o cambio de estado');
    }

    const updated = (await this.reservationDelegate().findUnique({
      where: { id: reservationId },
      include: {
        trip: {
          include: {
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
          }
        },
        passenger: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payment: true
      }
    })) as ReservationRecord | null;

    if (!updated) {
      throw new NotFoundException('Reservation no encontrada');
    }

    const remainingSeats = await this.getRemainingSeats(updated.tripId);
    return this.mapReservation(updated, remainingSeats);
  }

  private async findOwnedReservationForPassenger(passengerUserId: string, reservationId: string) {
    await this.ensurePassenger(passengerUserId);

    const reservation = (await this.reservationDelegate().findUnique({
      where: { id: reservationId },
      include: {
        trip: {
          include: {
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
          }
        },
        payment: true
      }
    })) as ReservationRecord | null;

    if (!reservation) {
      throw new NotFoundException('Reservation no encontrada');
    }

    if (reservation.passengerUserId !== passengerUserId) {
      throw new ForbiddenException('No puedes modificar solicitudes de otro usuario');
    }

    return reservation;
  }

  private async findReservationForDriver(driverUserId: string, reservationId: string) {
    await this.ensureDriver(driverUserId);

    const reservation = (await this.reservationDelegate().findUnique({
      where: { id: reservationId },
      include: {
        trip: {
          include: {
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
          }
        },
        payment: true
      }
    })) as ReservationRecord | null;

    if (!reservation) {
      throw new NotFoundException('Reservation no encontrada');
    }

    if (reservation.trip?.driverUserId !== driverUserId) {
      throw new ForbiddenException('No puedes operar solicitudes de rutas de otro conductor');
    }

    return reservation;
  }

  private async ensurePassenger(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        passengerProfile: true
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role.toLowerCase() !== 'passenger') {
      throw new ForbiddenException('Solo usuarios pueden solicitar rutas');
    }

    if (!user.passengerProfile) {
      throw new ForbiddenException('No existe perfil de usuario');
    }

    return user;
  }

  private async ensureVerifiedPassenger(userId: string) {
    return this.userDocumentsService.ensureUserApprovedForRole(userId, 'passenger');
  }

  private async ensureDriver(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role.toLowerCase() !== 'driver') {
      throw new ForbiddenException('Solo conductores pueden operar esta accion');
    }

    if (!user.driverProfile) {
      throw new ForbiddenException('No existe perfil de conductor');
    }

    return user;
  }

  private async ensureVerifiedDriver(userId: string) {
    await this.vehiclesService.ensureDriverCanOperate(userId);
  }

  private async getReservedSeats(tripId: string) {
    const activeStatuses = [
      RESERVATION_STATUS.CONFIRMED,
      RESERVATION_STATUS.PENDING,
      RESERVATION_STATUS.ACCEPTED,
      RESERVATION_STATUS.PAID,
      RESERVATION_STATUS.BOARDED,
      RESERVATION_STATUS.COMPLETED
    ];

    const reservations = (await this.reservationDelegate().findMany({
      where: {
        tripId,
        status: {
          in: activeStatuses
        }
      },
      select: {
        totalSeats: true
      }
    })) as Array<{ totalSeats: number }>;

    return reservations.reduce((sum, item) => sum + item.totalSeats, 0);
  }

  private async getRemainingSeatsMapForTrips(tripIds: string[]) {
    const uniqueTripIds = Array.from(new Set(tripIds.filter(Boolean)));
    const map = new Map<string, number>();

    if (uniqueTripIds.length === 0) {
      return map;
    }

    const trips = (await this.tripDelegate().findMany({
      where: {
        id: {
          in: uniqueTripIds
        }
      },
      select: {
        id: true,
        availableSeatsSnapshot: true
      }
    })) as Array<{ id: string; availableSeatsSnapshot: number }>;

    const activeStatuses = [
      RESERVATION_STATUS.CONFIRMED,
      RESERVATION_STATUS.PENDING,
      RESERVATION_STATUS.ACCEPTED,
      RESERVATION_STATUS.PAID,
      RESERVATION_STATUS.BOARDED,
      RESERVATION_STATUS.COMPLETED
    ];

    const grouped = (await this.reservationDelegate().groupBy({
      by: ['tripId'],
      where: {
        tripId: {
          in: uniqueTripIds
        },
        status: {
          in: activeStatuses
        }
      },
      _sum: {
        totalSeats: true
      }
    })) as Array<{ tripId: string; _sum: { totalSeats: number | null } }>;

    const reservedByTrip = new Map<string, number>();
    for (const row of grouped) {
      reservedByTrip.set(row.tripId, row._sum.totalSeats ?? 0);
    }

    for (const trip of trips) {
      const reservedSeats = reservedByTrip.get(trip.id) ?? 0;
      map.set(trip.id, Math.max(0, trip.availableSeatsSnapshot - reservedSeats));
    }

    return map;
  }
  private async getRemainingSeats(tripId: string) {
    const trip = (await this.tripDelegate().findUnique({
      where: { id: tripId },
      select: {
        availableSeatsSnapshot: true
      }
    })) as { availableSeatsSnapshot: number } | null;

    if (!trip) {
      return 0;
    }

    const reservedSeats = await this.getReservedSeats(tripId);
    return Math.max(0, trip.availableSeatsSnapshot - reservedSeats);
  }

  private async createReservationWithTicketAndPayment(data: {
    tripId: string;
    passengerUserId: string;
    totalSeats: number;
    companionCount: number;
    totalAmount: number;
    status: string;
    routeOfferId?: string;
    weeklyReservationGroupId?: string | null;
    isWeeklyPaymentPrimary?: boolean;
    createPayment?: boolean;
    paymentAmountOverride?: number;
  }) {
    const shouldCreatePayment = data.createPayment === true;
    const appCommissionPercent = shouldCreatePayment ? await this.farePolicyService.getCurrentAppCommissionPercent() : 0;
    const appCommissionRate = appCommissionPercent / 100;
    let retries = 5;

    while (retries > 0) {
      const numericCode = await this.generateUniqueNumericCode();
      const qrToken = await this.generateUniqueQrToken();

      try {
        const reservationPublicId = await this.nextPublicId("reservation");
        const reservation = (await this.reservationDelegate().create({
          data: {
            publicId: reservationPublicId,
            ...data,
            createPayment: undefined,
            paymentAmountOverride: undefined,
            numericCode,
            qrToken,
            payment: shouldCreatePayment ? {
              create: {
                weeklyReservationGroupId: data.weeklyReservationGroupId ?? null,
                amount: this.roundCurrency(data.paymentAmountOverride ?? data.totalAmount),
                status: PAYMENT_STATUS.PENDING,
                provider: 'platform_membership',
                paymentMethodLabel: 'Plan semanal / servicio digital VIAJA SEGURO',
                paymentInstructions:
                  'Este pago corresponde a planes semanales, verificaciones o servicios digitales de la plataforma. VIAJA SEGURO no cobra traslados ni administra pagos entre usuario y conductor.',
                appCommissionAmount: this.roundCurrency((data.paymentAmountOverride ?? data.totalAmount) * appCommissionRate),
                driverNetAmount: this.roundCurrency((data.paymentAmountOverride ?? data.totalAmount) * (1 - appCommissionRate))
              }
            } : undefined
          },
          include: {
            trip: {
              include: {
                route: true
              }
            },
            payment: true
          }
        })) as ReservationRecord;

        return reservation;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes('unique')) {
          throw error;
        }
        retries -= 1;
      }
    }

    throw new ForbiddenException('No se pudo generar ticket unico para la solicitud, intenta de nuevo');
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
  private async generateUniqueNumericCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const value = this.randomNumericCode(6);
      const exists = await this.reservationDelegate().findUnique({
        where: { numericCode: value },
        select: { id: true }
      });

      if (!exists) {
        return value;
      }
    }

    throw new ForbiddenException('No fue posible generar numericCode unico');
  }

  private async generateUniqueQrToken() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const value = randomBytes(16).toString('hex');
      const exists = await this.reservationDelegate().findUnique({
        where: { qrToken: value },
        select: { id: true }
      });

      if (!exists) {
        return value;
      }
    }

    throw new ForbiddenException('No fue posible generar qrToken unico');
  }

  private randomNumericCode(length: number) {
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }

  private getManualPaymentConfig() {
    const methodLabel = 'Mercado Pago';
    const beneficiary = null;
    const reference = process.env.MANUAL_PAYMENT_REFERENCE ?? 'VIAJA SEGURO';
    const businessAccount = null;
    const instructions =
      [
        'Abre el link oficial de Mercado Pago desde VIAJA SEGURO.',
        'Ingresa el monto exacto que aparece en tu solicitud.',
        `Referencia: ${reference}`,
        'Guarda tu comprobante y subelo para validacion manual del admin.'
      ].join('\n');

    return {
      methodLabel,
      beneficiary,
      reference,
      businessAccount,
      instructions,
      processorLabel: process.env.MANUAL_PAYMENT_PROCESSOR_LABEL ?? 'Mercado Pago'
    };
  }

  private resolvePaymentCheckoutUrl(payment: { checkoutUrl?: string | null; initPoint?: string | null; sandboxInitPoint?: string | null }) {
    if (payment.checkoutUrl) {
      return payment.checkoutUrl;
    }

    const sandboxMode = process.env.MERCADOPAGO_USE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    if (sandboxMode && payment.sandboxInitPoint) {
      return payment.sandboxInitPoint;
    }

    return payment.initPoint ?? payment.sandboxInitPoint ?? null;
  }
  private hasApprovedPayment(paymentStatus?: string) {
    return String(paymentStatus || '').toLowerCase() === PAYMENT_STATUS.APPROVED;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private validateStatusForBoarding(status: string, paymentStatus?: string) {
    const allowedReservationStatuses = [RESERVATION_STATUS.ACCEPTED, RESERVATION_STATUS.PAID];
    const normalizedPaymentStatus = String(paymentStatus || '').toLowerCase();
    const approvedPaymentStatuses = [PAYMENT_STATUS.APPROVED, 'paid'];

    if (!allowedReservationStatuses.includes(status as any)) {
      throw new ForbiddenException('Solo solicitudes aceptadas pueden validarse');
    }

    if (status === RESERVATION_STATUS.PAID && !approvedPaymentStatuses.includes(normalizedPaymentStatus as any)) {
      throw new ForbiddenException('El pago heredado debe estar validado para permitir este abordaje');
    }
  }

  private normalizeSelectedWeekdays(values?: string[] | null) {
    return Array.from(
      new Set((values ?? []).map((item) => String(item).toLowerCase().trim()).filter(Boolean))
    );
  }
  private nextDateForWeekday(weekday: string) {
    const weekdayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };

    const target = weekdayMap[weekday];
    if (typeof target !== 'number') {
      throw new BadRequestException('Dia de semana invalido.');
    }

    const now = new Date();
    const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const currentWeekday = candidate.getUTCDay();
    const diff = (target - currentWeekday + 7) % 7;
    candidate.setUTCDate(candidate.getUTCDate() + diff);
    return candidate;
  }

  private formatWeekdayLabel(weekday: string) {
    const labels: Record<string, string> = {
      monday: 'lunes',
      tuesday: 'martes',
      wednesday: 'miercoles',
      thursday: 'jueves',
      friday: 'viernes',
      saturday: 'sabado',
      sunday: 'domingo'
    };

    return labels[weekday] ?? weekday;
  }
  private parseWeekdays(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private weekdayFromJsDate(date: Date) {
    const map: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };

    return map[date.getUTCDay()];
  }
  private reservationDelegate() {
    return (this.prisma as unknown as { reservation: any }).reservation;
  }

  private tripDelegate() {
    return (this.prisma as unknown as { trip: any }).trip;
  }

  private mapReservation(reservation: ReservationRecord, remainingSeats?: number) {
    const paymentConfig = this.getManualPaymentConfig();
    const hasAcceptedRouteRequest = [
      RESERVATION_STATUS.ACCEPTED,
      RESERVATION_STATUS.PAID,
      RESERVATION_STATUS.BOARDED,
      RESERVATION_STATUS.COMPLETED
    ].includes(reservation.status as any) || this.hasApprovedPayment(reservation.payment?.status);
    const qrValue = hasAcceptedRouteRequest ? `VS-ROUTE:${reservation.id}:${reservation.qrToken}` : null;

    return {
      id: reservation.id,
      publicId: reservation.publicId,
      tripId: reservation.tripId,
      passengerUserId: reservation.passengerUserId,
      weeklyReservationGroupId: reservation.weeklyReservationGroupId ?? null,
      isWeeklyPaymentPrimary: Boolean(reservation.isWeeklyPaymentPrimary),
      totalSeats: reservation.totalSeats,
      companionCount: reservation.companionCount,
      totalAmount: reservation.totalAmount,
      numericCode: hasAcceptedRouteRequest ? reservation.numericCode : null,
      qrToken: hasAcceptedRouteRequest ? reservation.qrToken : null,
      qrValue,
      boardingCodeEnabled: hasAcceptedRouteRequest,
      status: reservation.status,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
      remainingSeats: remainingSeats ?? null,
      payment: reservation.payment
        ? {
            id: reservation.payment.id,
            reservationId: reservation.payment.reservationId,
            amount: reservation.payment.amount,
            status: reservation.payment.status,
            provider: reservation.payment.provider,
            providerReference: reservation.payment.providerReference,
            providerPreferenceId: reservation.payment.providerPreferenceId ?? null,
            checkoutUrl: this.resolvePaymentCheckoutUrl(reservation.payment),
            initPoint: reservation.payment.initPoint ?? null,
            sandboxInitPoint: reservation.payment.sandboxInitPoint ?? null,
            paymentLink: this.resolvePaymentCheckoutUrl(reservation.payment),
            paymentMethodLabel: reservation.payment.paymentMethodLabel ?? paymentConfig.methodLabel,
            paymentBeneficiary: paymentConfig.beneficiary,
            paymentReference: paymentConfig.reference,
            paymentBusinessAccount: null,
            paymentProcessorLabel: paymentConfig.processorLabel,
            paymentProcessingMessage: `Los pagos a VIAJA SEGURO corresponden solo a planes semanales, verificaciones o servicios digitales; no a traslados.`,
            paymentInstructions: reservation.payment.paymentInstructions ?? paymentConfig.instructions,
            proofFileName: reservation.payment.proofFileName ?? null,
            proofFilePath: reservation.payment.proofFilePath ?? null,
            proofFileUrl: reservation.payment.proofFilePath ? '/uploads/payment-proofs/' + reservation.payment.proofFilePath.split(/[/\\]/).pop() : null,
            reviewedByAdminUserId: reservation.payment.reviewedByAdminUserId ?? null,
            reviewedAt: reservation.payment.reviewedAt ?? null,
            reviewNotes: reservation.payment.reviewNotes ?? null,
            appCommissionAmount: reservation.payment.appCommissionAmount,
            driverNetAmount: reservation.payment.driverNetAmount,
            createdAt: reservation.payment.createdAt,
            updatedAt: reservation.payment.updatedAt
          }
        : null,
      trip: reservation.trip
        ? {
            id: reservation.trip.id,
            tripDate: reservation.trip.tripDate,
            status: reservation.trip.status,
            departureTimeSnapshot: reservation.trip.departureTimeSnapshot,
            estimatedArrivalTimeSnapshot: reservation.trip.estimatedArrivalTimeSnapshot,
            availableSeatsSnapshot: reservation.trip.availableSeatsSnapshot,
            pricePerSeatSnapshot: reservation.trip.pricePerSeatSnapshot,
            boardingReference: hasAcceptedRouteRequest ? reservation.trip.boardingReference : null,
            route: reservation.trip.route
              ? {
                  id: reservation.trip.route.id,
                  title: reservation.trip.route.title,
                  origin: reservation.trip.route.origin,
                  destination: reservation.trip.route.destination
                }
              : null,
            driver: reservation.trip.driver
              ? {
                  id: reservation.trip.driver.id,
                  fullName: reservation.trip.driver.fullName,
                  email: reservation.trip.driver.email
                }
              : null,
            vehiclePhotoUrl: hasAcceptedRouteRequest
              ? reservation.trip.driver?.vehicle?.documents?.[0]?.filePath ?? null
              : null
          }
        : null,
      passenger: reservation.passenger
        ? {
            id: reservation.passenger.id,
            fullName: reservation.passenger.fullName,
            email: reservation.passenger.email
          }
        : null
    };
  }
}
