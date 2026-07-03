import { Module } from '@nestjs/common';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsController } from './payments.controller';
import { UsersModule } from '../users/users.module';
import { PaymentsService } from './payments.service';

@Module({
  imports: [UsersModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
