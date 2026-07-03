import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RouteNeedsController } from './route-needs.controller';
import { RouteNeedsService } from './route-needs.service';

@Module({
  imports: [UsersModule, VehiclesModule],
  controllers: [RouteNeedsController],
  providers: [RouteNeedsService]
})
export class RouteNeedsModule {}
