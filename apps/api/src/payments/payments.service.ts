import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewPaymentDto } from './dto/review-payment.dto';
import { SimulatePaymentDto } from './dto/simulate-payment.dto';

type PaymentRecord = {
  id: string;
  reservationId: string;
  weeklyReservationGroupId: string | null;
  amount: number;
  status: string;
  provider: string;
  providerReference: string | null;
  providerPreferenceId: string | null;
  checkoutUrl: string | null;
  initPoint: string | null;
  sandboxInitPoint: string | null;
  paymentMethodLabel: string | null;
  paymentInstructions: string | null;
  proofFileName: string | null;
  proofFilePath: string | null;
  reviewedByAdminUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  archivedAt: Date | null;
  archivedByAdminUserId: string | null;
  appCommissionAmount: number;
  driverNetAmount: number;
  createdAt: Date;
  updatedAt: Date;
  reservation?: any;
  reviewedByAdmin?: any;
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUNDED: 'refunded'
} as const;

const RESERVATION_STATUS = {
  PAID: 'paid',
  CONFIRMED: 'confirmed',
  BOARDED: 'boarded',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  REFUNDED: 'refunded',
  COMPLETED: 'completed'
} as const;

const PAYMENT_PROVIDER = {
  MANUAL: 'manual_transfer',
  MERCADOPAGO: 'mercadopago',
  SIMULATED: 'simulated'
} as const;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForAdmin(options: { includeArchived?: boolean } = {}) {
    const payments = (await this.paymentDelegate().findMany({
      where: options.includeArchived ? undefined : { archivedAt: null },
      include: this.adminPaymentInclude(),
      orderBy: [{ createdAt: 'desc' }]
    })) as PaymentRecord[];

    return payments.map((payment) => this.mapPayment(payment));
  }

  async findPendingReviewForAdmin() {
    const payments = (await this.paymentDelegate().findMany({
      where: { status: PAYMENT_STATUS.SUBMITTED },
      include: this.adminPaymentInclude(),
      orderBy: [{ updatedAt: 'asc' }]
    })) as PaymentRecord[];

    return payments.map((payment) => this.mapPayment(payment));
  }

  async myPayments(userId: string, role: string, options: { includeArchived?: boolean } = {}) {
    if (role !== 'passenger') {
      throw new ForbiddenException('Solo pasajeros pueden ver su lista de pagos');
    }

    const payments = (await this.paymentDelegate().findMany({
      where: {
        archivedAt: options.includeArchived ? undefined : null,
        reservation: {
          passengerUserId: userId
        }
      },
      include: this.basePaymentInclude(),
      orderBy: [{ createdAt: 'desc' }]
    })) as PaymentRecord[];

    return payments.map((payment) => this.mapPayment(payment));
  }

  async findById(userId: string, role: string, paymentId: string) {
    const payment = await this.findPaymentByIdOrThrow(paymentId);

    if (role !== 'admin' && payment.reservation?.passengerUserId !== userId) {
      throw new ForbiddenException('No puedes ver pagos de otra reserva');
    }

    return this.mapPayment(payment);
  }

  async uploadProof(userId: string, reservationId: string, file: any) {
    const payment = await this.findPaymentByReservationOrThrow(reservationId);

    if (payment.reservation?.passengerUserId !== userId) {
      throw new ForbiddenException('Solo el pasajero dueno de la reserva puede subir comprobante');
    }

    const normalizedStatus = this.normalizePaymentStatus(payment.status);
    if ([PAYMENT_STATUS.APPROVED, PAYMENT_STATUS.REFUNDED].includes(normalizedStatus as any)) {
      throw new ForbiddenException('Este pago ya no admite nuevos comprobantes');
    }

    if (!file) {
      throw new BadRequestException('Debes adjuntar un comprobante');
    }

    const config = this.getManualPaymentConfig();

    await this.paymentDelegate().update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_STATUS.SUBMITTED,
        provider: PAYMENT_PROVIDER.MANUAL,
        paymentMethodLabel: config.methodLabel,
        paymentInstructions: config.instructions,
        proofFileName: file.originalname,
        proofFilePath: `/uploads/payment-proofs/${file.filename}`,
        reviewedByAdminUserId: null,
        reviewedAt: null,
        reviewNotes: null
      }
    });

    return this.findById(userId, 'passenger', payment.id);
  }

  async approveManualPayment(adminUserId: string, paymentId: string, dto: ReviewPaymentDto) {
    const payment = await this.findPaymentByIdOrThrow(paymentId);
    const normalizedStatus = this.normalizePaymentStatus(payment.status);

    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.SUBMITTED, PAYMENT_STATUS.REJECTED].includes(normalizedStatus as any)) {
      throw new ForbiddenException('Solo pagos pending, submitted o rejected pueden aprobarse manualmente');
    }

    await this.applyProviderStatusToPayment(
      payment.id,
      payment.reservationId,
      payment.status,
      PAYMENT_STATUS.APPROVED,
      payment.reservation?.status,
      {
        provider: payment.provider || PAYMENT_PROVIDER.MANUAL,
        providerReference: payment.providerReference,
        refundReason: null,
        refundAmount: payment.amount,
        reviewedByAdminUserId: adminUserId,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes ?? (normalizedStatus === PAYMENT_STATUS.PENDING ? 'Pago marcado manualmente como validado por admin' : 'Pago manual aprobado por admin')
      }
    );

    return this.findById(adminUserId, 'admin', payment.id);
  }


  async archivePayments(adminUserId: string, paymentIds: string[]) {
    const ids = this.normalizeIds(paymentIds);
    if (ids.length === 0) {
      throw new BadRequestException('Selecciona al menos un pago para archivar');
    }

    const result = await this.paymentDelegate().updateMany({
      where: { id: { in: ids } },
      data: {
        archivedAt: new Date(),
        archivedByAdminUserId: adminUserId
      }
    });

    return { requestedCount: ids.length, updatedCount: result.count };
  }

  async restorePayments(paymentIds: string[]) {
    const ids = this.normalizeIds(paymentIds);
    if (ids.length === 0) {
      throw new BadRequestException('Selecciona al menos un pago para restaurar');
    }

    const result = await this.paymentDelegate().updateMany({
      where: { id: { in: ids } },
      data: {
        archivedAt: null,
        archivedByAdminUserId: null
      }
    });

    return { requestedCount: ids.length, updatedCount: result.count };
  }

  async rejectManualPayment(adminUserId: string, paymentId: string, dto: ReviewPaymentDto) {
    const payment = await this.findPaymentByIdOrThrow(paymentId);
    const normalizedStatus = this.normalizePaymentStatus(payment.status);

    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.SUBMITTED].includes(normalizedStatus as any)) {
      throw new ForbiddenException('Solo pagos pending o submitted pueden rechazarse manualmente');
    }

    await this.applyProviderStatusToPayment(
      payment.id,
      payment.reservationId,
      payment.status,
      PAYMENT_STATUS.REJECTED,
      payment.reservation?.status,
      {
        provider: payment.provider || PAYMENT_PROVIDER.MANUAL,
        providerReference: payment.providerReference,
        refundReason: null,
        refundAmount: payment.amount,
        reviewedByAdminUserId: adminUserId,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes ?? 'Pago manual rechazado por admin'
      }
    );

    return this.findById(adminUserId, 'admin', payment.id);
  }

  async createMercadoPagoCheckout(userId: string, role: string, reservationId: string) {
    const payment = await this.findPaymentByReservationForCheckoutOrThrow(reservationId);

    if (role !== 'admin' && payment.reservation?.passengerUserId !== userId) {
      throw new ForbiddenException('Solo el pasajero dueno de la reserva puede iniciar checkout');
    }

    this.assertCheckoutAllowed(payment);

    const existingCheckoutUrl = this.resolvePaymentCheckoutUrl(payment);
    if (payment.provider === PAYMENT_PROVIDER.MERCADOPAGO && existingCheckoutUrl) {
      return {
        payment: this.mapPayment(payment),
        checkoutUrl: existingCheckoutUrl,
        preferenceId: payment.providerPreferenceId ?? payment.providerReference ?? null,
        initPoint: payment.initPoint ?? null,
        sandboxInitPoint: payment.sandboxInitPoint ?? null
      };
    }
    const accessToken = this.getMercadoPagoAccessToken();
    const appUrl = this.getFrontendBaseUrl();
    const ticketUrl = `${appUrl}/dashboard/my-reservations/${payment.reservationId}/ticket`;

    const title =
      payment.reservation?.trip?.route?.title ||
      `${payment.reservation?.trip?.route?.origin ?? 'Viaje'} -> ${payment.reservation?.trip?.route?.destination ?? ''}`;

    const body: Record<string, unknown> = {
      external_reference: payment.id,
      statement_descriptor: 'VIAJA SEGURO',
      auto_return: 'approved',
      back_urls: {
        success: `${ticketUrl}?mp_status=success`,
        failure: `${ticketUrl}?mp_status=failure`,
        pending: `${ticketUrl}?mp_status=pending`
      },
      items: [
        {
          title: title.trim() || 'Reserva Viaja Seguro',
          quantity: 1,
          unit_price: payment.amount,
          currency_id: 'MXN'
        }
      ],
      metadata: {
        reservation_id: payment.reservationId,
        payment_id: payment.id
      }
    };

    if (payment.reservation?.passenger?.email) {
      body.payer = {
        email: payment.reservation.passenger.email,
        name: payment.reservation.passenger.fullName
      };
    }

    const webhookUrl = process.env.MERCADOPAGO_WEBHOOK_URL;
    if (webhookUrl) {
      body.notification_url = webhookUrl;
    }

    const mpPreference = await this.callMercadoPagoApi('/checkout/preferences', {
      method: 'POST',
      accessToken,
      body,
      idempotencyKey: `pref-${payment.id}-${Date.now()}`
    });

    const sandboxMode = process.env.MERCADOPAGO_USE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    const checkoutUrl = sandboxMode && mpPreference.sandbox_init_point ? mpPreference.sandbox_init_point : mpPreference.init_point;

    if (!checkoutUrl) {
      throw new BadGatewayException('Mercado Pago no devolvio URL de checkout');
    }

    const preferenceId = mpPreference.id ? String(mpPreference.id) : null;

    await this.paymentDelegate().update({
      where: { id: payment.id },
      data: {
        provider: PAYMENT_PROVIDER.MERCADOPAGO,
        providerReference: preferenceId ?? payment.providerReference,
        providerPreferenceId: preferenceId,
        checkoutUrl,
        initPoint: mpPreference.init_point ?? null,
        sandboxInitPoint: mpPreference.sandbox_init_point ?? null,
        paymentMethodLabel: 'Mercado Pago Checkout Pro',
        paymentInstructions: 'Presiona el boton Pagar con Mercado Pago para abrir el checkout seguro. Tambien puedes conservar el flujo manual subiendo tu comprobante si soporte te lo indica.',
        status: PAYMENT_STATUS.PENDING
      }
    });

    const updated = await this.findPaymentByIdOrThrow(payment.id);

    return {
      payment: this.mapPayment(updated),
      checkoutUrl,
      preferenceId: mpPreference.id ?? null,
      initPoint: mpPreference.init_point ?? null,
      sandboxInitPoint: mpPreference.sandbox_init_point ?? null
    };
  }

  async processMercadoPagoWebhook(
    payload: any,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>
  ) {
    const topic = String(payload?.type ?? payload?.topic ?? payload?.action ?? query?.type ?? query?.topic ?? '').toLowerCase();

    if (topic && !topic.includes('payment')) {
      return { received: true, ignored: true, reason: 'non-payment-event' };
    }

    const paymentIdFromEvent = payload?.data?.id ?? payload?.id ?? query?.id ?? query?.['data.id'];
    if (!paymentIdFromEvent) {
      return { received: true, ignored: true, reason: 'missing-payment-id' };
    }

    const dataId = Array.isArray(paymentIdFromEvent) ? String(paymentIdFromEvent[0]) : String(paymentIdFromEvent);
    this.verifyMercadoPagoWebhookSignatureIfConfigured(headers, dataId);

    const accessToken = this.getMercadoPagoAccessToken();
    const mpPayment = await this.callMercadoPagoApi(`/v1/payments/${dataId}`, {
      method: 'GET',
      accessToken
    });

    const localPaymentId = String(mpPayment.external_reference ?? '').trim();
    if (!localPaymentId) {
      return { received: true, ignored: true, reason: 'missing-external-reference', mpPaymentId: dataId };
    }

    const localPayment = await this.paymentDelegate().findUnique({
      where: { id: localPaymentId },
      include: {
        reservation: true,
        refund: true
      }
    });

    if (!localPayment) {
      return { received: true, ignored: true, reason: 'local-payment-not-found', localPaymentId, mpPaymentId: dataId };
    }

    const mappedStatus = this.mapMercadoPagoStatus(String(mpPayment.status ?? 'pending'));

    await this.applyProviderStatusToPayment(
      localPayment.id,
      localPayment.reservationId,
      localPayment.status,
      mappedStatus,
      localPayment.reservation?.status,
      {
        provider: PAYMENT_PROVIDER.MERCADOPAGO,
        providerReference: String(mpPayment.id),
        refundReason: `Mercado Pago webhook: ${String(mpPayment.status ?? 'unknown')}`,
        refundAmount: localPayment.amount,
        reviewedByAdminUserId: null,
        reviewedAt: new Date(),
        reviewNotes: `Mercado Pago webhook: ${String(mpPayment.status ?? 'unknown')}`
      }
    );

    return {
      received: true,
      ignored: false,
      paymentId: localPayment.id,
      reservationId: localPayment.reservationId,
      mappedStatus,
      mpStatus: mpPayment.status ?? null,
      mpPaymentId: String(mpPayment.id)
    };
  }

  async simulatePay(userId: string, role: string, reservationId: string, dto: SimulatePaymentDto) {
    const payment = await this.findPaymentByReservationOrThrow(reservationId);
    await this.assertSimulationPermission(userId, role, payment);

    const normalizedStatus = this.normalizePaymentStatus(payment.status);
    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REJECTED].includes(normalizedStatus as any)) {
      throw new ForbiddenException('Solo pagos pending o rejected pueden pasar a approved');
    }

    await this.applyProviderStatusToPayment(payment.id, payment.reservationId, payment.status, PAYMENT_STATUS.APPROVED, payment.reservation?.status, {
      provider: payment.provider || PAYMENT_PROVIDER.SIMULATED,
      providerReference: dto.providerReference ?? payment.providerReference,
      refundReason: null,
      refundAmount: payment.amount,
      reviewedByAdminUserId: role === 'admin' ? userId : null,
      reviewedAt: new Date(),
      reviewNotes: 'Simulacion local de pago aprobado'
    });

    return this.findById(userId, role, payment.id);
  }

  async simulateFail(userId: string, role: string, reservationId: string) {
    const payment = await this.findPaymentByReservationOrThrow(reservationId);
    await this.assertSimulationPermission(userId, role, payment);

    const normalizedStatus = this.normalizePaymentStatus(payment.status);
    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.SUBMITTED].includes(normalizedStatus as any)) {
      throw new ForbiddenException('Solo pagos pending o submitted pueden pasar a rejected');
    }

    if ([RESERVATION_STATUS.BOARDED, RESERVATION_STATUS.COMPLETED].includes(payment.reservation?.status as any)) {
      throw new ForbiddenException('No puedes rechazar una reserva ya abordada o completada');
    }

    await this.applyProviderStatusToPayment(payment.id, payment.reservationId, payment.status, PAYMENT_STATUS.REJECTED, payment.reservation?.status, {
      provider: payment.provider || PAYMENT_PROVIDER.SIMULATED,
      providerReference: payment.providerReference,
      refundReason: null,
      refundAmount: payment.amount,
      reviewedByAdminUserId: role === 'admin' ? userId : null,
      reviewedAt: new Date(),
      reviewNotes: 'Simulacion local de pago rechazado'
    });

    return this.findById(userId, role, payment.id);
  }

  async simulateRefund(userId: string, role: string, reservationId: string) {
    const payment = await this.findPaymentByReservationOrThrow(reservationId);
    await this.assertSimulationPermission(userId, role, payment);

    const normalizedStatus = this.normalizePaymentStatus(payment.status);
    if (normalizedStatus !== PAYMENT_STATUS.APPROVED) {
      throw new ForbiddenException('Solo pagos approved pueden pasar a refunded');
    }

    if ([RESERVATION_STATUS.BOARDED, RESERVATION_STATUS.COMPLETED].includes(payment.reservation?.status as any)) {
      throw new ForbiddenException('No puedes hacer refund de una reserva abordada/completada en esta fase');
    }

    await this.applyProviderStatusToPayment(payment.id, payment.reservationId, payment.status, PAYMENT_STATUS.REFUNDED, payment.reservation?.status, {
      provider: payment.provider || PAYMENT_PROVIDER.SIMULATED,
      providerReference: payment.providerReference,
      refundReason: 'Simulacion local de refund',
      refundAmount: payment.amount,
      reviewedByAdminUserId: role === 'admin' ? userId : null,
      reviewedAt: new Date(),
      reviewNotes: 'Simulacion local de refund'
    });

    return this.findById(userId, role, payment.id);
  }

  private async applyProviderStatusToPayment(
    paymentId: string,
    reservationId: string,
    currentStatus: string,
    nextStatus: string,
    reservationStatus: string,
    providerInfo: {
      provider: string;
      providerReference: string | null;
      refundReason: string | null;
      refundAmount: number;
      reviewedByAdminUserId: string | null;
      reviewedAt: Date | null;
      reviewNotes: string | null;
    }
  ) {
    const normalizedCurrent = this.normalizePaymentStatus(currentStatus);
    const normalizedNext = this.normalizePaymentStatus(nextStatus);
    const normalizedReservationStatus = String(reservationStatus || '').toLowerCase();

    if (normalizedCurrent === PAYMENT_STATUS.APPROVED && [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.SUBMITTED, PAYMENT_STATUS.REJECTED].includes(normalizedNext as any)) {
      return;
    }

    if (normalizedCurrent === PAYMENT_STATUS.REFUNDED && normalizedNext !== PAYMENT_STATUS.REFUNDED) {
      return;
    }

    if (
      normalizedNext === PAYMENT_STATUS.APPROVED &&
      [RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.REFUNDED, RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.COMPLETED].includes(
        normalizedReservationStatus as any
      )
    ) {
      return;
    }

    const paymentUpdateData: Record<string, unknown> = {
      status: normalizedNext,
      provider: providerInfo.provider,
      providerReference: providerInfo.providerReference,
      reviewedByAdminUserId: providerInfo.reviewedByAdminUserId,
      reviewedAt: providerInfo.reviewedAt,
      reviewNotes: providerInfo.reviewNotes
    };

    if (normalizedNext === PAYMENT_STATUS.APPROVED) {
      paymentUpdateData.archivedAt = providerInfo.reviewedAt ?? new Date();
      paymentUpdateData.archivedByAdminUserId = providerInfo.reviewedByAdminUserId;
    }

    if (normalizedNext === PAYMENT_STATUS.REFUNDED) {
      paymentUpdateData.archivedAt = null;
      paymentUpdateData.archivedByAdminUserId = null;
    }

    const reservationUpdateData: Record<string, unknown> | null =
      normalizedNext === PAYMENT_STATUS.APPROVED
        ? { status: RESERVATION_STATUS.PAID }
        : normalizedNext === PAYMENT_STATUS.REJECTED
        ? { status: RESERVATION_STATUS.CONFIRMED }
        : normalizedNext === PAYMENT_STATUS.REFUNDED
        ? { status: RESERVATION_STATUS.REFUNDED }
        : null;

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).payment.update({
        where: { id: paymentId },
        data: paymentUpdateData
      });

      if (reservationUpdateData) {
        const weeklyReservationGroupId = (await (tx as any).payment.findUnique({ where: { id: paymentId }, select: { weeklyReservationGroupId: true } }))?.weeklyReservationGroupId ?? null;
        if (weeklyReservationGroupId) {
          await (tx as any).reservation.updateMany({
            where: { weeklyReservationGroupId },
            data: reservationUpdateData
          });
        } else {
          await (tx as any).reservation.update({
            where: { id: reservationId },
            data: reservationUpdateData
          });
        }
      }
    });

    if (normalizedNext === PAYMENT_STATUS.REFUNDED) {
      await this.ensureRefundRecord(paymentId, reservationId, providerInfo.refundAmount, providerInfo.refundReason);
    }
  }

  private async ensureRefundRecord(paymentId: string, reservationId: string, amount: number, reason: string | null) {
    const existingRefund = await this.refundDelegate().findUnique({
      where: { paymentId },
      select: { id: true }
    });

    if (existingRefund) {
      return;
    }

    await this.refundDelegate().create({
      data: {
        paymentId,
        reservationId,
        amount: this.roundCurrency(amount),
        reason: reason ?? 'Refund registrado por transicion de payment',
        status: 'processed',
        adminUserId: null
      }
    });
  }

  private verifyMercadoPagoWebhookSignatureIfConfigured(headers: Record<string, string | string[] | undefined>, dataId: string) {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) {
      return;
    }

    const signature = this.getHeaderValue(headers, 'x-signature');
    const requestId = this.getHeaderValue(headers, 'x-request-id');

    if (!signature || !requestId) {
      throw new ForbiddenException('Webhook signature headers faltantes');
    }

    const signatureParts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});

    const ts = signatureParts.ts;
    const v1 = signatureParts.v1;

    if (!ts || !v1) {
      throw new ForbiddenException('Firma webhook invalida');
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    if (expected !== v1) {
      throw new ForbiddenException('Firma webhook no valida');
    }
  }

  private mapMercadoPagoStatus(mpStatus: string) {
    const normalized = mpStatus.toLowerCase();

    if (normalized === 'approved') {
      return PAYMENT_STATUS.APPROVED;
    }

    if (['refunded', 'charged_back'].includes(normalized)) {
      return PAYMENT_STATUS.REFUNDED;
    }

    if (['rejected', 'cancelled'].includes(normalized)) {
      return PAYMENT_STATUS.REJECTED;
    }

    return PAYMENT_STATUS.PENDING;
  }

  private normalizePaymentStatus(status: string) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'paid') return PAYMENT_STATUS.APPROVED;
    if (normalized === 'failed') return PAYMENT_STATUS.REJECTED;
    return normalized;
  }

  private getMercadoPagoAccessToken() {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      throw new InternalServerErrorException('MERCADOPAGO_ACCESS_TOKEN no configurado');
    }
    return token;
  }

  private getFrontendBaseUrl() {
    return (process.env.CORS_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  private getManualPaymentConfig() {
    const methodLabel = 'Mercado Pago';
    const beneficiary = null;
    const reference = process.env.MANUAL_PAYMENT_REFERENCE ?? 'VIAJA SEGURO';
    const businessAccount = null;
    const instructions =
      [
        'Abre el link oficial de Mercado Pago desde VIAJA SEGURO.',
        'Ingresa el monto exacto que aparece en tu reserva.',
        `Referencia: ${reference}`,
        'Guarda tu comprobante y subelo para validacion manual del admin.'
      ].join('\n');

    return {
      methodLabel,
      beneficiary,
      reference,
      businessAccount,
      instructions,
      processorLabel: process.env.MANUAL_PAYMENT_PROCESSOR_LABEL ?? 'Mercado Pago'
    };
  }

  private assertCheckoutAllowed(payment: PaymentRecord) {
    const normalizedStatus = this.normalizePaymentStatus(payment.status);
    if ([PAYMENT_STATUS.APPROVED, PAYMENT_STATUS.REFUNDED].includes(normalizedStatus as any)) {
      throw new ForbiddenException('El payment ya fue validado o reembolsado');
    }

    const reservationStatus = String(payment.reservation?.status ?? '').toLowerCase();
    if ([RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.REFUNDED, RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.COMPLETED].includes(reservationStatus as any)) {
      throw new ForbiddenException('La reserva ya no admite checkout');
    }
  }

  private async callMercadoPagoApi(
    path: string,
    options: {
      method: 'GET' | 'POST';
      accessToken: string;
      body?: Record<string, unknown>;
      idempotencyKey?: string;
    }
  ) {
    const url = `https://api.mercadopago.com${path}`;

    const response = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': options.idempotencyKey ?? randomUUID()
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.message || data?.error || 'Error al conectar con Mercado Pago';
      throw new BadGatewayException(message);
    }

    return data;
  }

  private getHeaderValue(headers: Record<string, string | string[] | undefined>, key: string) {
    const direct = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
    if (Array.isArray(direct)) {
      return direct[0];
    }
    return direct;
  }

  private resolvePaymentCheckoutUrl(payment: Pick<PaymentRecord, 'checkoutUrl' | 'initPoint' | 'sandboxInitPoint'>) {
    if (payment.checkoutUrl) {
      return payment.checkoutUrl;
    }

    const sandboxMode = process.env.MERCADOPAGO_USE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    if (sandboxMode && payment.sandboxInitPoint) {
      return payment.sandboxInitPoint;
    }

    return payment.initPoint ?? payment.sandboxInitPoint ?? null;
  }
  private async assertSimulationPermission(userId: string, role: string, payment: PaymentRecord) {
    if (role === 'admin') {
      return;
    }

    const devBypass = process.env.ALLOW_DEV_PAYMENT_SIMULATION === 'true' && process.env.NODE_ENV !== 'production';

    if (devBypass && role === 'passenger' && payment.reservation?.passengerUserId === userId) {
      return;
    }

    throw new ForbiddenException('Simulacion de pagos disponible para admin o bypass local de desarrollo');
  }

  private async findPaymentByIdOrThrow(paymentId: string) {
    const payment = (await this.paymentDelegate().findUnique({
      where: { id: paymentId },
      include: this.adminPaymentInclude()
    })) as PaymentRecord | null;

    if (!payment) {
      throw new NotFoundException('Payment no encontrado');
    }

    return payment;
  }

  private async findPaymentByReservationOrThrow(reservationId: string) {
    const payment = (await this.paymentDelegate().findUnique({
      where: { reservationId },
      include: {
        ...this.basePaymentInclude(),
        refund: true
      }
    })) as PaymentRecord | null;

    if (payment) {
      return payment;
    }

    const reservation = await this.reservationDelegate().findUnique({
      where: { id: reservationId },
      select: { weeklyReservationGroupId: true }
    });

    if (reservation?.weeklyReservationGroupId) {
      const groupPayment = (await this.paymentDelegate().findFirst({
        where: { weeklyReservationGroupId: reservation.weeklyReservationGroupId },
        include: {
          ...this.basePaymentInclude(),
          refund: true
        }
      })) as PaymentRecord | null;

      if (groupPayment) {
        return groupPayment;
      }
    }

    throw new NotFoundException('Payment no encontrado para la reservation');
  }

  private async findPaymentByReservationForCheckoutOrThrow(reservationId: string) {
    return this.findPaymentByReservationOrThrow(reservationId);
  }

  private adminPaymentInclude() {
    return {
      reviewedByAdmin: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      reservation: {
        include: {
          passenger: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          trip: {
            include: {
              route: true
            }
          }
        }
      }
    };
  }

  private basePaymentInclude() {
    return {
      reservation: {
        include: {
          passenger: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          trip: {
            include: {
              route: true
            }
          }
        }
      }
    };
  }


  private normalizeIds(ids: string[] | undefined) {
    return Array.from(new Set((ids ?? []).map((id) => String(id).trim()).filter(Boolean)));
  }

  private paymentDelegate() {
    return (this.prisma as unknown as { payment: any }).payment;
  }

  private reservationDelegate() {
    return (this.prisma as unknown as { reservation: any }).reservation;
  }

  private refundDelegate() {
    return (this.prisma as unknown as { refund: any }).refund;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private mapPayment(payment: PaymentRecord) {
    const config = this.getManualPaymentConfig();
    return {
      id: payment.id,
      reservationId: payment.reservationId,
      weeklyReservationGroupId: payment.weeklyReservationGroupId,
      amount: payment.amount,
      status: this.normalizePaymentStatus(payment.status),
      provider: payment.provider,
      providerReference: payment.providerReference,
      providerPreferenceId: payment.providerPreferenceId,
      checkoutUrl: this.resolvePaymentCheckoutUrl(payment),
      initPoint: payment.initPoint,
      sandboxInitPoint: payment.sandboxInitPoint,
      paymentLink: this.resolvePaymentCheckoutUrl(payment),
      paymentMethodLabel: payment.paymentMethodLabel ?? config.methodLabel,
      paymentBeneficiary: config.beneficiary,
      paymentReference: config.reference,
      paymentBusinessAccount: null,
      paymentProcessorLabel: config.processorLabel,
      paymentProcessingMessage: `El pago se realiza desde el link oficial de Mercado Pago y sera validado manualmente por el admin.`,
      paymentInstructions: payment.paymentInstructions ?? config.instructions,
      proofFileName: payment.proofFileName,
      proofFilePath: payment.proofFilePath,
      proofFileUrl: payment.proofFilePath,
      reviewedByAdminUserId: payment.reviewedByAdminUserId,
      reviewedAt: payment.reviewedAt,
      reviewNotes: payment.reviewNotes,
      archivedAt: payment.archivedAt,
      archivedByAdminUserId: payment.archivedByAdminUserId,
      appCommissionAmount: payment.appCommissionAmount,
      driverNetAmount: payment.driverNetAmount,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      reservation: payment.reservation
        ? {
            id: payment.reservation.id,
            publicId: payment.reservation.publicId ?? null,
            status: payment.reservation.status,
            totalAmount: payment.reservation.totalAmount,
            totalSeats: payment.reservation.totalSeats,
            passenger: payment.reservation.passenger ?? null,
            trip: payment.reservation.trip
              ? {
                  id: payment.reservation.trip.id,
                  publicId: payment.reservation.trip.publicId ?? null,
                  tripDate: payment.reservation.trip.tripDate,
                  departureTimeSnapshot: payment.reservation.trip.departureTimeSnapshot,
                  route: payment.reservation.trip.route
                    ? {
                        id: payment.reservation.trip.route.id,
                        publicId: payment.reservation.trip.route.publicId ?? null,
                        title: payment.reservation.trip.route.title,
                        origin: payment.reservation.trip.route.origin,
                        destination: payment.reservation.trip.route.destination
                      }
                    : null
                }
              : null
          }
        : null,
      reviewedByAdmin: payment.reviewedByAdmin ?? null
    };
  }
}
