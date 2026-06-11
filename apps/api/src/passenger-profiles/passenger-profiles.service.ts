import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PassengerProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(userId: string, status: 'pending' | 'approved' | 'rejected' | 'suspended' = 'pending') {
    return this.prisma.passengerProfile.create({
      data: {
        userId,
        status
      }
    });
  }

  async updateStatusForUser(userId: string, status: 'pending' | 'approved' | 'rejected' | 'suspended') {
    return this.prisma.passengerProfile.updateMany({
      where: { userId },
      data: { status }
    });
  }
}
