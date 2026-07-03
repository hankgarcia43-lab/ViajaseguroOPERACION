'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RouteHighlightCard } from '@/components/route-highlight-card';
import { apiRequest, getSessionRole, getToken } from '@/lib/api';
import { inferRouteCorridor } from '@/lib/route-corridors';
import { groupRoutesByCluster } from '@/lib/route-display';
import { BaseRouteSummary, RouteOffer, sortRoutesForFeed } from '@/lib/route-offers';

type UserRole = 'passenger' | 'driver' | 'admin';
type TimeFilter = 'all' | 'early' | 'morning' | 'midday' | 'evening';

interface MeResponse {
  id: string;
  role: UserRole;
}

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sabado',
  sunday: 'Domingo'
};

const TIME_FILTERS: Array<{ value: TimeFilter; label: string; helper: string }> = [
  { value: 'all', label: 'Cualquier horario', helper: 'Todos' },
  { value: 'early', label: 'Madrugada', helper: '04:00-06:59' },
  { value: 'morning', label: 'Manana', helper: '07:00-10:59' },
  { value: 'midday', label: 'Mediodia', helper: '11:00-15:59' },
  { value: 'evening', label: 'Tarde/noche', helper: '16:00-22:59' }
];

function formatWeekdays(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return 'No definido';
  }

  return values.map((value) => WEEKDAY_LABELS[value] ?? value).join(', ');
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hourFromTime(value: string | null | undefined) {
  const hour = Number.parseInt(String(value ?? '').split(':')[0] ?? '', 10);
  return Number.isFinite(hour) ? hour : null;
}

function matchesTimeFilter(route: BaseRouteSummary, filter: TimeFilter) {
  if (filter === 'all') return true;
  const hour = hourFromTime(route.departureTime);
  if (hour === null) return false;

  if (filter === 'early') return hour >= 4 && hour < 7;
  if (filter === 'morning') return hour >= 7 && hour < 11;
  if (filter === 'midday') return hour >= 11 && hour < 16;
  return hour >= 16 && hour < 23;
}

function routeMatchesSearch(route: BaseRouteSummary, originFilter: string, destinationFilter: string, dayFilter: string, timeFilter: TimeFilter) {
  const originNeedle = normalizeText(originFilter);
  const destinationNeedle = normalizeText(destinationFilter);
  const originHaystack = normalizeText([route.origin, route.title, route.stopsText].filter(Boolean).join(' '));
  const destinationHaystack = normalizeText([route.destination, route.title].filter(Boolean).join(' '));

  const matchesOrigin = !originNeedle || originHaystack.includes(originNeedle);
  const matchesDestination = !destinationNeedle || destinationHaystack.includes(destinationNeedle);
  const matchesDay = dayFilter === 'all' || route.weekdays.includes(dayFilter);

  return matchesOrigin && matchesDestination && matchesDay && matchesTimeFilter(route, timeFilter);
}

