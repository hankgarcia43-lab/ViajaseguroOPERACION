import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RouteOffersService } from '../route-offers/route-offers.service';
import { UserDocumentsService } from '../user-documents/user-documents.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateReservationByOfferDto } from './dto/create-reservation-by-offer.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ValidateBoardingDto } from './dto/validate-boarding.dto';

type ReservationRecord = {
  id: string;
  publicId: number | null;
  tripId: string;
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

const WEEKLY_RESERVATION_MIN_DAYS = 5;
const WEEKLY_PROMO_FACTOR = 0.9334;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userDocumentsService: UserDocumentsService,
    private readonly vehiclesService: VehiclesService,
    private readonly routeOffersService: RouteOffersService
  ) {}

  async create(passengerUserId: string, dto: CreateReservationDto) {
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
      throw new ForbiddenException('No se puede reservar sobre viajes cancelados o finalizados');
    }

    const reservedSeats = await this.getReservedSeats(trip.id);
    const remainingSeats = trip.availableSeatsSnapshot - reservedSeats;

    if (dto.totalSeats > remainingSeats) {
      throw new ForbiddenException('No hay asientos suficientes para esta reserva');
    }

    const totalAmount = dto.totalSeats * trip.pricePerSeatSnapshot;

    const reservation = await this.createReservationWithTicketAndPayment({
      tripId: trip.id,
      passengerUserId: passenger.id,
      totalSeats: dto.totalSeats,
      companionCount,
      totalAmount,
      status: RESERVATION_STATUS.CONFIRMED
    });

    return this.mapReservation(reservation, remainingSeats - dto.totalSeats);
  }


  async createByOffer(passengerUserId: string, dto: CreateReservationByOfferDto) {
    const passenger = await this.ensureVerifiedPassenger(passengerUserId);
    const offer = await this.routeOffersService.findOfferOrThrow(dto.offerId);

    if (String(offer.status || '').toLowerCase() !== 'active') {
      throw new ForbiddenException('La disponibilidad del conductor no esta activa.');
    }

    if (!offer.route || String(offer.route.status || '').toLowerCase() !== 'active') {
      throw new ForbiddenException('La ruta base no esta disponible.');
    }

    const weekdays = this.parseWeekdays(offer.weekdaysText);
    const selectedWeekdays = Array.from(
      new Set((dto.selectedWeekdays ?? []).map((item) => String(item).toLowerCase().trim()).filter(Boolean))
    );

    if (selectedWeekdays.length === 0) {
      throw new BadRequestException('Selecciona al menos un dia de la semana.');
    }

    if (offer.serviceType === 'one_time' && selectedWeekdays.length > 1) {
      throw new BadRequestException('Este conductor ofrece servicio unico en esta ruta. Selecciona solo un dia.');
    }

    for (const weekday of selectedWeekdays) {
      if (!weekdays.includes(weekday)) {
        throw new BadRequestException(
          `El conductor no opera en ${this.formatWeekdayLabel(weekday)}. Elige un dia disponible.`
        );
      }
    }

    const normalizedTotalSeats = dto.totalSeats;
    const companionCount = normalizedTotalSeats - 1;
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
          `No hay asientos suficientes para ${this.formatWeekdayLabel(weekday)}. Disponibles: ${Math.max(remainingSeats, 0)}.`
        );
      }

      const totalAmount = normalizedTotalSeats * trip.pricePerSeatSnapshot;
      const reservation = await this.createReservationWithTicketAndPayment({
        tripId: trip.id,
        passengerUserId: passenger.id,
        totalSeats: normalizedTotalSeats,
        companionCount,
        totalAmount,
        status: RESERVATION_STATUS.CONFIRMED,
        routeOfferId: offer.id
      });

      items.push(reservation);
    }

    const mapped = await Promise.all(
      items.map(async (reservation) => {
        const remainingSeats = await this.getRemainingSeats(reservation.tripId);
        return this.mapReservation(reservation, remainingSeats);
      })
    );

    const totalDays = mapped.length;
    const grossAmount = mapped.reduce((sum, reservation) => sum + reservation.totalAmount, 0);
    const weeklyDiscountApplied = totalDays >= WEEKLY_RESERVATION_MIN_DAYS;
    const finalAmount = weeklyDiscountApplied ? grossAmount * WEEKLY_PROMO_FACTOR : grossAmount;

    return {
      routeId: offer.routeId,
      routeOfferId: offer.id,
      totalDays,
      totalSeats: normalizedTotalSeats,
      selectedWeekdays,
      grossAmount: this.roundCurrency(grossAmount),
      totalAmount: this.roundCurrency(finalAmount),
      finalAmount: this.roundCurrency(finalAmount),
      weeklyDiscountApplied,
      reservations: mapped,
      message: weeklyDiscountApplied
        ? 'Reserva semanal creada para ' + totalDays + ' dia(s). Se aplico un beneficio especial en tu total final.'
        : 'Reserva creada para ' + totalDays + ' dia(s) de la semana.'
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
      throw new ForbiddenException('No puedes ver reservas de otro pasajero');
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

    if (![RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PAID].includes(reservation.status as any)) {
      throw new ForbiddenException('Solo reservas confirmed o paid pueden cancelarse');
    }

    const updated = (await this.reservationDelegate().update({
      where: { id: reservationId },
      data: { status: RESERVATION_STATUS.CANCELLED },
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

  async boardByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);
    this.validateStatusForBoarding(reservation.status, reservation.payment?.status);

    if (reservation.trip?.status !== TRIP_STATUS.STARTED) {
      throw new ForbiddenException('El viaje debe estar iniciado para abordar');
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
      throw new NotFoundException('No existe reservation para ese codigo/token');
    }

    if (dto.tripId && reservation.tripId !== dto.tripId) {
      throw new ForbiddenException('La reserva no pertenece al viaje indicado');
    }

    if (reservation.trip?.driverUserId !== driverUserId) {
      throw new ForbiddenException('No puedes validar abordaje de viajes de otro conductor');
    }

    this.validateStatusForBoarding(reservation.status, reservation.payment?.status);

    if (reservation.trip?.status !== TRIP_STATUS.STARTED) {
      throw new ForbiddenException('El viaje debe estar iniciado para validar abordaje');
    }

    return this.markBoardedAtomically(reservation.id);
  }

  async noShowByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);

    if (![RESERVATION_STATUS.PAID].includes(reservation.status as any)) {
      throw new ForbiddenException('Solo reservas paid pueden marcarse no_show');
    }

    return this.updateReservationStatus(reservationId, RESERVATION_STATUS.NO_SHOW);
  }

  async completeByDriver(driverUserId: string, reservationId: string) {
    await this.ensureVerifiedDriver(driverUserId);
    const reservation = await this.findReservationForDriver(driverUserId, reservationId);

    if (reservation.status !== RESERVATION_STATUS.BOARDED) {
      throw new ForbiddenException('Solo reservas boarded pueden completarse');
    }

    if (reservation.trip?.status !== TRIP_STATUS.FINISHED) {
      throw new ForbiddenException('El viaje debe estar finalizado para completar la reserva');
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
        status: RESERVATION_STATUS.PAID
      },
      data: {
        status: RESERVATION_STATUS.BOARDED
      }
    });

    if (updateResult.count === 0) {
      throw new ForbiddenException('La reserva ya fue abordada o cambio de estado');
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
      throw new ForbiddenException('No puedes modificar reservas de otro pasajero');
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
      throw new ForbiddenException('No puedes operar reservas de viajes de otro conductor');
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
      throw new ForbiddenException('Solo pasajeros pueden reservar');
    }

    if (!user.passengerProfile) {
      throw new ForbiddenException('No existe perfil de pasajero');
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
  }) {
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
            numericCode,
            qrToken,
            payment: {
              create: {
                amount: this.roundCurrency(data.totalAmount),
                status: PAYMENT_STATUS.PENDING,
                provider: 'manual_transfer',
                paymentMethodLabel: process.env.MANUAL_PAYMENT_METHOD_LABEL ?? 'Transferencia bancaria',
                paymentInstructions:
                  process.env.MANUAL_PAYMENT_INSTRUCTIONS ??
                  `Beneficiario: ${process.env.MANUAL_PAYMENT_BENEFICIARY ?? 'VIAJA SEGURO'}\nMetodo: ${process.env.MANUAL_PAYMENT_METHOD_LABEL ?? 'Transferencia bancaria'}\nReferencia: ${process.env.MANUAL_PAYMENT_REFERENCE ?? 'VS-RESERVA'}\nEnvia tu comprobante para validacion manual del admin.`,
                appCommissionAmount: this.roundCurrency(data.totalAmount * 0.15),
                driverNetAmount: this.roundCurrency(data.totalAmount * 0.85)
              }
            }
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

    throw new ForbiddenException('No se pudo generar ticket unico para la reserva, intenta de nuevo');
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
    const methodLabel = process.env.MANUAL_PAYMENT_METHOD_LABEL ?? 'Transferencia bancaria empresarial';
    const beneficiary = process.env.MANUAL_PAYMENT_BENEFICIARY ?? 'VIAJA SEGURO';
    const reference = process.env.MANUAL_PAYMENT_REFERENCE ?? 'VS-RESERVA';
    const businessAccount = process.env.MANUAL_PAYMENT_BUSINESS_ACCOUNT ?? null;
    const instructions =
      process.env.MANUAL_PAYMENT_INSTRUCTIONS ??
      [
        `Beneficiario comercial: ${beneficiary}`,
        `Metodo o banco: ${methodLabel}`,
        businessAccount ? `Cuenta o CLABE del negocio: ${businessAccount}` : null,
        `Referencia: ${reference}`,
        'Sube tu comprobante para validacion manual del admin.'
      ]
        .filter(Boolean)
        .join('\n');

    return {
      methodLabel,
      beneficiary,
      reference,
      businessAccount,
      instructions,
      processorLabel: process.env.MANUAL_PAYMENT_PROCESSOR_LABEL ?? 'VIAJA SEGURO'
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
    const allowedReservationStatuses = [RESERVATION_STATUS.PAID];
    const normalizedPaymentStatus = String(paymentStatus || '').toLowerCase();
    const approvedPaymentStatuses = [PAYMENT_STATUS.APPROVED, 'paid'];

    if (!allowedReservationStatuses.includes(status as any)) {
      throw new ForbiddenException('Solo reservas con pago validado pueden marcarse boarded');
    }

    if (!approvedPaymentStatuses.includes(normalizedPaymentStatus as any)) {
      throw new ForbiddenException('El pago debe estar validado por admin para permitir abordaje');
    }
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
    const hasApprovedPayment = this.hasApprovedPayment(reservation.payment?.status);
    const qrValue = hasApprovedPayment ? `VS-RES:${reservation.id}:${reservation.qrToken}` : null;

    return {
      id: reservation.id,
      publicId: reservation.publicId,
      tripId: reservation.tripId,
      passengerUserId: reservation.passengerUserId,
      totalSeats: reservation.totalSeats,
      companionCount: reservation.companionCount,
      totalAmount: reservation.totalAmount,
      numericCode: hasApprovedPayment ? reservation.numericCode : null,
      qrToken: hasApprovedPayment ? reservation.qrToken : null,
      qrValue,
      boardingCodeEnabled: hasApprovedPayment,
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
            paymentBusinessAccount: paymentConfig.businessAccount,
            paymentProcessorLabel: paymentConfig.processorLabel,
            paymentProcessingMessage: `El pago sera procesado por ${paymentConfig.processorLabel} y depositado a la cuenta operativa registrada por la empresa.`,
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
            boardingReference: hasApprovedPayment ? reservation.trip.boardingReference : null,
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
            vehiclePhotoUrl: hasApprovedPayment
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

