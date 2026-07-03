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
import { UsersService } from '../users/users.service';
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

const SUBSCRIPTION_REFERENCE_PREFIX = 'viajaseguro:subscription';
const DEFAULT_SUBSCRIPTION_DAYS = 30;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly usersService: UsersService) {}
  private throwTransportPaymentDisabled(): never {
    throw new ForbiddenException(
      'Los pagos por rutas compartidas estan desactivados. Mercado Pago se usa solo para membresias, verificaciones, suscripciones o servicios digitales de VIAJA SEGURO.'
    );
  }

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
      throw new ForbiddenException('Solo usuarios pueden ver pagos de membresia o servicios digitales');
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
    void userId;
    void reservationId;
    void file;
    this.throwTransportPaymentDisabled();
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

  async createSubscriptionMercadoPagoCheckout(userId: string, role: string, dto: { planType?: string } = {}) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const mappedRole = this.usersService.mapRole(role || user.role);
    if (mappedRole === 'admin') {
      throw new ForbiddenException('Admin no requiere checkout de suscripcion');
    }

    const plan = this.resolveSubscriptionCheckoutPlan(mappedRole, dto.planType);
    const accessToken = this.getMercadoPagoAccessToken();
    const frontendBaseUrl = this.getFrontendBaseUrl();
    const externalReference = this.buildSubscriptionExternalReference(user.id, plan.planType, plan.days);
    const notificationUrl = process.env.MERCADOPAGO_WEBHOOK_URL?.trim();

    const preference = await this.callMercadoPagoApi('/checkout/preferences', {
      method: 'POST',
      accessToken,
      idempotencyKey: `subscription-${user.id}-${plan.planType}-${Date.now()}`,
      body: {
        items: [
          {
            id: plan.planType,
            title: plan.title,
            description: 'Suscripcion digital VIAJASEGURO. No corresponde al pago de traslados.',
            category_id: 'services',
            quantity: 1,
            currency_id: 'MXN',
            unit_price: plan.amount
          }
        ],
        payer: {
          name: user.fullName,
          email: user.email
        },
        external_reference: externalReference,
        notification_url: notificationUrl || undefined,
        back_urls: {
          success: `${frontendBaseUrl}/dashboard/my-payments?subscription=success`,
          pending: `${frontendBaseUrl}/dashboard/my-payments?subscription=pending`,
          failure: `${frontendBaseUrl}/dashboard/my-payments?subscription=failure`
        },
        auto_return: 'approved',
        metadata: {
          payment_type: 'platform_subscription',
          user_id: user.id,
          role: mappedRole,
          plan_type: plan.planType,
          subscription_days: plan.days
        }
      }
    });

    const checkoutUrl = this.resolveMercadoPagoPreferenceUrl(preference);
    return {
      checkoutUrl,
      preferenceId: preference.id ?? null,
      initPoint: preference.init_point ?? null,
      sandboxInitPoint: preference.sandbox_init_point ?? null,
      externalReference,
      planType: plan.planType,
      amount: plan.amount,
      currency: 'MXN',
      subscriptionDays: plan.days,
      message: 'Mercado Pago solo activa una suscripcion digital de plataforma; no cobra rutas ni traslados.'
    };
  }
  async createMercadoPagoCheckout(userId: string, role: string, reservationId: string) {
    void userId;
    void role;
    void reservationId;
    this.throwTransportPaymentDisabled();
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

    const subscriptionReference = this.parseSubscriptionExternalReference(localPaymentId);
    if (subscriptionReference) {
      return this.processSubscriptionMercadoPagoPayment(subscriptionReference, mpPayment, dataId);
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
    void userId;
    void role;
    void reservationId;
    void dto;
    this.throwTransportPaymentDisabled();
  }
  async simulateFail(userId: string, role: string, reservationId: string) {
    void userId;
    void role;
    void reservationId;
    this.throwTransportPaymentDisabled();
  }
  async simulateRefund(userId: string, role: string, reservationId: string) {
    void userId;
    void role;
    void reservationId;
    this.throwTransportPaymentDisabled();
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

  private resolveSubscriptionCheckoutPlan(role: 'passenger' | 'driver' | 'admin', requestedPlanType?: string) {
    const defaultPlanType = role === 'driver' ? 'driver_monthly' : 'user_monthly';
    const planType = this.normalizeSubscriptionPlanType(requestedPlanType || defaultPlanType, role);
    const amount = this.getRequiredPositiveMoneyEnv('MERCADOPAGO_SUBSCRIPTION_AMOUNT');
    const days = this.getPositiveIntegerEnv('MERCADOPAGO_SUBSCRIPTION_DAYS', DEFAULT_SUBSCRIPTION_DAYS);
    const title = planType === 'driver_monthly' ? 'Plan conductor VIAJASEGURO' : 'Membresia usuario VIAJASEGURO';

    return { planType, amount, days, title };
  }

  private normalizeSubscriptionPlanType(planType: string, role: 'passenger' | 'driver' | 'admin') {
    const normalized = String(planType || '').trim().toLowerCase();
    const passengerPlans = new Set(['user_monthly', 'passenger_basic_monthly', 'passenger_premium_monthly']);
    const driverPlans = new Set(['driver_monthly']);

    if (role === 'driver') {
      return driverPlans.has(normalized) ? normalized : 'driver_monthly';
    }

    return passengerPlans.has(normalized) ? normalized : 'user_monthly';
  }

  private buildSubscriptionExternalReference(userId: string, planType: string, days: number) {
    return `${SUBSCRIPTION_REFERENCE_PREFIX}:${userId}:${planType}:${days}`;
  }

  private parseSubscriptionExternalReference(reference: string) {
    const parts = String(reference || '').split(':');
    if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== SUBSCRIPTION_REFERENCE_PREFIX) {
      return null;
    }

    const days = Number.parseInt(parts[4] ?? '', 10);
    if (!parts[2] || !parts[3] || !Number.isFinite(days) || days <= 0) {
      return null;
    }

    return {
      userId: parts[2],
      planType: parts[3],
      days
    };
  }

  private async processSubscriptionMercadoPagoPayment(
    reference: { userId: string; planType: string; days: number },
    mpPayment: any,
    dataId: string
  ) {
    const mappedStatus = this.mapMercadoPagoStatus(String(mpPayment.status ?? 'pending'));
    const mpPaymentId = String(mpPayment.id ?? dataId);

    if (mappedStatus !== PAYMENT_STATUS.APPROVED) {
      return {
        received: true,
        ignored: false,
        subscription: true,
        activated: false,
        userId: reference.userId,
        planType: reference.planType,
        mappedStatus,
        mpStatus: mpPayment.status ?? null,
        mpPaymentId,
        message: 'El pago de suscripcion aun no esta aprobado; no se activo acceso.'
      };
    }

    const user = await this.usersService.activateSubscriptionFromProvider(reference.userId, {
      planType: reference.planType,
      days: reference.days,
      provider: PAYMENT_PROVIDER.MERCADOPAGO,
      providerReference: mpPaymentId,
      rawStatus: String(mpPayment.status ?? 'approved')
    });

    return {
      received: true,
      ignored: false,
      subscription: true,
      activated: true,
      userId: reference.userId,
      planType: reference.planType,
      subscriptionExpiresAt: user.subscription?.subscriptionExpiresAt ?? null,
      mappedStatus,
      mpStatus: mpPayment.status ?? null,
      mpPaymentId
    };
  }

  private getRequiredPositiveMoneyEnv(key: string) {
    const raw = process.env[key];
    const value = Number.parseFloat(String(raw ?? ''));
    if (!Number.isFinite(value) || value <= 0) {
      throw new InternalServerErrorException(`${key} debe configurarse con un monto mayor a 0 para checkout automatico de suscripcion`);
    }

    return Math.round(value * 100) / 100;
  }

  private getPositiveIntegerEnv(key: string, fallback: number) {
    const value = Number.parseInt(String(process.env[key] ?? ''), 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private resolveMercadoPagoPreferenceUrl(preference: any) {
    const sandboxMode = process.env.MERCADOPAGO_USE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    if (sandboxMode && preference.sandbox_init_point) {
      return preference.sandbox_init_point;
    }

    return preference.init_point ?? preference.sandbox_init_point ?? null;
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
    const configured = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
    return String(configured).split(',')[0].trim().replace(/\/$/, '');
  }
  private getManualPaymentConfig() {
    const methodLabel = 'Mercado Pago';
    const beneficiary = null;
    const reference = process.env.MANUAL_PAYMENT_REFERENCE ?? 'VIAJA SEGURO';
    const businessAccount = null;
    const instructions =
      [
        'Abre el link oficial de Mercado Pago desde VIAJA SEGURO solo para membresias, verificaciones o servicios digitales.',
        'No realices pagos de traslado dentro de la plataforma.',
        `Referencia: ${reference}`,
        'VIAJA SEGURO no fija tarifas de transporte ni realiza pagos a conductores.'
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
      paymentProcessingMessage: `Los pagos a VIAJA SEGURO corresponden solo a membresias, verificaciones o servicios digitales; no a traslados.`,
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