export default function SearchTripsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  const [routes, setRoutes] = useState<BaseRouteSummary[]>([]);
  const [myOffers, setMyOffers] = useState<RouteOffer[]>([]);
  const [originFilter, setOriginFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const role = me?.role ?? sessionRole;
  const isDriver = role === 'driver';
  const isPassenger = role === 'passenger';
  const isAdmin = role === 'admin';
  const offerRouteIds = useMemo(() => new Set(myOffers.map((offer) => offer.routeId)), [myOffers]);
  const displayRoutes = useMemo(() => sortRoutesForFeed(groupRoutesByCluster(routes), { preferLowerCompetition: isDriver }), [isDriver, routes]);
  const filteredRoutes = useMemo(
    () => displayRoutes.filter((route) => routeMatchesSearch(route, originFilter, destinationFilter, dayFilter, timeFilter)),
    [dayFilter, destinationFilter, displayRoutes, originFilter, timeFilter]
  );
  const hasActiveFilters = Boolean(originFilter.trim() || destinationFilter.trim() || dayFilter !== 'all' || timeFilter !== 'all');

  useEffect(() => {
    const rawRole = getSessionRole();
    if (rawRole === 'driver' || rawRole === 'passenger' || rawRole === 'admin') {
      setSessionRole(rawRole);
    }
  }, []);

  async function loadRoutesFeed() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const profile = await apiRequest<MeResponse>('/auth/me', { headers });
      setMe(profile);

      const baseRoutes = await apiRequest<BaseRouteSummary[]>('/route-offers/routes', { headers });
      setRoutes(baseRoutes);

      if (profile.role === 'driver') {
        const offers = await apiRequest<RouteOffer[]>('/route-offers/my-offers', { headers });
        setMyOffers(offers);
      } else {
        setMyOffers([]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las rutas publicadas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoutesFeed();
  }, []);

  function clearFilters() {
    setOriginFilter('');
    setDestinationFilter('');
    setDayFilter('all');
    setTimeFilter('all');
  }

  if (loading) {
    return <p className="text-slate-700">Cargando feed de rutas publicadas...</p>;
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Feed principal de rutas</h1>
            <p className="text-sm text-slate-600">Busca por punto de partida, destino, dia y horario. Las rutas activas y recientes aparecen primero.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              Ver corredores
            </Link>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                void loadRoutesFeed();
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Recargar feed
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Rutas publicadas: <span className="font-semibold text-slate-900">{displayRoutes.length}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Coincidencias: <span className="font-semibold text-slate-900">{filteredRoutes.length}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Mi rol actual: <span className="font-semibold text-slate-900">{role ?? 'No disponible'}</span></div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Filtros rapidos</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Encuentra una ruta compatible</h2>
            <p className="mt-1 text-sm text-slate-600">Usa municipio, poblado, terminal, zona de trabajo o destino. Puedes combinar filtros.</p>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_180px]">
          <label className="block text-sm font-semibold text-slate-700">
            Punto de partida
            <input
              value={originFilter}
              onChange={(event) => setOriginFilter(event.target.value)}
              placeholder="Ej. Acolman, Tecamac, Ecatepec"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Destino
            <input
              value={destinationFilter}
              onChange={(event) => setDestinationFilter(event.target.value)}
              placeholder="Ej. Indios Verdes, Pantitlan"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Dia
            <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Todos</option>
              {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Horario
            <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as TimeFilter)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {TIME_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          {TIME_FILTERS.filter((option) => option.value !== 'all').map((option) => (
            <span key={option.value} className="rounded-full bg-slate-100 px-3 py-1">{option.label}: {option.helper}</span>
          ))}
        </div>
      </section>

      {isDriver && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Toma de rutas rapida para conductores</p>
          <p className="mt-1">Te mostramos primero rutas con menor competencia para ayudarte a decidir mas rapido.</p>
        </div>
      )}
      {isPassenger && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
          <p className="font-semibold">Elige una ruta con calma</p>
          <p className="mt-1">Revisa punto de partida, destino, conductor disponible, referencia de abordaje y horario antes de solicitar unirte.</p>
          <p className="mt-1">Si viajas varios dias, usa solicitud semanal para coordinar la ruta completa con el conductor.</p>
        </div>
      )}
      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Admin puede consultar el feed completo para revisar disponibilidad, actividad reciente y rutas con poca oferta.
        </div>
      )}

      {error && (<div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"><p>{error}</p><p className="text-sm">Si estas en local y no levantaste API en el puerto 4000, la app intentara usar el respaldo remoto automaticamente.</p></div>)}

      {displayRoutes.length === 0 ? (!error ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-base font-semibold">No hay rutas cercanas o publicadas para tu zona.</p>
          <p className="text-sm">Aun no hay rutas publicadas para esta zona. Revisa de nuevo en unos minutos o consulta otro corredor disponible.</p>
          {(isDriver || isAdmin) && (
            <Link href="/dashboard/routes/create" className="inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white">
              Crear ruta ahora
            </Link>
          )}
        </div>
      ) : null) : filteredRoutes.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-base font-semibold">No encontramos rutas con esos filtros.</p>
          <p className="text-sm">Prueba con otro punto de partida, destino u horario. Tambien puedes publicar una necesidad de ruta para que un conductor verificado responda.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={clearFilters} className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900">Limpiar filtros</button>
            {isPassenger && <Link href="/dashboard/routes/request" className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white">Necesito una ruta</Link>}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 2xl:grid-cols-2">
          {filteredRoutes.map((route) => {
              const corridor = inferRouteCorridor(route);
              const alreadyTaken = offerRouteIds.has(route.id);
              const activeDrivers = route.activeDriversCount ?? 0;

              return (
                <article key={route.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <RouteHighlightCard
                    title={route.title}
                    origin={route.origin}
                    destination={route.destination}
                    weekdays={route.weekdays}
                    departureTime={route.departureTime}
                    estimatedArrivalTime={route.estimatedArrivalTime}
                    pricePerSeat={route.pricePerSeat}
                    distanceKm={route.distanceKm}
                    stopsText={route.stopsText}
                    showTown={false}
                    showBoardingReference={false}
                    activeDriversCount={activeDrivers}
                    badge={corridor.routeTypeLabel}
                    tone={alreadyTaken ? 'owned' : 'default'}
                  />

                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                    El monto mostrado es una aportacion sugerida en efectivo acordada directamente entre usuario y conductor. VIAJASEGURO no cobra traslados, no fija tarifas obligatorias y no administra pagos entre las partes.
                  </p>

                  {isDriver && (
                    <p className="mt-3 text-xs text-slate-600">
                      {activeDrivers <= 1
                        ? 'Oportunidad alta: hay pocos conductores en esta ruta.'
                        : activeDrivers <= 3
                          ? 'Oportunidad media: demanda estable y competencia moderada.'
                          : 'Competencia alta: valida si te conviene por horario y zona.'}
                    </p>
                  )}

                  <div className="mt-4">
                    {isPassenger ? (
                      <Link href={`/dashboard/routes/${route.id}`} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">
                        Solicitar unirme
                      </Link>
                    ) : isDriver ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {alreadyTaken && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Ruta ya tomada</span>}
                        <Link href={`/dashboard/routes/${route.id}/take`} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                          {alreadyTaken ? 'Editar mi disponibilidad' : 'Tomar esta ruta'}
                        </Link>
                      </div>
                    ) : (
                      <Link href={`/dashboard/routes/${route.id}`} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                        Ver detalle
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      )}

      {!isPassenger && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Operacion recomendada</p>
          <p className="mt-1">Mantener horarios claros, abordajes visibles y rutas consistentes facilita que usuarios y conductores decidan mas rapido.</p>
        </div>
      )}
    </section>
  );
}
