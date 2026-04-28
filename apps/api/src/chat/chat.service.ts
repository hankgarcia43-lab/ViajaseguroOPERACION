import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listMessages(requestUserId: string, reservationId: string, role: string) {
    const context = await this.assertReservationAccess(requestUserId, reservationId, role, false);

    const messages = await this.chatDelegate().findMany({
      where: { reservationId },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        receiver: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: [{ createdAt: 'asc' }]
    });

    return {
      reservationId,
      tripId: context.tripId,
      participants: {
        driverUserId: context.driverUserId,
        passengerUserId: context.passengerUserId
      },
      messages: messages.map((msg: any) => this.mapMessage(msg))
    };
  }

  async sendMessage(requestUserId: string, reservationId: string, rawMessage: string, role: string) {
    const context = await this.assertReservationAccess(requestUserId, reservationId, role, true);

    const message = String(rawMessage ?? '').trim();
    if (!message) {
      throw new ForbiddenException('Escribe un mensaje para enviarlo.');
    }

    const receiverUserId = requestUserId === context.driverUserId ? context.passengerUserId : context.driverUserId;

    const created = await this.chatDelegate().create({
      data: {
        reservationId,
        tripId: context.tripId,
        routeOfferId: context.routeOfferId,
        senderUserId: requestUserId,
        receiverUserId,
        message
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        receiver: { select: { id: true, fullName: true, role: true } }
      }
    });

    return this.mapMessage(created);
  }

  private async assertReservationAccess(requestUserId: string, reservationId: string, role: string, strict: boolean) {
    const reservation = await this.reservationDelegate().findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        tripId: true,
        routeOfferId: true,
        passengerUserId: true,
        trip: {
          select: {
            id: true,
            driverUserId: true
          }
        }
      }
    });

    if (!reservation || !reservation.trip) {
      throw new NotFoundException('No se encontro la reserva para abrir el chat.');
    }

    const isDriver = reservation.trip.driverUserId === requestUserId;
    const isPassenger = reservation.passengerUserId === requestUserId;
    const isAdmin = String(role || '').toLowerCase() === 'admin';

    if (!isDriver && !isPassenger && !isAdmin) {
      throw new ForbiddenException('No tienes permisos para ver este chat.');
    }

    if (strict && isAdmin) {
      throw new ForbiddenException('El chat personal es solo entre pasajero y conductor.');
    }

    return {
      reservationId: reservation.id,
      tripId: reservation.trip.id,
      routeOfferId: reservation.routeOfferId ?? null,
      driverUserId: reservation.trip.driverUserId,
      passengerUserId: reservation.passengerUserId
    };
  }

  private mapMessage(message: any) {
    return {
      id: message.id,
      reservationId: message.reservationId,
      tripId: message.tripId,
      routeOfferId: message.routeOfferId ?? null,
      senderUserId: message.senderUserId,
      receiverUserId: message.receiverUserId,
      message: message.message,
      createdAt: message.createdAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            fullName: message.sender.fullName,
            role: message.sender.role
          }
        : null,
      receiver: message.receiver
        ? {
            id: message.receiver.id,
            fullName: message.receiver.fullName,
            role: message.receiver.role
          }
        : null
    };
  }

  private reservationDelegate() {
    return (this.prisma as any).reservation;
  }

  private chatDelegate() {
    return (this.prisma as any).tripChatMessage;
  }
}
