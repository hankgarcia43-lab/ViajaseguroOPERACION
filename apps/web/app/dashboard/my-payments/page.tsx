'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { APP_COMPANY_NAME, formatCurrency, formatShortDate } from '@/lib/app-config';
import { getPaymentFlowMessage, PAYMENT_RETENTION_NOTICE } from '@/lib/payment-ui';
import { MERCADO_PAGO_DIRECT_PAYMENT_LINK, MERCADO_PAGO_PAYMENT_REFERENCE, getMercadoPagoPaymentUrl, Payment } from '@/lib/payments';
import { getPaymentStatusMeta, getReservationStatusMeta } from '@/lib/status';

export default function MyPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);

  async function loadPayments() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<Payment[]>('/payments/my-payments', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setPayments(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los pagos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, []);

  function payWithMercadoPago(payment: Payment) {
    setError(null);
    setSuccess(null);
    setBusyReservationId(payment.reservationId);

    try {
      window.open(getMercadoPagoPaymentUrl(payment), '_blank', 'noopener,noreferrer');
      setSuccess(`Se abrio Mercado Pago. Ingresa el monto exacto, conserva tu comprobante y regresa a la app para subirlo. Referencia: ${MERCADO_PAGO_PAYMENT_REFERENCE}.`);
    } catch {
      setError('No se pudo abrir Mercado Pago. Intenta nuevamente.');
    } finally {
      setBusyReservationId(null);
    }
  }

  async function uploadProof(reservationId: string, file: File | null) {
    const token = getToken();
    if (!token || !file) {
      setError('Debes seleccionar un comprobante.');
      return;
    }

    setBusyReservationId(reservationId);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiRequest<Payment>(`/payments/${reservationId}/upload-proof`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      setSuccess('Comprobante enviado correctamente.');
      await loadPayments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo subir el comprobante');
    } finally {
      setBusyReservationId(null);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando pagos...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Mis pagos</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/my-reservations" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mis reservas
          </Link>
          <Link href="/dashboard/search-trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Buscar viajes
          </Link>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <article className="rounded-3xl border border-sky-200 bg-sky-50 p-5 text-slate-900 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Link oficial de pago</p>
        <p className="mt-2 text-lg font-semibold">Mercado Pago Viaja Seguro</p>
        <p className="mt-1 text-sm text-slate-600">Usalo cuando ya tengas una reserva y la app te muestre el monto exacto.</p>
        <p className="mt-1 text-sm text-slate-600">Referencia para el pago: <span className="font-semibold text-slate-900">{MERCADO_PAGO_PAYMENT_REFERENCE}</span></p>
        <a href={MERCADO_PAGO_DIRECT_PAYMENT_LINK} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-3xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-sky-600">
          Abrir Mercado Pago
        </a>
      </article>

      {payments.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no tienes pagos asociados.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {payments.map((payment) => {
            const paymentStatusMeta = getPaymentStatusMeta(payment.status);
            const reservationStatusMeta = getReservationStatusMeta(payment.reservation?.status);
            const isBusy = busyReservationId === payment.reservationId;
            const canUploadProof = ['pending', 'rejected'].includes(payment.status);
            const canPayOnline = ['pending', 'submitted', 'rejected'].includes(payment.status);
            const proofUrl = buildApiAssetUrl(payment.proofFileUrl);

            return (
              <article key={payment.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  {payment.reservation?.trip?.route?.title || `${payment.reservation?.trip?.route?.origin || 'Ruta'} -> ${payment.reservation?.trip?.route?.destination || ''}`}
                </h2>
                <p className="text-sm text-slate-700">Fecha: {payment.reservation?.trip ? formatShortDate(payment.reservation.trip.tripDate) : '-'}</p>
                <p className="text-sm text-slate-700">Monto: {formatCurrency(payment.amount)}</p>
                <p className="text-sm text-slate-700">
                  Estado pago:{' '}
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${paymentStatusMeta.className}`}>{paymentStatusMeta.label}</span>
                </p>

                <div className="mt-4 space-y-4 rounded-3xl border border-sky-200 bg-sky-50 p-5 text-slate-900 shadow-sm">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Pagar con Mercado Pago</p>
                    <p className="text-lg font-semibold text-slate-900">Monto exacto: {formatCurrency(payment.amount)}</p>
                    <ol className="space-y-1 pl-5 text-sm text-slate-600">
                      <li className="list-decimal">Entra al link oficial de Mercado Pago desde el boton de abajo.</li>
                      <li className="list-decimal">Escribe exactamente {formatCurrency(payment.amount)} como monto a pagar.</li>
                      <li className="list-decimal">Realiza el pago y guarda tu comprobante o captura.</li>
                      <li className="list-decimal">Regresa a VIAJA SEGURO y sube el comprobante en este pago.</li>
                      <li className="list-decimal">Cuando el admin lo valide, abre tu ticket para confirmar tus boletos y codigo de abordaje.</li>
                    </ol>
                    <p className="text-sm text-slate-600">Tu pago sera validado manualmente.</p>
                    <p className="text-sm text-slate-600">Referencia: <span className="font-semibold text-slate-900">{MERCADO_PAGO_PAYMENT_REFERENCE}</span></p>
                  </div>
                  {canPayOnline ? (
                    <button
                      type="button"
                      onClick={() => payWithMercadoPago(payment)}
                      disabled={isBusy}
                      className="w-full rounded-3xl bg-sky-700 px-5 py-4 text-left text-sm font-semibold text-white shadow-lg transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? 'Abriendo Mercado Pago...' : 'Pagar con Mercado Pago'}
                    </button>
                  ) : (
                    <p className="rounded-2xl bg-white p-3 text-xs text-slate-700">Este pago ya no requiere un pago online.</p>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  <p>Beneficiario comercial: {payment.paymentBeneficiary ?? APP_COMPANY_NAME}</p>
                  <p>Procesador o plataforma: {payment.paymentProcessorLabel ?? APP_COMPANY_NAME}</p>
                  <p>Metodo o banco: {payment.paymentMethodLabel ?? 'Transferencia bancaria empresarial'}</p>
                  {payment.paymentBusinessAccount && <p>Cuenta o CLABE del negocio: {payment.paymentBusinessAccount}</p>}
                  <p>Referencia: {payment.paymentReference ?? 'VS-RESERVA'}</p>
                </div>

                {payment.paymentProcessingMessage && <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{payment.paymentProcessingMessage}</p>}
                <p className="mt-3 whitespace-pre-line text-xs text-slate-600">{payment.paymentInstructions}</p>
                <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{getPaymentFlowMessage(payment.status)}</p>
                <p className="mt-3 rounded-md bg-brand-50 p-3 text-xs text-brand-800">{PAYMENT_RETENTION_NOTICE}</p>
                <p className="mt-3 text-sm text-slate-700">
                  Estado reserva:{' '}
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${reservationStatusMeta.className}`}>{reservationStatusMeta.label}</span>
                </p>
                {payment.reviewNotes && <p className="text-sm text-slate-700">Revision admin: {payment.reviewNotes}</p>}
                {proofUrl && (
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-600 underline">
                    Ver comprobante enviado
                  </a>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/dashboard/my-reservations/${payment.reservationId}/ticket`} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Ver ticket
                  </Link>

                  {canUploadProof && (
                    <label className="cursor-pointer rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-700">
                      {isBusy ? 'Enviando...' : payment.status === 'rejected' ? 'Reenviar comprobante' : 'Subir comprobante manual'}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        disabled={isBusy}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          void uploadProof(payment.reservationId, event.target.files?.[0] ?? null);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}