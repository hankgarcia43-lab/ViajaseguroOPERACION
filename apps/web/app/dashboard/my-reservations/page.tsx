'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { APP_COMPANY_NAME, formatCurrency, formatShortDate } from '@/lib/app-config';
import { getPaymentFlowMessage, PAYMENT_RETENTION_NOTICE } from '@/lib/payment-ui';
import { Payment } from '@/lib/payments';
import { Reservation } from '@/lib/reservations';
import { getPaymentStatusMeta, getReservationStatusMeta } from '@/lib/status';

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);

  async function loadReservations() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<Reservation[]>('/reservations/my-reservations', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setReservations(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar tus reservas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReservations();
  }, []);

  async function cancelReservation(reservationId: string) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyReservationId(reservationId);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/reservations/${reservationId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setSuccess('Reserva cancelada correctamente.');
      await loadReservations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cancelar la reserva');
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
      setSuccess('Comprobante enviado correctamente. Quedo pendiente de validacion admin.');
      await loadReservations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo subir el comprobante');
    } finally {
      setBusyReservationId(null);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando reservas...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Mis reservas</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/my-payments" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mis pagos
          </Link>
          <Link href="/dashboard/search-trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Buscar viajes
          </Link>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      {reservations.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no tienes reservas.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reservations.map((reservation) => {
            const reservationStatusMeta = getReservationStatusMeta(reservation.status);
            const paymentStatusMeta = getPaymentStatusMeta(reservation.payment?.status);
            const isBusy = busyReservationId === reservation.id;
            const canUploadProof = reservation.payment && ['pending', 'rejected'].includes(reservation.payment.status);
            const vehiclePhotoUrl = buildApiAssetUrl(reservation.trip?.vehiclePhotoUrl);

            return (
              <article key={reservation.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  {reservation.trip?.route?.title || `${reservation.trip?.route?.origin || 'Ruta'} -> ${reservation.trip?.route?.destination || ''}`}
                </h2>
                <p className="text-xs text-slate-500">Reserva # {reservation.publicId ?? '-'}</p>
                <p className="text-sm text-slate-700">Fecha: {reservation.trip ? formatShortDate(reservation.trip.tripDate) : '-'}</p>
                <p className="text-sm text-slate-700">Referencia de abordaje: {reservation.trip?.boardingReference ?? 'Pendiente de publicacion del viaje'}</p>
                <p className="text-sm text-slate-700">Asientos: {reservation.totalSeats}</p>
                <p className="text-sm text-slate-700">Total reserva: {formatCurrency(reservation.totalAmount)}</p>
                <p className="mt-2 text-sm text-slate-700">
                  Estado reserva:{' '}
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${reservationStatusMeta.className}`}>{reservationStatusMeta.label}</span>
                </p>
                {reservation.trip?.status === 'started' && (
                  <p className="mt-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
                    El conductor ya inicio el viaje y te esta esperando en la zona de abordaje indicada.
                  </p>
                )}

                {reservation.payment && (
                  <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Pago del negocio</p>
                    <p>
                      Estado pago:{' '}
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${paymentStatusMeta.className}`}>{paymentStatusMeta.label}</span>
                    </p>
                    <p>Monto: {formatCurrency(reservation.payment.amount)}</p>
                    <p>Beneficiario comercial: {reservation.payment.paymentBeneficiary ?? APP_COMPANY_NAME}</p>
                    <p>Procesador o plataforma: {reservation.payment.paymentProcessorLabel ?? APP_COMPANY_NAME}</p>
                    <p>Metodo o banco: {reservation.payment.paymentMethodLabel ?? 'Transferencia bancaria empresarial'}</p>
                    {reservation.payment.paymentBusinessAccount && <p>Cuenta o CLABE del negocio: {reservation.payment.paymentBusinessAccount}</p>}
                    <p>Referencia: {reservation.payment.paymentReference ?? 'VS-RESERVA'}</p>
                    {reservation.payment.paymentProcessingMessage && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{reservation.payment.paymentProcessingMessage}</p>}
                    <p className="whitespace-pre-line text-xs text-slate-600">{reservation.payment.paymentInstructions}</p>
                    <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">{getPaymentFlowMessage(reservation.payment.status)}</p>
                    <p className="rounded-md bg-brand-50 p-3 text-xs text-brand-800">{PAYMENT_RETENTION_NOTICE}</p>
                  </div>
                )}

                {vehiclePhotoUrl && reservation.payment?.status === 'approved' && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-slate-700">Vehiculo asignado</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vehiclePhotoUrl} alt="Foto del vehiculo" className="mt-1 h-32 w-full rounded-md object-cover" />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/dashboard/my-reservations/${reservation.id}/ticket`} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Ver comprobante
                  </Link>
                  <Link href={`/dashboard/chat/${reservation.id}`} className="rounded-md border border-cyan-300 px-3 py-2 text-sm text-cyan-700">
                    Chat con conductor
                  </Link>

                  {canUploadProof && (
                    <label className="cursor-pointer rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-700">
                      {isBusy ? 'Enviando...' : reservation.payment?.status === 'rejected' ? 'Reenviar comprobante' : 'Subir comprobante'}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        disabled={isBusy}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          void uploadProof(reservation.id, event.target.files?.[0] ?? null);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  )}

                  {(reservation.status === 'confirmed' || reservation.status === 'paid') && (
                    <button type="button" disabled={isBusy} onClick={() => cancelReservation(reservation.id)} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">
                      {isBusy ? 'Cancelando...' : 'Cancelar reserva'}
                    </button>
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
