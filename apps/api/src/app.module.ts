import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { DriverProfilesModule } from './driver-profiles/driver-profiles.module';
import { FarePolicyModule } from './fare-policy/fare-policy.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { PassengerProfilesModule } from './passenger-profiles/passenger-profiles.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RefundsModule } from './refunds/refunds.module';
import { ReservationsModule } from './reservations/reservations.module';
import { RouteOffersModule } from './route-offers/route-offers.module';
import { RoutesModule } from './routes/routes.module';
import { TripsModule } from './trips/trips.module';
import { UserDocumentsModule } from './user-documents/user-documents.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WeeklyPayoutsModule } from './weekly-payouts/weekly-payouts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ChatModule,
    UsersModule,
    DriverProfilesModule,
    PassengerProfilesModule,
    UserDocumentsModule,
    VehiclesModule,
    FarePolicyModule,
    RoutesModule,
    RouteOffersModule,
    TripsModule,
    ReservationsModule,
    PaymentsModule,
    RefundsModule,
    WeeklyPayoutsModule,
    WebhooksModule,
    IncidentsModule,
    HealthModule
  ]
})
export class AppModule {}
