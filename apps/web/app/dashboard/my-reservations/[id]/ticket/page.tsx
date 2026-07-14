'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

  if (loading) {
    return <p className="text-slate-700">Cargando pase...</p>;
  }

  if (!reservation) {
    return <p className="rounded-md bg-red-50 p-3 text-red-700">{error ?? 'Pase no disponible'}</p>;
  }

  const reservationStatusMeta = getReservationStatusMeta(reservation.status);
  const hasBoardingPass = reservation.boardingCodeEnabled && isAcceptedForBoarding(reservation.status);
  const vehiclePhotoUrl = buildApiAssetUrl(reservation.trip?.vehiclePhotoUrl);

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">VIAJASEGURO piensa en tu bolsillo y seguridad</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Pase de identidad para abordar</h1>
          <p className="text-sm text-slate-600">Identificate con el conductor y revisa fecha, vehiculo y punto de encuentro antes de abordar.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/my-payments" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mi plan
          </Link>
          <Link href="/dashboard/my-reservations" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Volver a mis solicitudes
          </Link>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
        <p className="font-bold">Aborda solo si conductor, vehiculo, placas y ruta coinciden.</p>
        <p className="mt-1">Coordina en puntos publicos y visibles. VIAJASEGURO facilita contacto entre miembros verificados; no cobra traslados.</p>
      </div>

      <article className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {reservation.trip?.route?.title || `${reservation.trip?.route?.origin || 'Ruta'} -> ${reservation.trip?.route?.destination || ''}`}
            </p>
            <p className="text-xs text-slate-500">Solicitud # {reservation.publicId ?? '-'}</p>
            <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Fecha exacta del viaje</p>
              <p className="mt-1 text-2xl font-black leading-tight text-slate-950">{formatFullTripDate(reservation.trip?.tripDate)} - {formatTimeLabel(reservation.trip?.departureTimeSnapshot)}</p>
              <p className="mt-2 text-xs font-semibold text-sky-900">Muestra esta pantalla al conductor para identificar tu solicitud del dia.</p>
            </div>
            <p className="mt-3">Punto de encuentro: {reservation.trip?.boardingReference ?? 'Lo confirma el conductor al aceptar'}</p>
            <p>Lugares solicitados: {reservation.totalSeats}</p>
            <p>Estimacion orientativa total: {formatCurrency(reservation.totalAmount)}</p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <span className={`rounded-full px-3 py-1 ${reservationStatusMeta.className}`}>Solicitud: {reservationStatusMeta.label}</span>
          </div>

          {!hasBoardingPass ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Pase pendiente</p>
              <p className="mt-2 text-sm">Tu pase de identidad se habilitara cuando el conductor acepte tu solicitud.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Listo para identificarte</p>
              <p className="mt-2 text-lg font-black text-slate-950">Di tu nombre y confirma los lugares reservados.</p>
              <p className="mt-2 text-xs text-slate-700">El conductor marcara tu abordaje desde su lista de usuarios aceptados.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {vehiclePhotoUrl ? (
            <div className="w-full rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Vehiculo reportado</p>
              <img src={vehiclePhotoUrl} alt="Foto del vehiculo reportado" className="h-44 w-full rounded-lg border border-slate-200 object-cover" />
            </div>
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
              La foto del vehiculo aparecera cuando este disponible. Verifica placas y conductor antes de abordar.
            </div>
          )}
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            <p className="font-bold">Regla de seguridad</p>
            <p className="mt-1">No abordes si algun dato no coincide o si el punto no es publico y visible.</p>
          </div>
        </div>
      </article>
    </section>
  );
}