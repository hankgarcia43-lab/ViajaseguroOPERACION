'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { formatCurrency, formatShortDate } from '@/lib/app-config';
import { getPaymentFlowMessage, PAYMENT_RETENTION_NOTICE } from '@/lib/payment-ui';
import { MERCADO_PAGO_PAYMENT_REFERENCE, getMercadoPagoPaymentUrl } from '@/lib/payments';
import { Reservation } from '@/lib/reservations';
import { getPaymentStatusMeta, getReservationStatusMeta } from '@/lib/status';

export default function ReservationTicketPage() {
  const params = useParams<{ id: string }>();
  const reservationId = params?.id;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  async function loadTicket() {
    const token = getToken();
    if (!token || !reservationId) {
      setError('No hay sesion activa o reserva invalida.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<Reservation>(`/reservations/${reservationId}/ticket`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setReservation(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el comprobante');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTicket();
  }, [reservationId]);

  async function uploadProof(file: File | null) {
    const token = getToken();
    if (!token || !reservationId || !file) {
      setError('Debes seleccionar un comprobante valido.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiRequest(`/payments/${reservationId}/upload-proof`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      setSuccess('Comprobante enviado correctamente. Quedo pendiente de revision admin.');
      await loadTicket();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo subir el comprobante');
    } finally {
      setUploading(false);
    }
  }

  function payWithMercadoPago() {
    if (!reservation?.payment) {
      setError('No hay sesion activa o pago disponible.');
      return;
    }

    setCheckoutBusy(true);
    setError(null);
    setSuccess(null);

    try {
      window.open(getMercadoPagoPaymentUrl(reservation.payment), '_blank', 'noopener,noreferrer');
      setSuccess(`Se abrio Mercado Pago. Ingresa el monto exacto y usa la referencia: ${MERCADO_PAGO_PAYMENT_REFERENCE}.`);
    } catch {
      setError('No se pudo abrir Mercado Pago. Intenta nuevamente.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  const qrImageUrl = useMemo(() => {
    if (!reservation?.qrValue) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(reservation.qrValue)}`;
  }, [reservation]);

  if (loading) {
    return <p className="text-slate-700">Cargando comprobante...</p>;
  }

  if (!reservation) {
    return <p className="rounded-md bg-red-50 p-3 text-red-700">{error ?? 'Comprobante no disponible'}</p>;
  }

  const reservationStatusMeta = getReservationStatusMeta(reservation.status);
  const paymentStatusMeta = getPaymentStatusMeta(reservation.payment?.status);
  const proofUrl = buildApiAssetUrl(reservation.payment?.proofFileUrl);
  const canUploadProof = reservation.payment && ['pending', 'rejected'].includes(reservation.payment.status);
  const hasBoardingCode = reservation.boardingCodeEnabled && reservation.payment?.status === 'approved';
  const vehiclePhotoUrl = buildApiAssetUrl(reservation.trip?.vehiclePhotoUrl);

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Comprobante de reserva</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/my-payments" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mis pagos
          </Link>
          <Link href="/dashboard/my-reservations" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Volver a mis reservas
          </Link>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <article className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {reservation.trip?.route?.title || `${reservation.trip?.route?.origin || 'Ruta'} -> ${reservation.trip?.route?.destination || ''}`}
            </p>
            <p className="text-xs text-slate-500">Reserva # {reservation.publicId ?? '-'}</p>
            <p className="mt-1">Fecha: {reservation.trip ? formatShortDate(reservation.trip.tripDate) : '-'}</p>
            <p>Hora de salida: {reservation.trip?.departureTimeSnapshot ?? '-'}</p>
            <p>Referencia de abordaje: {reservation.trip?.boardingReference ?? 'Se habilita al preparar el viaje'}</p>
            <p>Asientos: {reservation.totalSeats}</p>
            <p>Total reserva: {formatCurrency(reservation.totalAmount)}</p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <span className={`rounded-full px-3 py-1 ${reservationStatusMeta.className}`}>Reserva: {reservationStatusMeta.label}</span>
            {reservation.payment && <span className={`rounded-full px-3 py-1 ${paymentStatusMeta.className}`}>Pago: {paymentStatusMeta.label}</span>}
          </div>

          {!hasBoardingCode ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Codigo de abordaje bloqueado</p>
              <p className="mt-2 text-sm">{getPaymentFlowMessage(reservation.payment?.status)}</p>
              <p className="mt-2 text-xs text-amber-800">
                Tu pago aun no ha sido validado. El codigo de abordaje se habilitara cuando el admin confirme tu pago.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Codigo principal de abordaje</p>
              <p className="mt-2 text-4xl font-semibold tracking-[0.35em] text-slate-900">{reservation.numericCode}</p>
              <p className="mt-2 text-xs text-slate-600">
                Este codigo visible de 6 digitos es la via principal para validar tu abordaje. El QR queda como respaldo.
              </p>
            </div>
          )}

          {reservation.payment && (
            <div className="space-y-5 rounded-3xl border border-sky-200 bg-sky-50 p-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Pagar con Mercado Pago</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(reservation.payment.amount)}</p>
                  <p className="mt-3 text-sm text-slate-600">Ingresa exactamente este monto dentro de Mercado Pago.</p>
                  <p className="text-sm text-slate-600">Tu pago sera validado manualmente.</p>
                  <p className="text-sm text-slate-600">Referencia: <span className="font-semibold text-slate-900">{MERCADO_PAGO_PAYMENT_REFERENCE}</span></p>
                </div>

                {['pending', 'submitted', 'rejected'].includes(reservation.payment.status) ? (
                  <button
                    type="button"
                    onClick={() => payWithMercadoPago()}
                    disabled={checkoutBusy}
                    className="w-full rounded-3xl bg-sky-700 px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkoutBusy ? 'Abriendo Mercado Pago...' : 'Pagar con Mercado Pago'}
                  </button>
                ) : (
                  <p className="rounded-2xl bg-white p-3 text-xs text-slate-700">Este pago ya no requiere un pago online.</p>
                )}

                <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{getPaymentFlowMessage(reservation.payment.status)}</p>
                <p className="rounded-md bg-brand-50 p-3 text-xs text-brand-800">{PAYMENT_RETENTION_NOTICE}</p>

              {reservation.payment.reviewNotes && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Nota de revision admin: {reservation.payment.reviewNotes}</p>
              )}

              {proofUrl && (
                <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-brand-600 underline">
                  Ver comprobante enviado
                </a>
              )}

              {canUploadProof && (
                <label className="inline-flex cursor-pointer rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-700">
                  {uploading ? 'Enviando...' : reservation.payment.status === 'rejected' ? 'Reenviar comprobante' : 'Subir comprobante'}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void uploadProof(event.target.files?.[0] ?? null);
                      event.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {hasBoardingCode && vehiclePhotoUrl && (
            <div className="w-full rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Vehiculo asignado</p>
              <img src={vehiclePhotoUrl} alt="Foto del vehiculo asignado" className="h-36 w-full rounded-lg border border-slate-200 object-cover" />
            </div>
          )}

          {hasBoardingCode && qrImageUrl ? (
            <>
              <img src={qrImageUrl} alt="QR del comprobante" className="h-[220px] w-[220px] rounded-lg border border-slate-200 bg-white" />
              <p className="text-center text-xs text-slate-500">
                El conductor debe preferir tu codigo numerico de 6 digitos. Usa este QR solo como respaldo operativo.
              </p>
            </>
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
              El QR de abordaje se habilitara solo cuando el admin valide tu pago.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
