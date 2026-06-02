import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateWeeklyPayoutDto } from './dto/generate-weekly-payout.dto';
import { MarkWeeklyPayoutPaidDto } from './dto/mark-weekly-payout-paid.dto';
import { UpdateDriverBankDetailsDto } from './dto/update-driver-bank-details.dto';

type WeeklyPayoutRecord = {
  id: string;
  driverUserId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  appCommissionAmount: number;
  refundedAmount: number;
  netAmount: number;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  driver?: any;
};

@Injectable()
export class WeeklyPayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForAdmin() {
    const payouts = (await this.weeklyPayoutDelegate().findMany({
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }]
    })) as WeeklyPayoutRecord[];

    return payouts.map((payout) => this.mapWeeklyPayout(payout));
  }

  async findByIdForAdminOrDriver(payoutId: string, userId: string, role: string) {
    const payout = await this.findOrThrow(payoutId);

    if (role !== 'admin' && payout.driverUserId !== userId) {
      throw new ForbiddenException('No puedes ver liquidaciones de otro conductor');
    }

    return this.mapWeeklyPayout(payout);
  }

  async myDriverPayouts(driverUserId: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverUserId },
      include: { driverProfile: true }
    });

    if (!driver || driver.role !== 'driver') {
      throw new ForbiddenException('Solo conductores pueden consultar sus liquidaciones');
    }

    const payouts = (await this.weeklyPayoutDelegate().findMany({
      where: { driverUserId },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }]
    })) as WeeklyPayoutRecord[];

    return payouts.map((payout) => this.mapWeeklyPayout(payout));
  }

  async getAdminStats(periodStart?: string, periodEnd?: string) {
    const { startDate, endDate } = this.resolvePeriod(periodStart, periodEnd);

    const trips = await this.tripDelegate().findMany({
      where: {
        status: 'finished',
        ...(startDate && endDate
          ? {
              tripDate: {
                gte: startDate,
                lte: endDate
              }
            }
          : {})
      },
      select: {
        id: true,
        driverUserId: true,
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    const payments = await this.paymentDelegate().findMany({
      where: {
        status: {
          in: ['approved', 'paid', 'refunded']
        },
        reservation: {
          trip: {
            status: 'finished',
            ...(startDate && endDate
              ? {
                  tripDate: {
                    gte: startDate,
                    lte: endDate
                  }
                }
              : {})
          }
        }
      },
      select: {
        amount: true,
        appCommissionAmount: true,
        driverNetAmount: true,
        reservation: {
          select: {
            trip: {
              select: {
                driverUserId: true
              }
            }
          }
        }
      }
    });

    const byDriverMap = new Map<string, {
      driverUserId: string;
      driver: { id: string; fullName: string; email: string } | null;
      completedTrips: number;
      totalMoney: number;
      appCommissionAmount: number;
      appCommissionPercent: number;
      netAmount: number;
    }>();

    for (const trip of trips) {
      if (!byDriverMap.has(trip.driverUserId)) {
        byDriverMap.set(trip.driverUserId, {
          driverUserId: trip.driverUserId,
          driver: trip.driver ?? null,
          completedTrips: 0,
          totalMoney: 0,
          appCommissionAmount: 0,
          appCommissionPercent: 0,
          netAmount: 0
        });
      }

      const current = byDriverMap.get(trip.driverUserId)!;
      current.completedTrips += 1;
    }

    for (const payment of payments) {
      const driverUserId = payment?.reservation?.trip?.driverUserId;
      if (!driverUserId) {
        continue;
      }

      if (!byDriverMap.has(driverUserId)) {
        byDriverMap.set(driverUserId, {
          driverUserId,
          driver: null,
          completedTrips: 0,
          totalMoney: 0,
          appCommissionAmount: 0,
          appCommissionPercent: 0,
          netAmount: 0
        });
      }

      const current = byDriverMap.get(driverUserId)!;
      current.totalMoney += payment.amount ?? 0;
      current.appCommissionAmount += payment.appCommissionAmount ?? 0;
      current.netAmount += payment.driverNetAmount ?? 0;
    }

    const byDriver = [...byDriverMap.values()]
      .map((item) => {
        const totalMoney = this.roundCurrency(item.totalMoney);
        const appCommissionAmount = this.roundCurrency(item.appCommissionAmount);
        return {
          ...item,
          totalMoney,
          appCommissionAmount,
          netAmount: this.roundCurrency(item.netAmount),
          appCommissionPercent: totalMoney > 0 ? this.roundCurrency((appCommissionAmount / totalMoney) * 100) : 0
        };
      })
      .sort((a, b) => b.totalMoney - a.totalMoney);

    const totalCompletedTrips = byDriver.reduce((sum, item) => sum + item.completedTrips, 0);
    const totalMoney = this.roundCurrency(byDriver.reduce((sum, item) => sum + item.totalMoney, 0));
    const appCommissionAmount = this.roundCurrency(byDriver.reduce((sum, item) => sum + item.appCommissionAmount, 0));
    const netAmount = this.roundCurrency(byDriver.reduce((sum, item) => sum + item.netAmount, 0));

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totals: {
        totalCompletedTrips,
        totalMoney,
        appCommissionAmount,
        appCommissionPercent: totalMoney > 0 ? this.roundCurrency((appCommissionAmount / totalMoney) * 100) : 0,
        netAmount
      },
      byDriver
    };
  }

  async getDriverStats(driverUserId: string, periodStart?: string, periodEnd?: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverUserId },
      include: { driverProfile: true }
    });

    if (!driver || driver.role !== 'driver') {
      throw new ForbiddenException('Solo conductores pueden consultar estas estadisticas');
    }

    const { startDate, endDate } = this.resolvePeriod(periodStart, periodEnd);

    const trips = await this.tripDelegate().findMany({
      where: {
        status: 'finished',
        driverUserId,
        ...(startDate && endDate
          ? {
              tripDate: {
                gte: startDate,
                lte: endDate
              }
            }
          : {})
      },
      select: {
        id: true
      }
    });

    const payments = await this.paymentDelegate().findMany({
      where: {
        status: {
          in: ['approved', 'paid', 'refunded']
        },
        reservation: {
          trip: {
            status: 'finished',
            driverUserId,
            ...(startDate && endDate
              ? {
                  tripDate: {
                    gte: startDate,
                    lte: endDate
                  }
                }
              : {})
          }
        }
      },
      select: {
        amount: true,
        appCommissionAmount: true,
        driverNetAmount: true
      }
    });

    const totalCompletedTrips = trips.length;
    const totalMoney = this.roundCurrency(payments.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0));
    const appCommissionAmount = this.roundCurrency(
      payments.reduce((sum: number, p: any) => sum + (p.appCommissionAmount ?? 0), 0)
    );
    const netAmount = this.roundCurrency(payments.reduce((sum: number, p: any) => sum + (p.driverNetAmount ?? 0), 0));
    const appCommissionPercent = totalMoney > 0 ? this.roundCurrency((appCommissionAmount / totalMoney) * 100) : 0;

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totals: {
        totalCompletedTrips,
        totalMoney,
        appCommissionAmount,
        appCommissionPercent,
        netAmount
      },
      byDriver: [
        {
          driverUserId,
          driver: {
            id: driver.id,
            fullName: driver.fullName,
            email: driver.email
          },
          completedTrips: totalCompletedTrips,
          totalMoney,
          appCommissionAmount,
          appCommissionPercent,
          netAmount
        }
      ]
    };
  }

  async getDriverBankDetails(driverUserId: string) {
    await this.ensureDriverProfile(driverUserId);

    return {
      isComplete: true,
      message: 'Las liquidaciones se coordinan de forma privada con administracion. No almacenamos datos bancarios en la app.'
    };
  }

  async updateDriverBankDetails(driverUserId: string, dto: UpdateDriverBankDetailsDto) {
    const profile = await this.ensureDriverProfile(driverUserId);

    await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: {
        bankAccountNumber: null,
        bankClabe: null
      }
    });

    return {
      isComplete: true,
      message: 'Por seguridad, VIAJA SEGURO no almacena datos bancarios en la app.'
    };
  }

  async requestPayment(payoutId: string, driverUserId: string) {
    const payout = await this.findOrThrow(payoutId);

    if (payout.driverUserId !== driverUserId) {
      throw new ForbiddenException('No puedes solicitar pago de una liquidacion que no es tuya');
    }

    if (payout.status === 'paid') {
      throw new ForbiddenException('Esta liquidacion ya fue pagada');
    }

    if (payout.status === 'requested') {
      throw new ForbiddenException('Ya solicitaste el pago de esta liquidacion');
    }

    const updated = (await this.weeklyPayoutDelegate().update({
      where: { id: payoutId },
      data: {
        status: 'requested',
        notes: payout.notes ?? 'Pago solicitado por conductor'
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })) as WeeklyPayoutRecord;

    return this.mapWeeklyPayout(updated);
  }

  async generate(dto: GenerateWeeklyPayoutDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
      throw new ForbiddenException('Rango de periodo invalido');
    }

    const driverIds = dto.driverUserId ? [dto.driverUserId] : await this.getDriversWithPeriodActivity(periodStart, periodEnd);

    if (driverIds.length === 0) {
      return [];
    }

    const created: WeeklyPayoutRecord[] = [];

    for (const driverUserId of driverIds) {
      const duplicate = await this.weeklyPayoutDelegate().findFirst({
        where: {
          driverUserId,
          periodStart,
          periodEnd
        },
        select: { id: true }
      });

      if (duplicate) {
        throw new ForbiddenException('Ya existe liquidacion para ese conductor y periodo');
      }

      const payments = await this.paymentDelegate().findMany({
        where: {
          status: {
            in: ['approved', 'paid', 'refunded']
          },
          reservation: {
            trip: {
              driverUserId,
              tripDate: {
                gte: periodStart,
                lte: periodEnd
              }
            }
          }
        },
        select: {
          amount: true,
          appCommissionAmount: true
        }
      });

      const refunds = await this.refundDelegate().findMany({
        where: {
          reservation: {
            trip: {
              driverUserId,
              tripDate: {
                gte: periodStart,
                lte: periodEnd
              }
            }
          }
        },
        select: {
          amount: true
        }
      });

      const grossAmount = this.roundCurrency(payments.reduce((sum: number, p: any) => sum + p.amount, 0));
      const appCommissionAmount = this.roundCurrency(payments.reduce((sum: number, p: any) => sum + p.appCommissionAmount, 0));
      const refundedAmount = this.roundCurrency(refunds.reduce((sum: number, r: any) => sum + r.amount, 0));
      const netAmount = this.roundCurrency(grossAmount - appCommissionAmount - refundedAmount);

      const payout = (await this.weeklyPayoutDelegate().create({
        data: {
          driverUserId,
          periodStart,
          periodEnd,
          grossAmount,
          appCommissionAmount,
          refundedAmount,
          netAmount,
          status: 'pending'
        },
        include: {
          driver: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      })) as WeeklyPayoutRecord;

      created.push(payout);
    }

    return created.map((payout) => this.mapWeeklyPayout(payout));
  }

  async markPaid(payoutId: string, dto: MarkWeeklyPayoutPaidDto) {
    const payout = await this.findOrThrow(payoutId);

    if (payout.status === 'paid') {
      throw new ForbiddenException('La liquidacion ya fue marcada como paid');
    }

    const updated = (await this.weeklyPayoutDelegate().update({
      where: { id: payoutId },
      data: {
        status: 'paid',
        notes: dto.notes ?? payout.notes
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })) as WeeklyPayoutRecord;

    return this.mapWeeklyPayout(updated);
  }

  private async getDriversWithPeriodActivity(periodStart: Date, periodEnd: Date) {
    const paymentRows = await this.paymentDelegate().findMany({
      where: {
        reservation: {
          trip: {
            tripDate: {
              gte: periodStart,
              lte: periodEnd
            }
          }
        }
      },
      select: {
        reservation: {
          select: {
            trip: {
              select: {
                driverUserId: true
              }
            }
          }
        }
      }
    });

    const ids = new Set<string>();
    for (const row of paymentRows) {
      const id = row?.reservation?.trip?.driverUserId;
      if (id) {
        ids.add(id);
      }
    }

    return [...ids];
  }

  private async findOrThrow(payoutId: string) {
    const payout = (await this.weeklyPayoutDelegate().findUnique({
      where: { id: payoutId },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })) as WeeklyPayoutRecord | null;

    if (!payout) {
      throw new NotFoundException('Weekly payout no encontrado');
    }

    return payout;
  }

  private paymentDelegate() {
    return (this.prisma as unknown as { payment: any }).payment;
  }

  private tripDelegate() {
    return (this.prisma as unknown as { trip: any }).trip;
  }

  private refundDelegate() {
    return (this.prisma as unknown as { refund: any }).refund;
  }

  private weeklyPayoutDelegate() {
    return (this.prisma as unknown as { weeklyPayout: any }).weeklyPayout;
  }

  private async ensureDriverProfile(driverUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: driverUserId },
      include: { driverProfile: true }
    });

    if (!user || user.role !== 'driver' || !user.driverProfile) {
      throw new ForbiddenException('Solo conductores con perfil activo pueden realizar esta accion');
    }

    return user.driverProfile;
  }

  private resolvePeriod(periodStart?: string, periodEnd?: string) {
    if (!periodStart && !periodEnd) {
      return { startDate: null as Date | null, endDate: null as Date | null };
    }

    if (!periodStart || !periodEnd) {
      throw new ForbiddenException('Para filtrar estadisticas debes enviar periodStart y periodEnd');
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new ForbiddenException('Rango de periodo invalido para estadisticas');
    }

    return { startDate, endDate };
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private mapWeeklyPayout(payout: WeeklyPayoutRecord) {
    return {
      id: payout.id,
      driverUserId: payout.driverUserId,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      grossAmount: payout.grossAmount,
      appCommissionAmount: payout.appCommissionAmount,
      refundedAmount: payout.refundedAmount,
      netAmount: payout.netAmount,
      status: payout.status,
      notes: payout.notes,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt,
      driver: payout.driver ?? null
    };
  }
}
