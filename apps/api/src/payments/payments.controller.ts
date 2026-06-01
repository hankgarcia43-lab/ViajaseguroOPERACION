import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SimulatePaymentDto } from './dto/simulate-payment.dto';
import { PaymentsService } from './payments.service';

const uploadDirectory = join(process.cwd(), 'uploads', 'payment-proofs');
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function ensureUploadDirectory() {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles('admin')
  findAllAdmin(@Query('includeArchived') includeArchived?: string) {
    return this.paymentsService.findAllForAdmin({ includeArchived: includeArchived === 'true' });
  }

  @Get('my-payments')
  @Roles('passenger')
  myPayments(@CurrentUser() user: { sub: string; role: string }, @Query('includeArchived') includeArchived?: string) {
    return this.paymentsService.myPayments(user.sub, user.role, { includeArchived: includeArchived === 'true' });
  }

  @Get(':id')
  @Roles('passenger', 'admin')
  findById(@CurrentUser() user: { sub: string; role: string }, @Param('id') paymentId: string) {
    return this.paymentsService.findById(user.sub, user.role, paymentId);
  }

  @Post(':reservationId/upload-proof')
  @Roles('passenger')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: any, _file: any, callback: (error: Error | null, destination: string) => void) => {
          ensureUploadDirectory();
          callback(null, uploadDirectory);
        },
        filename: (_req: any, file: any, callback: (error: Error | null, filename: string) => void) => {
          const extension = extname(file.originalname).toLowerCase();
          callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`);
        }
      }),
      limits: {
        fileSize: 5 * 1024 * 1024
      },
      fileFilter: (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => {
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.has(extension)) {
          req.fileValidationError = 'Solo se permiten archivos JPG, JPEG, PNG o PDF';
          callback(null, false);
          return;
        }

        callback(null, true);
      }
    })
  )
  uploadProof(
    @CurrentUser() user: { sub: string },
    @Param('reservationId') reservationId: string,
    @UploadedFile() file: any,
    @Req() req: any
  ) {
    if (req.fileValidationError) {
      throw new BadRequestException(req.fileValidationError);
    }

    if (!file) {
      throw new BadRequestException('Debes adjuntar un comprobante');
    }

    return this.paymentsService.uploadProof(user.sub, reservationId, file);
  }

  @Post(':reservationId/mercadopago-checkout')
  @Roles('passenger', 'admin')
  mercadoPagoCheckout(@CurrentUser() user: { sub: string; role: string }, @Param('reservationId') reservationId: string) {
    return this.paymentsService.createMercadoPagoCheckout(user.sub, user.role, reservationId);
  }

  @Post(':reservationId/simulate-pay')
  @Roles('passenger', 'admin')
  simulatePay(
    @CurrentUser() user: { sub: string; role: string },
    @Param('reservationId') reservationId: string,
    @Body() dto: SimulatePaymentDto
  ) {
    return this.paymentsService.simulatePay(user.sub, user.role, reservationId, dto);
  }

  @Post(':reservationId/simulate-fail')
  @Roles('passenger', 'admin')
  simulateFail(@CurrentUser() user: { sub: string; role: string }, @Param('reservationId') reservationId: string) {
    return this.paymentsService.simulateFail(user.sub, user.role, reservationId);
  }

  @Post(':reservationId/simulate-refund')
  @Roles('passenger', 'admin')
  simulateRefund(@CurrentUser() user: { sub: string; role: string }, @Param('reservationId') reservationId: string) {
    return this.paymentsService.simulateRefund(user.sub, user.role, reservationId);
  }
}

