import { Module } from '@nestjs/common';
import { FarePolicyModule } from '../fare-policy/fare-policy.module';
import { UsersModule } from '../users/users.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { AdminRoutesController } from './admin-routes.controller';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [VehiclesModule, FarePolicyModule, UsersModule],
  controllers: [RoutesController, AdminRoutesController],
  providers: [RoutesService]
})
export class RoutesModule {}
