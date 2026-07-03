import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RouteOffersController } from './route-offers.controller';
import { RouteOffersService } from './route-offers.service';

@Module({
  imports: [VehiclesModule, UsersModule],
  controllers: [RouteOffersController],
  providers: [RouteOffersService],
  exports: [RouteOffersService]
})
export class RouteOffersModule {}
