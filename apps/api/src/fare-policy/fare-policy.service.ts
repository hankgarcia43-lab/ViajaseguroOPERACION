import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertFarePolicyDto } from './dto/upsert-fare-policy.dto';

const FARE_POLICY_MODE = {
  FIXED_PER_KM: 'fixed_per_km',
  MAX_PER_KM: 'max_per_km'
} as const;

type FarePolicyRecord = {
  id: string;
  mode: string;
  ratePerKm: number;
  appCommissionPercent: number;
  currency: string;
  isActive: boolean;
  notes: string | null;
  createdByAdminUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByAdmin?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

@Injectable()
export class FarePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentPolicy() {
    const policy = (await this.delegate().findFirst({
      where: { isActive: true },
      include: this.includeAdmin(),
      orderBy: [{ createdAt: 'desc' }]
    })) as FarePolicyRecord | null;

    return policy ? this.mapPolicy(policy) : null;
  }

  async getCurrentPolicyOrThrow() {
    const policy = await this.getCurrentPolicy();
    if (!policy) {
      throw new BadRequestException('Aun no existe una tarifa por kilometro activa. Pide al admin configurarla antes de publicar rutas.');
    }
    return policy;
  }

  async getHistory() {
    const policies = (await this.delegate().findMany({
      include: this.includeAdmin(),
      orderBy: [{ createdAt: 'desc' }]
    })) as FarePolicyRecord[];

    return policies.map((policy) => this.mapPolicy(policy));
  }

  async updateCurrentPolicy(adminUserId: string, dto: UpsertFarePolicyDto) {
    await this.prisma.$transaction(async (tx) => {
      await (tx as any).farePolicy.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      await (tx as any).farePolicy.create({
        data: {
          mode: dto.mode,
          ratePerKm: this.roundCurrency(dto.ratePerKm),
          appCommissionPercent: dto.appCommissionPercent,
          currency: dto.currency ?? 'MXN',
          notes: dto.notes?.trim() || null,
          createdByAdminUserId: adminUserId,
          isActive: true
        }
      });
    });

    const current = await this.getCurrentPolicy();
    if (!current) {
      throw new NotFoundException('No se pudo guardar la tarifa activa');
    }

    return current;
  }

  async getCurrentAppCommissionPercent() {
    const policy = await this.getCurrentPolicy();
    return policy?.appCommissionPercent ?? 15;
  }

  async resolveRoutePricing(distanceKm: number, requestedPricePerSeat: number) {
    const policy = await this.getCurrentPolicyOrThrow();
    const roundedDistance = this.roundDistance(distanceKm);
    const maxAllowedPrice = this.roundCurrency(roundedDistance * policy.ratePerKm);

    if (policy.mode === FARE_POLICY_MODE.MAX_PER_KM && requestedPricePerSeat > maxAllowedPrice) {
      throw new BadRequestException(
        `El precio por asiento rebasa el limite permitido. Con ${roundedDistance} km y una tarifa maxima de $${policy.ratePerKm.toFixed(2)} por km, el maximo permitido es $${maxAllowedPrice.toFixed(2)} MXN.`
      );
    }

    const finalPricePerSeat =
      policy.mode === FARE_POLICY_MODE.FIXED_PER_KM ? maxAllowedPrice : this.roundCurrency(requestedPricePerSeat);

    return {
      farePolicyId: policy.id,
      farePolicyMode: policy.mode,
      fareRatePerKmApplied: policy.ratePerKm,
      distanceKm: roundedDistance,
      maxAllowedPrice,
      finalPricePerSeat,
      policy
    };
  }

  private includeAdmin() {
    return {
      createdByAdmin: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    };
  }

  private delegate() {
    return (this.prisma as unknown as { farePolicy: any }).farePolicy;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private roundDistance(value: number) {
    return Math.round(value * 100) / 100;
  }

  private mapPolicy(policy: FarePolicyRecord) {
    return {
      id: policy.id,
      mode: policy.mode,
      ratePerKm: policy.ratePerKm,
      appCommissionPercent: policy.appCommissionPercent,
      currency: policy.currency,
      isActive: policy.isActive,
      notes: policy.notes,
      createdByAdminUserId: policy.createdByAdminUserId,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      createdByAdmin: policy.createdByAdmin
        ? {
            id: policy.createdByAdmin.id,
            fullName: policy.createdByAdmin.fullName,
            email: policy.createdByAdmin.email
          }
        : null
    };
  }
}