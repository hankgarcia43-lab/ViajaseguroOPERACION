import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateDriverRouteProposalDto } from './dto/create-driver-route-proposal.dto';
import { CreateRequestedRouteDto } from './dto/create-requested-route.dto';

const REQUEST_STATUS = {
  OPEN: 'open',
  DRIVER_OFFERED: 'driver_offered',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
} as const;

const PROPOSAL_STATUS = {
  PENDING_USER_RESPONSE: 'pending_user_response',
  ACCEPTED_BY_USER: 'accepted_by_user',
  REJECTED_BY_USER: 'rejected_by_user',
  CANCELLED_BY_DRIVER: 'cancelled_by_driver'
} as const;

@Injectable()
export class RouteNeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly vehiclesService: VehiclesService
  ) {}

  async createNeed(userId: string, dto: CreateRequestedRouteDto) {
    await this.usersService.ensurePremiumAccess(userId, 'publicar necesidades de ruta');
    await this.ensurePassenger(userId);

    const need = await this.requestedRouteDelegate().create({
      data: {
        userId,
        originText: dto.originText,
        destinationText: dto.destinationText,
        desiredDate: dto.desiredDate ? new Date(dto.desiredDate) : null,
        recurrenceDays: dto.recurrenceDays?.length ? JSON.stringify([...new Set(dto.recurrenceDays)]) : null,
        desiredTime: dto.desiredTime,
        seatsNeeded: dto.seatsNeeded,
        message: dto.message || null,
        status: REQUEST_STATUS.OPEN
      },
      include: this.needInclude()
    });

    return this.mapNeed(need);
  }

  async findAllForAdmin() {
    const needs = await this.requestedRouteDelegate().findMany({
      include: this.needInclude(),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return needs.map((need: any) => this.mapNeed(need));
  }
  async myNeeds(userId: string) {
    await this.ensurePassenger(userId);
    const needs = await this.requestedRouteDelegate().findMany({
      where: { userId },
      include: this.needInclude(),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return needs.map((need: any) => this.mapNeed(need));
  }

  async openNeedsForDriver(driverId: string) {
    await this.usersService.ensurePremiumAccess(driverId, 'ver rutas solicitadas por usuarios');
    await this.vehiclesService.ensureDriverCanOperate(driverId);

    const needs = await this.requestedRouteDelegate().findMany({
      where: { status: { in: [REQUEST_STATUS.OPEN, REQUEST_STATUS.DRIVER_OFFERED] } },
      include: this.needInclude(),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return needs.map((need: any) => this.mapNeed(need));
  }

  async propose(driverId: string, requestedRouteId: string, dto: CreateDriverRouteProposalDto) {
    await this.usersService.ensurePremiumAccess(driverId, 'responder rutas solicitadas');
    await this.vehiclesService.ensureDriverCanOperate(driverId);

    const need = await this.requestedRouteDelegate().findUnique({ where: { id: requestedRouteId } });
    if (!need) {
      throw new NotFoundException('Ruta solicitada no encontrada');
    }

    if (![REQUEST_STATUS.OPEN, REQUEST_STATUS.DRIVER_OFFERED].includes(String(need.status) as any)) {
      throw new ForbiddenException('Esta ruta solicitada ya no acepta propuestas.');
    }

    if (dto.availableSeats < need.seatsNeeded) {
      throw new BadRequestException('Los cupos disponibles no cubren los lugares que necesita el usuario.');
    }

    const proposal = await this.driverRouteProposalDelegate().create({
      data: {
        requestedRouteId,
        driverId,
        proposedTime: dto.proposedTime,
        boardingPoint: dto.boardingPoint,
        boardingReference: dto.boardingReference,
        suggestedCashContribution: dto.suggestedCashContribution,
        availableSeats: dto.availableSeats,
        messageToUser: dto.messageToUser || null,
        status: PROPOSAL_STATUS.PENDING_USER_RESPONSE
      },
      include: this.proposalInclude()
    });

    await this.requestedRouteDelegate().update({
      where: { id: requestedRouteId },
      data: { status: REQUEST_STATUS.DRIVER_OFFERED }
    });

    return this.mapProposal(proposal);
  }

  async acceptProposal(userId: string, proposalId: string) {
    const proposal = await this.findProposalForPassengerOrThrow(userId, proposalId);
    if (proposal.status !== PROPOSAL_STATUS.PENDING_USER_RESPONSE) {
      throw new ForbiddenException('Esta propuesta ya fue respondida.');
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).driverRouteProposal.update({
        where: { id: proposalId },
        data: { status: PROPOSAL_STATUS.ACCEPTED_BY_USER }
      });
      await (tx as any).driverRouteProposal.updateMany({
        where: {
          requestedRouteId: proposal.requestedRouteId,
          id: { not: proposalId },
          status: PROPOSAL_STATUS.PENDING_USER_RESPONSE
        },
        data: { status: PROPOSAL_STATUS.REJECTED_BY_USER }
      });
      await (tx as any).requestedRoute.update({
        where: { id: proposal.requestedRouteId },
        data: { status: REQUEST_STATUS.CONFIRMED }
      });
    });

    return this.findNeedByIdForPassenger(userId, proposal.requestedRouteId);
  }

  async rejectProposal(userId: string, proposalId: string) {
    const proposal = await this.findProposalForPassengerOrThrow(userId, proposalId);
    if (proposal.status !== PROPOSAL_STATUS.PENDING_USER_RESPONSE) {
      throw new ForbiddenException('Esta propuesta ya fue respondida.');
    }

    await this.driverRouteProposalDelegate().update({
      where: { id: proposalId },
      data: { status: PROPOSAL_STATUS.REJECTED_BY_USER }
    });

    return this.findNeedByIdForPassenger(userId, proposal.requestedRouteId);
  }

  async findNeedByIdForPassenger(userId: string, needId: string) {
    await this.ensurePassenger(userId);
    const need = await this.requestedRouteDelegate().findFirst({
      where: { id: needId, userId },
      include: this.needInclude()
    });
    if (!need) throw new NotFoundException('Ruta solicitada no encontrada');
    return this.mapNeed(need);
  }

  private async findProposalForPassengerOrThrow(userId: string, proposalId: string) {
    await this.ensurePassenger(userId);
    const proposal = await this.driverRouteProposalDelegate().findUnique({
      where: { id: proposalId },
      include: { requestedRoute: true, driver: { include: { vehicle: true } } }
    });

    if (!proposal || proposal.requestedRoute?.userId !== userId) {
      throw new NotFoundException('Propuesta no encontrada');
    }

    return proposal;
  }

  private async ensurePassenger(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (this.usersService.mapRole(user.role) !== 'passenger') {
      throw new ForbiddenException('Solo usuarios miembros pueden publicar o gestionar necesidades de ruta.');
    }
    return user;
  }

  private needInclude() {
    return {
      user: { select: { id: true, fullName: true, email: true, verificationStatus: true } },
      proposals: {
        include: this.proposalInclude(),
        orderBy: [{ createdAt: 'desc' }]
      }
    };
  }

  private proposalInclude() {
    return {
      driver: {
        select: {
          id: true,
          fullName: true,
          email: true,
          verificationStatus: true,
          vehicle: true
        }
      }
    };
  }

  private mapNeed(need: any) {
    return {
      id: need.id,
      userId: need.userId,
      originText: need.originText,
      destinationText: need.destinationText,
      desiredDate: need.desiredDate,
      recurrenceDays: this.parseWeekdays(need.recurrenceDays),
      desiredTime: need.desiredTime,
      seatsNeeded: need.seatsNeeded,
      message: need.message ?? null,
      status: need.status,
      user: need.user ?? null,
      proposals: Array.isArray(need.proposals) ? need.proposals.map((proposal: any) => this.mapProposal(proposal)) : [],
      createdAt: need.createdAt,
      updatedAt: need.updatedAt
    };
  }

  private mapProposal(proposal: any) {
    const vehicle = proposal.driver?.vehicle ?? null;
    return {
      id: proposal.id,
      requestedRouteId: proposal.requestedRouteId,
      driverId: proposal.driverId,
      proposedTime: proposal.proposedTime,
      boardingPoint: proposal.boardingPoint,
      boardingReference: proposal.boardingReference,
      suggestedCashContribution: proposal.suggestedCashContribution,
      availableSeats: proposal.availableSeats,
      messageToUser: proposal.messageToUser ?? null,
      status: proposal.status,
      driver: proposal.driver
        ? {
            id: proposal.driver.id,
            fullName: proposal.driver.fullName,
            email: proposal.driver.email,
            verificationStatus: proposal.driver.verificationStatus,
            vehicle: vehicle
              ? {
                  id: vehicle.id,
                  plates: vehicle.plates,
                  brand: vehicle.brand,
                  model: vehicle.model,
                  year: vehicle.year,
                  color: vehicle.color,
                  seatCount: vehicle.seatCount,
                  status: vehicle.status
                }
              : null
          }
        : null,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt
    };
  }

  private parseWeekdays(value?: string | null) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private requestedRouteDelegate() {
    return (this.prisma as any).requestedRoute;
  }

  private driverRouteProposalDelegate() {
    return (this.prisma as any).driverRouteProposal;
  }
}
