import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReviewPaymentDto } from './dto/review-payment.dto';
import { PaymentsService } from './payments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('pending-review')
  findPendingReview() {
    return this.paymentsService.findPendingReviewForAdmin();
  }


  @Patch('bulk-archive')
  archiveMany(@CurrentUser() user: { sub: string }, @Body() dto: { paymentIds?: string[] }) {
    return this.paymentsService.archivePayments(user.sub, dto.paymentIds ?? []);
  }

  @Patch('bulk-restore')
  restoreMany(@Body() dto: { paymentIds?: string[] }) {
    return this.paymentsService.restorePayments(dto.paymentIds ?? []);
  }

  @Patch(':paymentId/approve')
  approve(@CurrentUser() user: { sub: string }, @Param('paymentId') paymentId: string, @Body() dto: ReviewPaymentDto) {
    return this.paymentsService.approveManualPayment(user.sub, paymentId, dto);
  }

  @Patch(':paymentId/reject')
  reject(@CurrentUser() user: { sub: string }, @Param('paymentId') paymentId: string, @Body() dto: ReviewPaymentDto) {
    return this.paymentsService.rejectManualPayment(user.sub, paymentId, dto);
  }
}
