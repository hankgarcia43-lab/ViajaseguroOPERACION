'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { formatCurrency } from '@/lib/app-config';
import { Reservation } from '@/lib/reservations';
import { getReservationStatusMeta } from '@/lib/status';

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

function isAcceptedForBoarding(status: string) {
  return ['accepted', 'boarded', 'completed', 'paid'].includes(status);
}

export default function ReservationTicketPage() {
  const params = useParams<{ id: string }>();
  const reservationId = params?.id;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTicket() {
    const token = getToken();
    if (!token || !reservationId) {
      setError('No hay sesion activa o solicitud invalida.');
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
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el pase');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTicket();
  }, [reservationId]);

  const qrImageUrl = useMemo(() => {
    if (!reservation?.qrValue) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(reservation.qrValue)}`;
  }, [reservation]);

  if (loading) {
    return <p className="text-slate-700">Cargando pase...</p>;
  }

  if (!reservation) {
    return <p className="rounded-md bg-red-50 p-3 text-red-700">{error ?? 'Pase no disponible'}</p>;
  }

  const reservationStatusMeta = getReservationStatusMeta(reservation.status);
  const hasBoardingCode = reservation.boardingCodeEnabled && Boolean(reservation.numericCode) && isAcceptedForBoarding(reservation.status);
  const vehiclePhotoUrl = buildApiAssetUrl(reservation.trip?.vehiclePhotoUrl);

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pase de ruta compartida</h1>
          <p className="text-sm text-slate-600">Revisa la fecha antes de compartir tu codigo con el conductor.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/my-payments" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Membresia
          </Link>
          <Link href="/dashboard/my-reservations" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Volver a mis solicitudes
          </Link>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
        <p className="font-bold">No compartas tu codigo antes de estar en el punto de encuentro.</p>
        <p className="mt-1">Por seguridad, coordina solo en puntos publicos y visibles. VIAJA SEGURO facilita el contacto entre miembros verificados.</p>
      </div>

      <article className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {reservation.trip?.route?.title || `${reservation.trip?.route?.origin || 'Ruta'} -> ${reservation.trip?.route?.destination || ''}`}
            </p>
            <p className="text-xs text-slate-500">Solicitud # {reservation.publicId ?? '-'}</p>
            <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Fecha exacta del pase</p>
              <p className="mt-1 text-2xl font-black leading-tight text-slate-950">{formatFullTripDate(reservation.trip?.tripDate)} - {formatTimeLabel(reservation.trip?.departureTimeSnapshot)}</p>
              <p className="mt-2 text-xs font-semibold text-sky-900">Muestra al conductor el codigo correspondiente a esta fecha.</p>
            </div>
            <p className="mt-3">Punto de encuentro: {reservation.trip?.boardingReference ?? 'Lo confirma el conductor al aceptar'}</p>
            <p>Lugares solicitados: {reservation.totalSeats}</p>
            <p>Estimacion orientativa total: {formatCurrency(reservation.totalAmount)}</p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <span className={`rounded-full px-3 py-1 ${reservationStatusMeta.className}`}>Solicitud: {reservationStatusMeta.label}</span>
          </div>

          {!hasBoardingCode ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Codigo de pase pendiente</p>
              <p className="mt-2 text-sm">Tu codigo aparecera cuando el conductor acepte tu solicitud.</p>
              <p className="mt-2 text-xs text-amber-800">
                VIAJA SEGURO no cobra rutas compartidas ni procesa pagos de traslado. La estimacion es solo una referencia para coordinacion entre miembros.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Codigo principal del pase</p>
              <p className="mt-2 text-4xl font-semibold tracking-[0.35em] text-slate-900">{reservation.numericCode}</p>
              <p className="mt-2 text-xs text-slate-600">
                Este codigo visible de 6 digitos corresponde solo a la fecha de este pase. El QR queda como respaldo operativo.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {hasBoardingCode && vehiclePhotoUrl && (
            <div className="w-full rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Vehiculo reportado</p>
              <img src={vehiclePhotoUrl} alt="Foto del vehiculo reportado" className="h-36 w-full rounded-lg border border-slate-200 object-cover" />
            </div>
          )}

          {hasBoardingCode && qrImageUrl ? (
            <>
              <img src={qrImageUrl} alt="QR del pase" className="h-[220px] w-[220px] rounded-lg border border-slate-200 bg-white" />
              <p className="text-center text-xs text-slate-500">
                El conductor debe preferir tu codigo numerico de 6 digitos. Usa este QR solo como respaldo operativo.
              </p>
            </>
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
              El QR de pase se habilitara cuando el conductor acepte esta solicitud.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
