'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { SafetyActionsPanel } from '@/components/safety-actions-panel';
import { apiRequest, getToken } from '@/lib/api';
import { getTripStatusMeta } from '@/lib/status';
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los viajes');
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
        start: 'Viaje iniciado correctamente. Los pasajeros ya ven el aviso de abordaje en su panel.',
        finish: 'Viaje finalizado correctamente. Ya puedes archivarlo para limpiar tu lista principal.',
        cancel: 'Viaje cancelado correctamente. Ya puedes archivarlo para limpiar tu lista principal.'
      };
      setSuccess(successMap[action]);
      await loadTrips();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar el viaje');
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
      setError('Solo puedes validar boletos en viajes programados o en curso.');
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
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar el viaje para validar boletos');
    } finally {
      setBusyAction(null);
    }
  }
  function archiveTrip(trip: DriverTrip) {
    if (!ARCHIVABLE_STATUSES.has(trip.status)) {
      setError('Solo puedes archivar viajes finalizados o cancelados.');
      setSuccess(null);
      return;
    }

    persistArchivedTripIds([...archivedTripIds, trip.id]);
    setError(null);
    setSuccess('Viaje archivado. Sigue disponible en la seccion Archivados.');
  }

  function restoreTrip(trip: DriverTrip) {
    persistArchivedTripIds(archivedTripIds.filter((tripId) => tripId !== trip.id));
    setError(null);
    setSuccess('Viaje restaurado a la lista principal.');
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

    return (
      <article key={trip.id} className={`rounded-xl border p-5 shadow-sm ${isArchived ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{trip.route?.title || `${trip.route?.origin || 'Ruta'} -> ${trip.route?.destination || ''}`}</h2>
            <p className="text-xs text-slate-500">Viaje # {trip.publicId ?? '-'}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
        </div>
        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Dia del viaje</p>
          <p className="mt-1 text-xl font-black leading-tight text-slate-950">{formatTripDateTitle(trip.tripDate)}</p>
          <p className="mt-1 text-sm font-semibold text-sky-900">Salida {formatTimeLabel(trip.departureTimeSnapshot)} - llegada {formatTimeLabel(trip.estimatedArrivalTimeSnapshot)}</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Pasajeros esperados</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{passengersExpected}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Boletos por validar</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{ticketsToValidate}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-700">Asientos configurados: {trip.availableSeatsSnapshot}</p>
        <p className="text-sm text-slate-700">Asientos disponibles: {trip.reservationSummary?.remainingSeats ?? trip.availableSeatsSnapshot}</p>
        <p className="text-sm text-slate-700">Precio: ${trip.pricePerSeatSnapshot.toFixed(2)} MXN</p>
        <p className="text-sm text-slate-700">Referencia de abordaje: {trip.boardingReference ?? 'Sin definir'}</p>
        {!isArchived && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">Usa siempre una referencia visible y publica para proteger al pasajero y al conductor.</p>}

        {trip.earningsSummary && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-semibold">Ganancia del conductor (comision descontada)</p>
            <p>Bruto cobrado: ${trip.earningsSummary.grossCollected.toFixed(2)} MXN</p>
            <p>Comision app: ${trip.earningsSummary.appCommissionAmount.toFixed(2)} MXN</p>
            <p>Reembolsos: ${trip.earningsSummary.refundedAmount.toFixed(2)} MXN</p>
            <p className="font-semibold">Neto estimado a recibir: ${trip.earningsSummary.driverNetAfterRefunds.toFixed(2)} MXN</p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {!isArchived && trip.status === 'scheduled' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">Este viaje aun no esta listo para validacion.</p>
              <p className="mt-1">Cuando estes en el punto de abordaje, usa <strong>Iniciar y validar boletos</strong> para abrir la captura de codigos.</p>
            </div>
          )}
          {!isArchived && trip.status === 'started' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <p className="font-bold">Viaje en curso: ya puedes validar boletos.</p>
                <p className="mt-1">Pide el <strong>codigo numerico de 6 digitos</strong> y valida unicamente boletos del dia y horario correspondiente.</p>
              </div>
              <SafetyActionsPanel
                role="driver"
                tripId={trip.id}
                routeId={trip.routeId}
                contextLabel={trip.route?.title ?? 'Viaje en curso'}
                compact
              />
            </div>
          )}
          {!isArchived && canArchive && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-bold text-slate-950">Este viaje ya puede archivarse.</p>
              <p className="mt-1">Archivarlo solo lo oculta de la lista principal; no borra reservas, pagos ni liquidaciones.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!isArchived && trip.status === 'scheduled' && (
              <>
                <button type="button" disabled={isStartBoardingBusy} onClick={() => startAndValidate(trip)} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-700">
                  {isStartBoardingBusy ? 'Abriendo validacion...' : 'Iniciar y validar boletos'}
                </button>
                <button type="button" disabled={isStartBusy || isStartBoardingBusy} onClick={() => changeStatus(trip, 'start')} className="rounded-md border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm disabled:opacity-50">
                  {isStartBusy ? 'Iniciando...' : 'Solo iniciar viaje'}
                </button>
              </>
            )}
            {!isArchived && trip.status === 'started' && (
              <Link href={`/dashboard/trips/${trip.id}/boarding`} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                Validar boletos
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
                Archivar viaje
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Viajes por dia</p>
            <h2 className="text-lg font-black text-slate-950">{group.title}</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{group.trips.length} viaje(s)</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {group.trips.map((trip) => renderTripCard(trip, isArchived))}
        </div>
      </section>
    );
  }

  if (loading) {
    return <p className="text-slate-700">Cargando viajes...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Mis viajes</h1>
              <p className="text-sm text-slate-600">Opera en orden: <strong>1) iniciar viaje</strong>, <strong>2) validar boletos</strong>, <strong>3) finalizar salida</strong>.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowArchived((current) => !current)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                {showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedTrips.length})`}
              </button>
              <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Rutas asignadas</Link>
              <Link href="/dashboard/routes" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">Tomar ruta</Link>
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
            <p className="text-base font-bold text-cyan-950">Reglas obligatorias para operar el viaje</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-bold text-slate-950">1. Iniciar viaje</p>
                <p className="mt-1 text-xs text-slate-700">Cuando estes en el punto de abordaje, presiona <strong>Iniciar viaje</strong>.</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-bold text-slate-950">2. Validar boletos</p>
                <p className="mt-1 text-xs text-slate-700">Despues de iniciar, entra a <strong>Validar boletos</strong> y captura el codigo de 6 digitos.</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-bold text-slate-950">3. Finalizar salida</p>
                <p className="mt-1 text-xs text-slate-700">Al terminar el traslado, presiona <strong>Finalizar</strong> para cerrar la operacion.</p>
              </div>
            </div>
          </div>

          {takenRouteName && !error && (
            <p className="rounded-md bg-cyan-50 p-3 text-cyan-800">
              Ruta tomada: <strong>{takenRouteName}</strong>. Ya puedes iniciar tu viaje desde este panel.
            </p>
          )}

          {trips.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no tienes viajes programados. Ve a Rutas para tomar una y crear tu viaje automaticamente.</p>
          ) : activeTrips.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
              <p className="font-semibold text-slate-900">No tienes viajes activos o pendientes en la lista principal.</p>
              <p className="mt-1 text-sm">Los viajes finalizados o cancelados pasan al historial operativo y tambien pueden archivarse.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedActiveTrips.map((group) => renderTripGroup(group))}
            </div>
          )}

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Historial operativo</p>
              <h2 className="text-lg font-semibold text-slate-950">Viajes terminados o cancelados</h2>
              <p className="text-sm text-slate-600">Estos viajes ya no saturan la lista principal. Archivarlos solo limpia tu vista.</p>
            </div>
            {historyTrips.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Aun no hay viajes terminados o cancelados.</p>
            ) : (
              <div className="space-y-4">{groupedHistoryTrips.map((group) => renderTripGroup(group))}</div>
            )}
          </section>

          {showArchived && (
            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Archivados</p>
                  <h2 className="text-lg font-semibold text-slate-900">Viajes cerrados fuera de la lista principal</h2>
                </div>
                <button type="button" onClick={() => setShowArchived(false)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                  Cerrar archivados
                </button>
              </div>
              {archivedTrips.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Todavia no hay viajes archivados.</p>
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
            'Sigue los pasos para operar tu viaje con claridad.',
            'Verifica siempre el punto de encuentro antes de iniciar.',
            'Valida el abordaje usando el codigo numerico del pasajero.',
            'Archiva viajes finalizados o cancelados para mantener limpia tu lista principal.'
          ]}
          nextStep="Inicia viaje, valida abordajes y archiva viajes cerrados."
          ctaHref="/dashboard/routes"
          ctaLabel="Tomar ruta"
        />
      </div>
    </section>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<p className="text-slate-700">Cargando viajes...</p>}>
      <TripsPageContent />
    </Suspense>
  );
}
