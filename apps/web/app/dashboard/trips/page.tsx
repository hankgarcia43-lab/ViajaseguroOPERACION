'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { SafetyActionsPanel } from '@/components/safety-actions-panel';
import { apiRequest, getToken } from '@/lib/api';
import { getTripStatusMeta } from '@/lib/status';
import { Reservation } from '@/lib/reservations';
import { DriverTrip } from '@/lib/trips';

type TripAction = 'start' | 'finish' | 'cancel';
type TripDateGroup = { key: string; title: string; trips: DriverTrip[] };

const ARCHIVED_TRIPS_STORAGE_KEY = 'viaja-seguro:driver-archived-trips';
const ARCHIVABLE_STATUSES = new Set(['finished', 'cancelled']);

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTripDateTitle(value?: string | null) {
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

function tripDateKey(value?: string | null) {
  if (!value) return 'pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function groupTripsByDate(trips: DriverTrip[]): TripDateGroup[] {
  const buckets = new Map<string, DriverTrip[]>();
  for (const trip of trips) {
    const key = tripDateKey(trip.tripDate);
    buckets.set(key, [...(buckets.get(key) ?? []), trip]);
  }

  return Array.from(buckets.entries())
    .map(([key, items]) => ({
      key,
      title: formatTripDateTitle(items[0]?.tripDate),
      trips: [...items].sort((a, b) => a.departureTimeSnapshot.localeCompare(b.departureTimeSnapshot))
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function TripsPageContent() {
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [requestsByTrip, setRequestsByTrip] = useState<Record<string, Reservation[]>>({});
  const [archivedTripIds, setArchivedTripIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const takenRouteName = searchParams.get('takenRoute');

  const normalizedError = (error ?? '').toLowerCase();
  const showVerificationLink = normalizedError.includes('verific');
  const showVehicleLink = normalizedError.includes('vehiculo');

  const archivedSet = useMemo(() => new Set(archivedTripIds), [archivedTripIds]);
  const visibleTrips = useMemo(() => trips.filter((trip) => !archivedSet.has(trip.id)), [archivedSet, trips]);
  const archivedTrips = useMemo(() => trips.filter((trip) => archivedSet.has(trip.id)), [archivedSet, trips]);
  const finishedOrCancelledCount = useMemo(() => trips.filter((trip) => ARCHIVABLE_STATUSES.has(trip.status)).length, [trips]);
  const activeTrips = useMemo(() => visibleTrips.filter((trip) => !ARCHIVABLE_STATUSES.has(trip.status)), [visibleTrips]);
  const historyTrips = useMemo(() => visibleTrips.filter((trip) => ARCHIVABLE_STATUSES.has(trip.status)), [visibleTrips]);
  const groupedActiveTrips = useMemo(() => groupTripsByDate(activeTrips), [activeTrips]);
  const groupedHistoryTrips = useMemo(() => groupTripsByDate(historyTrips), [historyTrips]);
  const groupedArchivedTrips = useMemo(() => groupTripsByDate(archivedTrips), [archivedTrips]);

  const persistArchivedTripIds = useCallback((nextIds: string[]) => {
    const uniqueIds = Array.from(new Set(nextIds));
    setArchivedTripIds(uniqueIds);
    window.localStorage.setItem(ARCHIVED_TRIPS_STORAGE_KEY, JSON.stringify(uniqueIds));
  }, []);

  const loadTrips = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<DriverTrip[]>('/trips/my-trips', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setTrips(data);
      const requestEntries = await Promise.all(
        data.map(async (trip) => {
          try {
            const requests = await apiRequest<Reservation[]>(`/reservations/driver/trip/${trip.id}`, { headers: { Authorization: `Bearer ${token}` } });
            return [trip.id, requests] as const;
          } catch {
            return [trip.id, []] as const;
          }
        })
      );
      setRequestsByTrip(Object.fromEntries(requestEntries));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar tus rutas compartidas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(ARCHIVED_TRIPS_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      setArchivedTripIds(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
    } catch {
      setArchivedTripIds([]);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  async function changeStatus(trip: DriverTrip, action: TripAction) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyAction(`${trip.id}:${action}`);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/trips/${trip.id}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const successMap: Record<TripAction, string> = {
        start: 'Ruta iniciada correctamente. Los usuarios ya ven el aviso operativo en su panel.',
        finish: 'Ruta finalizada correctamente. Ya puedes archivarla para limpiar tu lista principal.',
        cancel: 'Ruta cancelada correctamente. Ya puedes archivarla para limpiar tu lista principal.'
      };
      setSuccess(successMap[action]);
      await loadTrips();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar la ruta');
    } finally {
      setBusyAction(null);
    }
  }


  async function startAndValidate(trip: DriverTrip) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (trip.status === 'started') {
      router.push(`/dashboard/trips/${trip.id}/boarding`);
      return;
    }

    if (trip.status !== 'scheduled') {
      setError('Solo puedes abrir control de abordaje en rutas programadas o en curso.');
      return;
    }

    setBusyAction(`${trip.id}:start-boarding`);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/trips/${trip.id}/start`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      router.push(`/dashboard/trips/${trip.id}/boarding`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar la ruta para controlar abordaje');
    } finally {
      setBusyAction(null);
    }
  }
  function archiveTrip(trip: DriverTrip) {
    if (!ARCHIVABLE_STATUSES.has(trip.status)) {
      setError('Solo puedes archivar rutas finalizadas o canceladas.');
      setSuccess(null);
      return;
    }

    persistArchivedTripIds([...archivedTripIds, trip.id]);
    setError(null);
    setSuccess('Ruta archivada. Sigue disponible en la seccion Archivados.');
  }

  function restoreTrip(trip: DriverTrip) {
    persistArchivedTripIds(archivedTripIds.filter((tripId) => tripId !== trip.id));
    setError(null);
    setSuccess('Ruta restaurada a la lista principal.');
  }

  async function reviewRouteRequest(reservationId: string, action: 'accept' | 'reject') {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyAction(`${reservationId}:${action}`);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/reservations/${reservationId}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setSuccess(action === 'accept' ? 'Solicitud aceptada. El usuario ya puede ver su pase de ruta.' : 'Solicitud rechazada. El usuario vera el estado actualizado.');
      await loadTrips();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar la solicitud.');
    } finally {
      setBusyAction(null);
    }
  }
  function renderTripCard(trip: DriverTrip, isArchived = false) {
    const statusMeta = getTripStatusMeta(trip.status);
    const isStartBusy = busyAction === `${trip.id}:start`;
    const isFinishBusy = busyAction === `${trip.id}:finish`;
    const isCancelBusy = busyAction === `${trip.id}:cancel`;
    const isStartBoardingBusy = busyAction === `${trip.id}:start-boarding`;
    const canArchive = ARCHIVABLE_STATUSES.has(trip.status);
    const passengersExpected = trip.reservationSummary?.reservedSeats ?? 0;
    const ticketsToValidate = trip.reservationSummary?.reservationsCount ?? 0;
    const tripRequests = requestsByTrip[trip.id] ?? [];
    const pendingRequests = tripRequests.filter((reservation) => ['pending', 'confirmed'].includes(reservation.status));
    const acceptedRequests = tripRequests.filter((reservation) => ['accepted', 'paid', 'boarded', 'completed'].includes(reservation.status));

    return (
      <article key={trip.id} className={`rounded-xl border p-5 shadow-sm ${isArchived ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{trip.route?.title || `${trip.route?.origin || 'Ruta'} -> ${trip.route?.destination || ''}`}</h2>
            <p className="text-xs text-slate-500">Ruta # {trip.publicId ?? '-'}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
        </div>
        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Dia de la ruta</p>
          <p className="mt-1 text-xl font-black leading-tight text-slate-950">{formatTripDateTitle(trip.tripDate)}</p>
          <p className="mt-1 text-sm font-semibold text-sky-900">Salida {formatTimeLabel(trip.departureTimeSnapshot)} - llegada {formatTimeLabel(trip.estimatedArrivalTimeSnapshot)}</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Usuarios esperados</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{passengersExpected}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Pases por validar</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{ticketsToValidate}</p>
          </div>
        </div>
        {tripRequests.length > 0 && !isArchived && (
          <section className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Solicitudes de usuarios</p>
                <p className="font-semibold text-slate-950">Pendientes: {pendingRequests.length} / Aceptadas: {acceptedRequests.length}</p>
              </div>
              <Link href={`/dashboard/trips/${trip.id}/boarding`} className="rounded-md border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-800">
                Control de abordaje
              </Link>
            </div>
            {pendingRequests.length > 0 && (
              <div className="mt-3 space-y-2">
                {pendingRequests.slice(0, 4).map((reservation) => {
                  const acceptBusy = busyAction === `${reservation.id}:accept`;
                  const rejectBusy = busyAction === `${reservation.id}:reject`;
                  return (
                    <article key={reservation.id} className="rounded-lg border border-white bg-white p-3 shadow-sm">
                      <p className="font-bold text-slate-950">{reservation.passenger?.fullName ?? 'Usuario verificado'}</p>
                      <p className="text-xs text-slate-600">Lugares solicitados: {reservation.totalSeats}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={acceptBusy || rejectBusy} onClick={() => void reviewRouteRequest(reservation.id, 'accept')} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                          {acceptBusy ? 'Aceptando...' : 'Aceptar'}
                        </button>
                        <button type="button" disabled={acceptBusy || rejectBusy} onClick={() => void reviewRouteRequest(reservation.id, 'reject')} className="rounded-md border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">
                          {rejectBusy ? 'Rechazando...' : 'Rechazar'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
        <p className="mt-3 text-sm text-slate-700">Lugares configurados: {trip.availableSeatsSnapshot}</p>
        <p className="text-sm text-slate-700">Lugares disponibles: {trip.reservationSummary?.remainingSeats ?? trip.availableSeatsSnapshot}</p>
        <p className="text-sm text-slate-700">Estimacion orientativa: ${trip.pricePerSeatSnapshot.toFixed(2)} MXN</p>
        <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs font-semibold text-amber-900">Recuerda considerar gasolina, caseta y mantenimiento. VIAJASEGURO siempre pensando en tu bolsillo y seguridad.</p>
        <p className="text-sm text-slate-700">Referencia de abordaje: {trip.boardingReference ?? 'Sin definir'}</p>
        {!isArchived && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">Usa siempre una referencia visible y publica para proteger al usuario y al conductor.</p>}


        <div className="mt-4 space-y-3">
          {!isArchived && trip.status === 'scheduled' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">Esta ruta aun no esta lista para validacion.</p>
              <p className="mt-1">Cuando estes en el punto de abordaje, usa <strong>Iniciar y controlar abordaje</strong> para identificar usuarios. Los faltantes tienen 10 minutos de tolerancia.</p>
            </div>
          )}
          {!isArchived && trip.status === 'started' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <p className="font-bold">Ruta en curso: ya puedes controlar abordaje.</p>
                <p className="mt-1">Identifica al usuario por nombre, confirma lugares y marca abordaje solo para esta fecha y horario.</p>
              </div>
              <SafetyActionsPanel
                role="driver"
                tripId={trip.id}
                routeId={trip.routeId}
                contextLabel={trip.route?.title ?? 'Ruta en curso'}
                compact
              />
            </div>
          )}
          {!isArchived && canArchive && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-bold text-slate-950">Esta ruta ya puede archivarse.</p>
              <p className="mt-1">Archivarla solo la oculta de la lista principal; no borra solicitudes, pases ni reportes.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!isArchived && trip.status === 'scheduled' && (
              <>
                <button type="button" disabled={isStartBoardingBusy} onClick={() => startAndValidate(trip)} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-700">
                  {isStartBoardingBusy ? 'Abriendo abordaje...' : 'Iniciar y controlar abordaje'}
                </button>
                <button type="button" disabled={isStartBusy || isStartBoardingBusy} onClick={() => changeStatus(trip, 'start')} className="rounded-md border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm disabled:opacity-50">
                  {isStartBusy ? 'Iniciando...' : 'Solo iniciar ruta'}
                </button>
              </>
            )}
            {!isArchived && trip.status === 'started' && (
              <Link href={`/dashboard/trips/${trip.id}/boarding`} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                Control de abordaje
              </Link>
            )}
            {!isArchived && trip.status === 'started' && (
              <button type="button" disabled={isFinishBusy} onClick={() => changeStatus(trip, 'finish')} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">
                {isFinishBusy ? 'Finalizando...' : '3. Finalizar'}
              </button>
            )}
            {!isArchived && (trip.status === 'scheduled' || trip.status === 'started') && (
              <button type="button" disabled={isCancelBusy} onClick={() => changeStatus(trip, 'cancel')} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">
                {isCancelBusy ? 'Cancelando...' : 'Cancelar'}
              </button>
            )}
            {!isArchived && canArchive && (
              <button type="button" onClick={() => archiveTrip(trip)} className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                Archivar ruta
              </button>
            )}
            {isArchived && (
              <button type="button" onClick={() => restoreTrip(trip)} className="rounded-md border border-brand-300 bg-white px-3 py-2 text-sm font-medium text-brand-700">
                Restaurar a lista principal
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  function renderTripGroup(group: TripDateGroup, isArchived = false) {
    return (
      <section key={group.key} className={`space-y-3 rounded-xl border p-4 ${isArchived ? 'border-slate-200 bg-slate-100' : 'border-sky-200 bg-sky-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Rutas por dia</p>
            <h2 className="text-lg font-black text-slate-950">{group.title}</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{group.trips.length} ruta(s)</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {group.trips.map((trip) => renderTripCard(trip, isArchived))}
        </div>
      </section>
    );
  }

  if (loading) {
    return <p className="text-slate-700">Cargando rutas...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Mis rutas compartidas</h1>
              <p className="text-sm text-slate-600">Opera en orden: <strong>1) iniciar ruta</strong>, <strong>2) identificar usuarios</strong>, <strong>3) finalizar salida</strong>.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowArchived((current) => !current)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                {showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedTrips.length})`}
              </button>
              <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Rutas publicadas</Link>
              <Link href="/dashboard/routes" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">Publicar ruta</Link>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="text-xs font-bold uppercase text-slate-500">Lista principal</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{activeTrips.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="text-xs font-bold uppercase text-slate-500">Archivados</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{archivedTrips.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="text-xs font-bold uppercase text-slate-500">Listos para archivar</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{Math.max(0, finishedOrCancelledCount - archivedTrips.length)}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
              <p className="font-semibold">{error}</p>
              {showVerificationLink && <Link href="/dashboard/verification" className="mt-2 inline-block underline">Completar verificacion</Link>}
              {showVehicleLink && <Link href="/dashboard/vehicle" className="mt-2 ml-3 inline-block underline">Registrar o revisar mi vehiculo</Link>}
            </div>
          )}
          {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800 shadow-sm">{success}</p>}
          <div className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-950 shadow-sm">
            <p className="text-base font-bold text-cyan-950">Reglas obligatorias para operar la ruta</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-bold text-slate-950">1. Iniciar ruta</p>
                <p className="mt-1 text-xs text-slate-700">Cuando estes en el punto de abordaje, presiona <strong>Iniciar ruta</strong>.</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-bold text-slate-950">2. Control de abordaje</p>
                <p className="mt-1 text-xs text-slate-700">Despues de iniciar, entra a <strong>Control de abordaje</strong>, identifica usuarios y confirma quienes subieron.</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-bold text-slate-950">3. Finalizar salida</p>
                <p className="mt-1 text-xs text-slate-700">Al terminar la ruta, presiona <strong>Finalizar</strong> para cerrar la operacion.</p>
              </div>
            </div>
          </div>

          {takenRouteName && !error && (
            <p className="rounded-md bg-cyan-50 p-3 text-cyan-800">
              Ruta tomada: <strong>{takenRouteName}</strong>. Ya puedes iniciar tu ruta desde este panel.
            </p>
          )}

          {trips.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no tienes rutas programadas. Ve a Rutas para tomar una y crear tu ruta automaticamente.</p>
          ) : activeTrips.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
              <p className="font-semibold text-slate-900">No tienes rutas activas o pendientes en la lista principal.</p>
              <p className="mt-1 text-sm">Las rutas finalizadas o canceladas pasan al historial operativo y tambien pueden archivarse.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedActiveTrips.map((group) => renderTripGroup(group))}
            </div>
          )}

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Historial operativo</p>
              <h2 className="text-lg font-semibold text-slate-950">Rutas terminadas o canceladas</h2>
              <p className="text-sm text-slate-600">Estas rutas ya no saturan la lista principal. Archivarlos solo limpia tu vista.</p>
            </div>
            {historyTrips.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Aun no hay rutas terminadas o canceladas.</p>
            ) : (
              <div className="space-y-4">{groupedHistoryTrips.map((group) => renderTripGroup(group))}</div>
            )}
          </section>

          {showArchived && (
            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Archivados</p>
                  <h2 className="text-lg font-semibold text-slate-900">Rutas cerradas fuera de la lista principal</h2>
                </div>
                <button type="button" onClick={() => setShowArchived(false)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                  Cerrar archivados
                </button>
              </div>
              {archivedTrips.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Todavia no hay rutas archivadas.</p>
              ) : (
                <div className="space-y-4">
                  {groupedArchivedTrips.map((group) => renderTripGroup(group, true))}
                </div>
              )}
            </section>
          )}
        </div>

        <ContextHelpPanel
          title="Que hacer"
          subtitle="Operacion diaria del conductor"
          points={[
            'Sigue los pasos para operar tu ruta con claridad.',
            'Verifica siempre el punto de encuentro antes de iniciar.',
            'Confirma abordaje por identidad del usuario; revisa nombre, fecha y lugares antes de permitir subida.',
            'Archiva rutas finalizadas o canceladas para mantener limpia tu lista principal.'
          ]}
          nextStep="Inicia ruta, identifica usuarios y archiva rutas cerradas."
          ctaHref="/dashboard/routes"
          ctaLabel="Publicar ruta"
        />
      </div>
    </section>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<p className="text-slate-700">Cargando rutas...</p>}>
      <TripsPageContent />
    </Suspense>
  );
}
