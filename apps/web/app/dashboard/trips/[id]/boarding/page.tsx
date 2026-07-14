'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SafetyActionsPanel } from '@/components/safety-actions-panel';
import { apiRequest, getToken } from '@/lib/api';
import { Reservation } from '@/lib/reservations';
import { getReservationStatusMeta, getTripStatusMeta } from '@/lib/status';
import { DriverTrip } from '@/lib/trips';

const BOARDING_TOLERANCE_MS = 10 * 60 * 1000;
const BOARDABLE_STATUSES = new Set(['accepted', 'paid']);
const CLOSED_RESERVATION_STATUSES = new Set(['rejected', 'cancelled', 'cancelled_by_user', 'cancelled_by_driver', 'refunded']);

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

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function canBoardReservation(reservation: Reservation) {
  return BOARDABLE_STATUSES.has(reservation.status);
}

export default function TripBoardingPage() {
  const params = useParams<{ id: string }>();
  const tripId = params?.id;

  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  async function loadData() {
    const token = getToken();
    if (!token || !tripId) {
      setError('No hay sesion activa o ruta invalida.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [tripData, reservationData] = await Promise.all([
        apiRequest<DriverTrip>(`/trips/${tripId}`, { headers }),
        apiRequest<Reservation[]>(`/reservations/driver/trip/${tripId}`, { headers })
      ]);
      setTrip(tripData);
      setReservations(reservationData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la ruta');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [tripId]);

  useEffect(() => {
    if (trip?.status !== 'started') return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [trip?.status]);

  async function updateReservationStatus(reservationId: string, action: 'board' | 'no-show') {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyReservationId(`${reservationId}:${action}`);
    setError(null);
    setSuccess(null);

    try {
      const updated = await apiRequest<Reservation>(`/reservations/${reservationId}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setReservations((current) => current.map((reservation) => (reservation.id === reservationId ? updated : reservation)));
      setSuccess(action === 'board' ? 'Usuario identificado y abordaje confirmado.' : 'Usuario marcado como no presentado. Puedes iniciar con quienes estan presentes.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar la solicitud.');
    } finally {
      setBusyReservationId(null);
    }
  }

  const canControlBoarding = trip?.status === 'started';
  const tripStartedAt = trip?.status === 'started' ? new Date(trip.updatedAt).getTime() : 0;
  const toleranceRemainingMs = tripStartedAt > 0 ? Math.max(0, tripStartedAt + BOARDING_TOLERANCE_MS - now) : BOARDING_TOLERANCE_MS;
  const toleranceExpired = canControlBoarding && toleranceRemainingMs === 0;
  const tripStatusMeta = getTripStatusMeta(trip?.status ?? 'scheduled');

  const visibleReservations = useMemo(
    () => reservations.filter((reservation) => !CLOSED_RESERVATION_STATUSES.has(reservation.status)),
    [reservations]
  );
  const boardedSeats = visibleReservations
    .filter((reservation) => reservation.status === 'boarded' || reservation.status === 'completed')
    .reduce((total, reservation) => total + reservation.totalSeats, 0);
  const pendingSeats = visibleReservations
    .filter(canBoardReservation)
    .reduce((total, reservation) => total + reservation.totalSeats, 0);

  if (loading) {
    return <p className="text-slate-700">Cargando control de abordaje...</p>;
  }

  if (!trip) {
    return <p className="rounded-md bg-red-50 p-3 text-red-700">{error ?? 'Ruta no disponible'}</p>;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">VIAJASEGURO piensa en tu bolsillo y seguridad</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Control de abordaje por identidad</h1>
          <p className="text-sm text-slate-600">Identifica al usuario, revisa fecha/lugares y confirma abordaje desde esta lista.</p>
        </div>
        <Link href="/dashboard/trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Volver a mis rutas</Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm">
          <p className="font-bold">Primero inicia la ruta, despues identifica usuarios.</p>
          <p className="mt-1">Confirma nombre, punto de encuentro y lugares reservados. No abordes usuarios que no aparecen en esta lista.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <p className="font-bold">Tolerancia operativa: 10 minutos.</p>
          <p className="mt-1">Si alguien no llega, al terminar el cronometro puedes salir con quienes estan presentes y marcar faltantes como no presentados.</p>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">{error}</p>}
      {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">{success}</p>}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{trip.route?.title || `${trip.route?.origin || 'Ruta'} -> ${trip.route?.destination || ''}`}</h2>
            <p className="text-xs text-slate-500">Ruta # {trip.publicId ?? '-'}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${tripStatusMeta.className}`}>{tripStatusMeta.label}</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Fecha</p>
            <p className="mt-1 font-black text-slate-950">{formatFullTripDate(trip.tripDate)}</p>
            <p className="text-sm text-slate-700">{formatTimeLabel(trip.departureTimeSnapshot)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Abordados</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{boardedSeats}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase text-amber-700">Pendientes</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{pendingSeats}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Lugares ruta</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{trip.availableSeatsSnapshot}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-700">Referencia de abordaje: {trip.boardingReference ?? 'Sin definir'}</p>
      </article>

      {!canControlBoarding ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <p className="text-base font-bold">Antes de confirmar abordajes debes iniciar la ruta.</p>
          <p className="mt-1 text-sm">Regresa a Mis rutas, presiona iniciar y vuelve a este control para identificar usuarios.</p>
          <Link href="/dashboard/trips" className="mt-3 inline-block rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white">
            Volver a Mis rutas
          </Link>
        </div>
      ) : (
        <div className={`rounded-xl border p-4 text-sm shadow-sm ${toleranceExpired ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-cyan-300 bg-cyan-50 text-cyan-950'}`}>
          <p className="font-bold">Cronometro de tolerancia para usuarios faltantes</p>
          <p className="mt-1 text-3xl font-black tracking-tight">{formatCountdown(toleranceRemainingMs)}</p>
          <p className="mt-1">{toleranceExpired ? 'Tolerancia cumplida. Puedes iniciar con quienes estan presentes y marcar faltantes.' : 'Espera este tiempo antes de marcar no presentado a un usuario aceptado.'}</p>
        </div>
      )}

      {canControlBoarding && (
        <SafetyActionsPanel
          role="driver"
          tripId={trip.id}
          routeId={trip.routeId}
          contextLabel={trip.route?.title ?? 'Control de abordaje'}
        />
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Usuarios del viaje</h2>
            <p className="text-sm text-slate-600">Identifica al usuario por nombre y confirma solo los lugares aceptados para esta fecha.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{visibleReservations.length} solicitud(es)</span>
        </div>

        {visibleReservations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Aun no hay usuarios aceptados o pendientes para esta ruta.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleReservations.map((reservation) => {
              const reservationStatusMeta = getReservationStatusMeta(reservation.status);
              const boardBusy = busyReservationId === `${reservation.id}:board`;
              const noShowBusy = busyReservationId === `${reservation.id}:no-show`;
              const canBoard = canControlBoarding && canBoardReservation(reservation);
              const canNoShow = canBoard && toleranceExpired;

              return (
                <article key={reservation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-slate-950">{reservation.passenger?.fullName ?? 'Usuario verificado'}</p>
                      <p className="text-xs text-slate-600">{reservation.passenger?.email ?? 'Correo no disponible'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${reservationStatusMeta.className}`}>{reservationStatusMeta.label}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <p>Lugares: <span className="font-bold text-slate-950">{reservation.totalSeats}</span></p>
                    <p>Solicitud # <span className="font-bold text-slate-950">{reservation.publicId ?? '-'}</span></p>
                  </div>

                  {reservation.status === 'boarded' || reservation.status === 'completed' ? (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Abordaje confirmado por identidad.</p>
                  ) : reservation.status === 'no_show' ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Marcado como no presentado.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canBoard || boardBusy || noShowBusy}
                        onClick={() => void updateReservationStatus(reservation.id, 'board')}
                        className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
                      >
                        {boardBusy ? 'Confirmando...' : 'Identificado y abordo'}
                      </button>
                      <button
                        type="button"
                        disabled={!canNoShow || boardBusy || noShowBusy}
                        onClick={() => void updateReservationStatus(reservation.id, 'no-show')}
                        className="rounded-md border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        {noShowBusy ? 'Marcando...' : toleranceExpired ? 'Marcar no presentado' : 'No presentado al terminar tolerancia'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}