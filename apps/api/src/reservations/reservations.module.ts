import { Module } from '@nestjs/common';
import { FarePolicyModule } from '../fare-policy/fare-policy.module';
import { RouteOffersModule } from '../route-offers/route-offers.module';
import { UserDocumentsModule } from '../user-documents/user-documents.module';
import { UsersModule } from '../users/users.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [UserDocumentsModule, VehiclesModule, RouteOffersModule, FarePolicyModule, UsersModule],
  controllers: [ReservationsController],
  providers: [ReservationsService]
})
export class ReservationsModule {}
