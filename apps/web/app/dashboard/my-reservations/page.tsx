'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { SafetyActionsPanel } from '@/components/safety-actions-panel';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { formatCurrency } from '@/lib/app-config';
import { getPaymentFlowMessage, PAYMENT_RETENTION_NOTICE } from '@/lib/payment-ui';
import { MERCADO_PAGO_PAYMENT_REFERENCE, getMercadoPagoPaymentUrl, Payment } from '@/lib/payments';
import { Reservation, ReservationPayment } from '@/lib/reservations';
import { getPaymentStatusMeta, getReservationStatusMeta, getTripStatusMeta } from '@/lib/status';

const HISTORY_RESERVATION_STATUSES = new Set(['cancelled', 'cancelled_by_user', 'cancelled_by_driver', 'rejected', 'no_show', 'refunded', 'completed']);
const HISTORY_TRIP_STATUSES = new Set(['finished', 'cancelled']);

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatFullTripDate(value?: string | null) {
  if (!value) return 'Fecha pendiente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha pendiente';
  return capitalize(new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date));
}

function formatTimeLabel(value?: string | null) {
  if (!value) return 'Horario pendiente';
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number.parseInt(hourRaw ?? '', 10);
  const minute = Number.parseInt(minuteRaw ?? '', 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const date = new Date(Date.UTC(2026, 0, 1, hour, minute, 0));
  return new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
    .format(date)
    .replace(' a.m.', ' AM')
    .replace(' p.m.', ' PM');
}

function formatPaseHeader(reservation: Reservation) {
  return `${formatFullTripDate(reservation.trip?.tripDate)} - ${formatTimeLabel(reservation.trip?.departureTimeSnapshot)}`;
}

function isHistoryReservation(reservation: Reservation) {
  return HISTORY_RESERVATION_STATUSES.has(reservation.status) || HISTORY_TRIP_STATUSES.has(String(reservation.trip?.status ?? '').toLowerCase());
}

function paymentForReservation(_reservation: Reservation, _groupPayment: ReservationPayment | null): ReservationPayment | null {
  return null;
}

function getPaseStatusLabel(reservation: Reservation, _groupPayment: ReservationPayment | null) {
  if (reservation.status === 'boarded') return { label: 'Usado / abordado', className: 'bg-indigo-100 text-indigo-800' };
  if (reservation.status === 'completed' || reservation.trip?.status === 'finished') return { label: 'Terminado / archivado', className: 'bg-slate-200 text-slate-700' };
  if (reservation.status === 'cancelled' || reservation.status === 'cancelled_by_user' || reservation.status === 'cancelled_by_driver' || reservation.trip?.status === 'cancelled') return { label: 'Cancelado', className: 'bg-red-100 text-red-800' };
  if (reservation.status === 'rejected') return { label: 'Solicitud rechazada', className: 'bg-red-100 text-red-800' };
  if (reservation.boardingCodeEnabled || reservation.status === 'accepted' || reservation.status === 'paid') return { label: 'Pase disponible', className: 'bg-emerald-100 text-emerald-800' };
  if (reservation.status === 'pending' || reservation.status === 'confirmed') return { label: 'Solicitud pendiente', className: 'bg-amber-100 text-amber-800' };
  return { label: 'En revision', className: 'bg-amber-100 text-amber-800' };
}

function groupReservations(reservations: Reservation[]) {
  const buckets = new Map<string, Reservation[]>();
  for (const reservation of reservations) {
    const key = reservation.weeklyReservationGroupId ?? reservation.id;
    buckets.set(key, [...(buckets.get(key) ?? []), reservation]);
  }

  return Array.from(buckets.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => new Date(a.trip?.tripDate ?? a.createdAt).getTime() - new Date(b.trip?.tripDate ?? b.createdAt).getTime());
    const groupPayment = sorted.find((item) => item.payment)?.payment ?? null;
    return {
      key,
      reservations: sorted,
      groupPayment,
      isWeekly: sorted.length > 1,
      firstTripDate: sorted[0]?.trip?.tripDate ?? sorted[0]?.createdAt ?? ''
    };
  }).sort((a, b) => new Date(a.firstTripDate).getTime() - new Date(b.firstTripDate).getTime());
}

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);
  const groups = useMemo(() => groupReservations(reservations), [reservations]);
  const activeGroups = groups
    .map((group) => ({ ...group, reservations: group.reservations.filter((reservation) => !isHistoryReservation(reservation)) }))
    .filter((group) => group.reservations.length > 0);
  const historyGroups = groups
    .map((group) => ({ ...group, reservations: group.reservations.filter(isHistoryReservation) }))
    .filter((group) => group.reservations.length > 0);

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
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar tus solicitudes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReservations();
  }, []);

  function payWithMercadoPago(payment: ReservationPayment | null) {
    if (!payment) {
      setError('Los pagos de traslado estan desactivados para rutas compartidas.');
      return;
    }

    setBusyReservationId(payment.reservationId);
    setError(null);
    setSuccess(null);

    try {
      window.open(getMercadoPagoPaymentUrl(payment), '_blank', 'noopener,noreferrer');
      setSuccess(`Se abrio Mercado Pago para un servicio de plataforma. Usa la referencia: ${MERCADO_PAGO_PAYMENT_REFERENCE}.`);
    } catch {
      setError('No se pudo abrir Mercado Pago. Intenta nuevamente.');
    } finally {
      setBusyReservationId(null);
    }
  }

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
      setSuccess('Solicitud cancelada correctamente.');
      await loadReservations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cancelar la solicitud');
    } finally {
      setBusyReservationId(null);
    }
  }

  async function uploadProof(reservationId: string, file: File | null) {
    const token = getToken();
    if (!token || !file) {
      setError('Debes seleccionar un registro.');
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
      setSuccess('Registro enviado correctamente. Quedo pendiente de validacion admin.');
      await loadReservations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo subir el registro');
    } finally {
      setBusyReservationId(null);
    }
  }

  function renderPaseCard(reservation: Reservation, groupPayment: ReservationPayment | null, isWeekly: boolean) {
    const reservationStatusMeta = getReservationStatusMeta(reservation.status);
    const tripStatusMeta = getTripStatusMeta(reservation.trip?.status);
    const paseStatus = getPaseStatusLabel(reservation, groupPayment);
    const payment = paymentForReservation(reservation, groupPayment);
    const vehiclePhotoUrl = buildApiAssetUrl(reservation.trip?.vehiclePhotoUrl);
    const canShowCode = reservation.boardingCodeEnabled && Boolean(reservation.numericCode);
    const isBusy = busyReservationId === reservation.id || busyReservationId === payment?.reservationId;

    return (
      <article key={reservation.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Pase por dia</p>
            <h3 className="mt-1 text-xl font-black leading-tight text-slate-950">{formatPaseHeader(reservation)}</h3>
            <p className="mt-1 text-sm text-slate-600">Solicitud # {reservation.publicId ?? '-'}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${paseStatus.className}`}>{paseStatus.label}</span>
        </div>

        <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <p>Ruta: <span className="font-semibold text-slate-950">{reservation.trip?.route?.title || `${reservation.trip?.route?.origin || 'Ruta'} -> ${reservation.trip?.route?.destination || ''}`}</span></p>
          <p>Horario: <span className="font-semibold text-slate-950">{formatTimeLabel(reservation.trip?.departureTimeSnapshot)}</span></p>
          <p>Referencia: <span className="font-semibold text-slate-950">{reservation.trip?.boardingReference ?? 'Se muestra cuando el conductor acepte tu solicitud'}</span></p>
          <p>Lugares: <span className="font-semibold text-slate-950">{reservation.totalSeats}</span></p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          <span className={`rounded-full px-3 py-1 ${reservationStatusMeta.className}`}>Solicitud: {reservationStatusMeta.label}</span>
          <span className={`rounded-full px-3 py-1 ${tripStatusMeta.className}`}>Ruta: {tripStatusMeta.label}</span>
        </div>

        {reservation.trip?.status === 'started' && (
          <div className="mt-3 space-y-3">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              Ruta en curso. Revisa la fecha antes de compartir tu codigo de pase.
            </p>
            <SafetyActionsPanel
              role="passenger"
              tripId={reservation.tripId}
              reservationId={reservation.id}
              routeId={reservation.trip?.route?.id}
              contextLabel={reservation.trip?.route?.title ?? 'Solicitud en curso'}
              compact
            />
          </div>
        )}

        {canShowCode ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Codigo de pase para este dia</p>
            <p className="mt-2 text-4xl font-black tracking-[0.32em] text-slate-950">{reservation.numericCode}</p>
            <p className="mt-2 text-xs font-semibold text-emerald-900">Muestra este codigo solo el dia de la ruta y solo cuando verifiques conductor, vehiculo y placas.</p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Tu codigo aparecera cuando el conductor acepte tu solicitud.
          </p>
        )}

        {vehiclePhotoUrl && canShowCode && (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-700">Vehiculo asignado</p>
            <img src={vehiclePhotoUrl} alt="Foto del vehiculo" className="mt-1 h-28 w-full rounded-md object-cover" />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/dashboard/my-reservations/${reservation.id}/pase`} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            Ver pase
          </Link>
          <Link href={`/dashboard/chat/${reservation.id}`} className="rounded-md border border-cyan-300 px-3 py-2 text-sm text-cyan-700">
            Coordinar con conductor
          </Link>
          {!isWeekly && (['pending', 'accepted', 'confirmed', 'paid'].includes(reservation.status)) && !isHistoryReservation(reservation) && (
            <button type="button" disabled={isBusy} onClick={() => cancelReservation(reservation.id)} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">
              {isBusy ? 'Cancelando...' : 'Cancelar solicitud'}
            </button>
          )}
        </div>
      </article>
    );
  }

  function renderGroup(group: ReturnType<typeof groupReservations>[number], history = false) {
    const payment = group.groupPayment?.provider === 'platform_membership' ? group.groupPayment : null;
    const paymentStatusMeta = getPaymentStatusMeta(payment?.status);
    const canUploadProof = payment && ['pending', 'rejected'].includes(payment.status);
    const canPayOnline = payment && ['pending', 'submitted', 'rejected'].includes(payment.status);
    const proofUrl = buildApiAssetUrl(payment?.proofFileUrl);
    const isBusy = busyReservationId === payment?.reservationId;

    return (
      <section key={group.key} className={`rounded-2xl border p-4 shadow-sm ${history ? 'border-slate-200 bg-slate-50' : 'border-sky-200 bg-sky-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{group.isWeekly ? 'Solicitud semanal' : 'Solicitud individual'}</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">
              {group.isWeekly ? `${group.reservations.length} pases separados por dia` : 'Pase de ruta'}
            </h2>
            <p className="mt-1 text-sm text-slate-700">Tus pases apareceran separados por dia. El dia de la ruta muestra al conductor el codigo correspondiente a esa fecha.</p>
          </div>
          {payment && <span className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatusMeta.className}`}>Pago: {paymentStatusMeta.label}</span>}
        </div>

        {payment && !history && (
          <div className="mt-4 rounded-xl border border-white bg-white p-4 text-sm text-slate-700 shadow-sm">
            <p className="font-bold text-slate-950">Pago de plataforma</p>
            <p className="mt-1">Monto total: <span className="font-semibold text-slate-950">{formatCurrency(payment.amount)}</span></p>
            <p>Referencia: <span className="font-semibold text-slate-950">{MERCADO_PAGO_PAYMENT_REFERENCE}</span></p>
            <p className="mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">{getPaymentFlowMessage(payment.status)}</p>
            <p className="mt-2 rounded-md bg-brand-50 p-3 text-xs text-brand-800">{PAYMENT_RETENTION_NOTICE}</p>
            {proofUrl && <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-600 underline">Ver registro enviado</a>}
            <div className="mt-3 flex flex-wrap gap-2">
              {canPayOnline && (
                <button type="button" onClick={() => payWithMercadoPago(payment)} disabled={isBusy} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {isBusy ? 'Preparando pago...' : 'Pagar membresia/servicio'}
                </button>
              )}
              {canUploadProof && (
                <label className="cursor-pointer rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-700">
                  {isBusy ? 'Enviando...' : payment.status === 'rejected' ? 'Reenviar registro' : 'Subir registro'}
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
          </div>
        )}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {group.reservations.map((reservation) => renderPaseCard(reservation, payment, group.isWeekly))}
        </div>
      </section>
    );
  }

  if (loading) {
    return <p className="text-slate-700">Cargando solicitudes...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mis solicitudes y pases</h1>
          <p className="text-sm text-slate-600">Revisa la fecha antes de compartir tu codigo de pase.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/my-payments" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Membresia
          </Link>
          <Link href="/dashboard/search-trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Buscar rutas
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm">
        <p className="font-bold">Tus pases apareceran separados por dia.</p>
        <p className="mt-1">El dia de la ruta muestra al conductor el codigo correspondiente a esa fecha. No compartas tu codigo antes de verificar conductor, vehiculo y placas.</p>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      {reservations.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no tienes solicitudes.</p>
      ) : (
        <>
          <div className="space-y-4">
            {activeGroups.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">No tienes solicitudes activas o pendientes.</p>
            ) : (
              activeGroups.map((group) => renderGroup(group))
            )}
          </div>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Historial</p>
              <h2 className="text-lg font-semibold text-slate-950">Rutas terminadas o archivadas</h2>
              <p className="text-sm text-slate-600">Estos pases ya no saturan tu vista principal.</p>
            </div>
            {historyGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Aun no hay rutas en historial.</p>
            ) : (
              <div className="space-y-4">{historyGroups.map((group) => renderGroup(group, true))}</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
