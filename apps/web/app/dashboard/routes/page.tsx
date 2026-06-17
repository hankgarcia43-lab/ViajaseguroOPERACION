'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { RouteHighlightCard } from '@/components/route-highlight-card';
import { apiRequest, getSessionRole, getToken } from '@/lib/api';
import { inferRouteCorridor, ROUTE_CORRIDORS } from '@/lib/route-corridors';
import { groupRoutesByCluster } from '@/lib/route-display';
import { BaseRouteSummary, RouteOffer, routeActivityTimestamp, sortRoutesForFeed } from '@/lib/route-offers';

type UserRole = 'passenger' | 'driver' | 'admin';

interface MeResponse {
  id: string;
  role: UserRole;
}

function normalizeRouteText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isPriorityIndiosVerdesRoute(route: BaseRouteSummary) {
  const text = normalizeRouteText(`${route.title ?? ''} ${route.origin} ${route.destination}`);
  return text.includes('indios verdes') && ['tepexpan', 'ojo de agua', 'san cristobal', 'acolman', 'tecamac', 'ecatepec'].some((keyword) => text.includes(keyword));
}

export default function RoutesPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  const [routes, setRoutes] = useState<BaseRouteSummary[]>([]);
  const [myOffers, setMyOffers] = useState<RouteOffer[]>([]);
  const [myCreatedRoutes, setMyCreatedRoutes] = useState<BaseRouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedCreatedRouteId, setHighlightedCreatedRouteId] = useState<string | null>(null);

  const role = me?.role ?? sessionRole;
  const isDriver = role === 'driver';
  const isPassenger = role === 'passenger';
  const isAdmin = role === 'admin';

  const offerRouteIds = useMemo(() => new Set(myOffers.map((offer) => offer.routeId)), [myOffers]);

  const displayRoutes = useMemo(() => sortRoutesForFeed(groupRoutesByCluster(routes), { preferLowerCompetition: isDriver }), [isDriver, routes]);

  const sortedMyCreatedRoutes = useMemo(() => {
    return [...myCreatedRoutes].sort((a, b) => {
      if (a.id === highlightedCreatedRouteId) return -1;
      if (b.id === highlightedCreatedRouteId) return 1;
      const activityDiff = routeActivityTimestamp(b) - routeActivityTimestamp(a);
      if (activityDiff !== 0) return activityDiff;
      return (a.title ?? a.origin).localeCompare(b.title ?? b.origin);
    });
  }, [highlightedCreatedRouteId, myCreatedRoutes]);

  const groupedRoutes = useMemo(() => {
    const bucket = new Map<string, { corridorName: string; order: number; routes: BaseRouteSummary[] }>();

    for (const route of displayRoutes) {
      const corridor = inferRouteCorridor(route);
      if (!bucket.has(corridor.id)) {
        bucket.set(corridor.id, {
          corridorName: corridor.name,
          order: corridor.order,
          routes: []
        });
      }
      bucket.get(corridor.id)?.routes.push(route);
    }

    return Array.from(bucket.values()).sort((a, b) => a.order - b.order);
  }, [displayRoutes]);

  const corridorSummary = useMemo(() => {
    return ROUTE_CORRIDORS.map((corridor) => {
      const routesInCorridor = displayRoutes.filter((route) => inferRouteCorridor(route).id === corridor.id);
      const driverCount = routesInCorridor.reduce((acc, route) => acc + (route.activeDriversCount ?? 0), 0);
      const primaryRoute = routesInCorridor.find((route) => route.templateKey === corridor.primaryTemplateKey) ?? routesInCorridor[0] ?? null;
      return { corridor, count: routesInCorridor.length, driverCount, primaryRoute };
    });
  }, [displayRoutes]);

  const selectedCorridor = useMemo(
    () => (selectedCorridorId === 'all' ? null : ROUTE_CORRIDORS.find((corridor) => corridor.id === selectedCorridorId) ?? null),
    [selectedCorridorId]
  );

  const visibleGroupedRoutes = useMemo(() => {
    const normalizedSearch = normalizeRouteText(searchTerm.trim());
    return groupedRoutes
      .filter((group) => !selectedCorridor || group.corridorName === selectedCorridor.name)
      .map((group) => ({
        ...group,
        routes: normalizedSearch
          ? group.routes.filter((route) =>
              normalizeRouteText(`${route.title ?? ''} ${route.origin} ${route.destination} ${route.stopsText ?? ''}`).includes(normalizedSearch)
            )
          : group.routes
      }))
      .filter((group) => group.routes.length > 0);
  }, [groupedRoutes, searchTerm, selectedCorridor]);

  const priorityRoutes = useMemo(() => {
    return sortRoutesForFeed(displayRoutes.filter(isPriorityIndiosVerdesRoute), { preferLowerCompetition: isDriver });
  }, [displayRoutes, isDriver]);

  function selectCorridor(corridorId: string) {
    setSelectedCorridorId(corridorId);
    window.setTimeout(() => document.getElementById('routes-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  function renderRouteActions(route: BaseRouteSummary, alreadyTaken: boolean) {
    return (
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Link href={`/dashboard/routes/${route.id}`} className="rounded-md bg-brand-500 px-4 py-2 text-center text-sm font-medium text-white">
          Pasajero: ver conductores y reservar
        </Link>
        {isDriver ? (
          <Link href={`/dashboard/routes/${route.id}/take`} className="rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white">
            {alreadyTaken ? 'Conductor: editar mi viaje' : 'Conductor: generar ingresos en esta ruta'}
          </Link>
        ) : (
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm font-medium text-emerald-800">
            Conductor: entra con cuenta de chofer para tomarla
          </span>
        )}
      </div>
    );
  }

  useEffect(() => {
    const rawRole = getSessionRole();
    if (rawRole === 'driver' || rawRole === 'passenger' || rawRole === 'admin') {
      setSessionRole(rawRole);
    }

    const params = new URLSearchParams(window.location.search);
    setHighlightedCreatedRouteId(params.get('createdRoute'));
  }, []);

  async function loadData() {
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
        const [offers, createdRoutes] = await Promise.all([
          apiRequest<RouteOffer[]>('/route-offers/my-offers', { headers }),
          apiRequest<BaseRouteSummary[]>('/routes/my-routes', { headers }).catch(() => [])
        ]);
        setMyOffers(offers);
        setMyCreatedRoutes(createdRoutes);
      } else {
        setMyOffers([]);
        setMyCreatedRoutes([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las rutas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  if (loading) return <p className="text-slate-700">Cargando corredores...</p>;

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Corredores laborales EdoMex {'->'} CDMX</h1>
        <p className="text-sm text-slate-600">
          {isDriver
            ? 'Crea tu propia ruta para trabajar o toma una publicada y personaliza tu viaje para publicarlo rapidamente.'
            : 'Explora rutas publicadas por secciones. Primero veras las rutas prioritarias hacia Indios Verdes y despues el resto de corredores.'}
        </p>
        {(isDriver || isAdmin) && (
          <div className="mt-3">
            <Link href="/dashboard/routes/create" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">
              Crear mi ruta para trabajar
            </Link>
          </div>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="block text-sm text-slate-700">
            Buscar ruta por municipio, destino o punto clave
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ej. Tecamac, Pantitlan, Buenavista, Indios Verdes"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Corredor
            <select value={selectedCorridorId} onChange={(event) => selectCorridor(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="all">Todos los corredores</option>
              {ROUTE_CORRIDORS.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>{corridor.name}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Tip: primero elige destino fuerte; despues compara precio, horario y conductores activos.</p>
      </section>
      {isDriver && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Mis rutas creadas</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Rutas que puedes tomar rapido</h2>
            <p className="text-sm text-slate-600">Aqui aparecen las rutas que tu creaste como chofer. Entra directo a publicar o actualizar tu disponibilidad.</p>
          </div>
          <Link href="/dashboard/routes/create" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">
            Crear otra ruta
          </Link>
        </div>

        {sortedMyCreatedRoutes.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Aun no has creado rutas propias.</p>
            <p className="mt-1">Crea una ruta con origen, destino, horario y asientos. Despues volveras aqui para tomarla y publicarla a pasajeros.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 2xl:grid-cols-2">
            {sortedMyCreatedRoutes.map((route) => {
              const alreadyTaken = offerRouteIds.has(route.id);
              const isNewRoute = route.id === highlightedCreatedRouteId;

              return (
                <article key={`mine-${route.id}`} className={`rounded-xl border p-3 shadow-sm ${isNewRoute ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
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
                    badge={alreadyTaken ? 'Disponibilidad publicada' : 'Falta publicar disponibilidad'}
                    tone="owned"
                  />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link href={`/dashboard/routes/${route.id}/take`} className="rounded-md bg-emerald-700 px-4 py-2 text-center text-sm font-medium text-white">
                      {alreadyTaken ? 'Actualizar disponibilidad' : 'Tomar y publicar ruta'}
                    </Link>
                    <Link href={`/dashboard/routes/${route.id}/take`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700">
                      Ver datos de operacion
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </section>
      )}

      {priorityRoutes.length > 0 && (
        <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Rutas prioritarias listas para tomar</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Indios Verdes: Tepexpan, Ojo de Agua y San Cristobal</h2>
              <p className="text-sm text-slate-600">Estas rutas conectan zonas de alta demanda. Pasajeros apartan asiento; conductores pueden generar ingresos moviendo personas que van hacia la misma zona o cerca de su trabajo.</p>
            </div>
            <button type="button" onClick={() => selectCorridor('norte-indios-verdes')} className="rounded-md border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700">
              Ver todas las del corredor
            </button>
          </div>

          <div className="mt-4 grid gap-3 2xl:grid-cols-2">
            {priorityRoutes.slice(0, 6).map((route) => {
              const alreadyTaken = offerRouteIds.has(route.id);
              return (
                <article key={`priority-${route.id}`} className="rounded-xl border border-white bg-white/90 p-3 shadow-sm">
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
                    activeDriversCount={route.activeDriversCount}
                    badge="Ruta prioritaria"
                    tone="priority"
                  />
                  {renderRouteActions(route, alreadyTaken)}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {corridorSummary.map(({ corridor, count, driverCount, primaryRoute }) => (
          <article key={corridor.id} className={`rounded-xl border p-4 shadow-sm ${selectedCorridorId === corridor.id ? 'border-brand-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{corridor.routeTypeLabel}</p>
            <h2 className="mt-2 text-base font-semibold text-slate-900">{corridor.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{corridor.municipalities}</p>
            <p className="text-sm text-slate-700">Destino fuerte: {corridor.destinationHub}</p>
            <p className="mt-2 text-xs text-slate-500">{corridor.description}</p>
            <p className="mt-2 rounded-lg border border-slate-200 bg-white/70 p-2 text-xs text-slate-700">{isDriver ? corridor.driverHint : corridor.passengerHint}</p>
            <p className="mt-2 text-xs font-medium text-emerald-700">Rutas publicadas: {count}</p>
            <p className="mt-1 text-xs font-medium text-cyan-700">Conductores activos: {driverCount}</p>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => selectCorridor(corridor.id)} className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                Ver rutas del corredor
              </button>
              {primaryRoute && (
                isDriver ? (
                  <Link href={`/dashboard/routes/${primaryRoute.id}/take`} className="w-full rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800">
                    Tomar ruta troncal
                  </Link>
                ) : (
                  <Link href={`/dashboard/routes/${primaryRoute.id}`} className="w-full rounded-md border border-brand-300 bg-brand-50 px-3 py-2 text-center text-sm font-medium text-brand-700">
                    Ver ruta troncal
                  </Link>
                )
              )}
            </div>
          </article>
        ))}
      </section>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div id="routes-list" className="scroll-mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Lista operativa</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedCorridor?.name ?? 'Todas las rutas publicadas'}</h2>
            <p className="text-sm text-slate-600">{selectedCorridor ? (isDriver ? selectedCorridor.driverHint : selectedCorridor.passengerHint) : 'Filtra por destino fuerte o busca por municipio para elegir mas rapido.'}</p>
          </div>
          {visibleGroupedRoutes.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">No hay rutas activas por ahora. Admin debe publicar rutas piloto reales antes de iniciar la operacion.</p>
          ) : (
            visibleGroupedRoutes.map((group) => (
              <section key={group.corridorName} className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold text-slate-900">{group.corridorName}</h2>
                  <p className="text-sm text-slate-600">{group.routes.length} rutas publicadas en este corredor.</p>
                </div>

                <div className="space-y-4">
                  {[...group.routes]
                    .sort((a, b) => {
                      const aCount = a.activeDriversCount ?? 0;
                      const bCount = b.activeDriversCount ?? 0;
                      const priorityA = selectedCorridor && a.templateKey === selectedCorridor.primaryTemplateKey ? 2 : isPriorityIndiosVerdesRoute(a) ? 1 : 0;
                      const priorityB = selectedCorridor && b.templateKey === selectedCorridor.primaryTemplateKey ? 2 : isPriorityIndiosVerdesRoute(b) ? 1 : 0;
                      if (priorityA !== priorityB) return priorityB - priorityA;
                      const activityDiff = routeActivityTimestamp(b) - routeActivityTimestamp(a);
                      if (activityDiff !== 0) return activityDiff;
                      return isDriver ? aCount - bCount : bCount - aCount;
                    })
                    .map((route) => {
                      const corridor = inferRouteCorridor(route);
                      const alreadyTaken = offerRouteIds.has(route.id);
                      const activeDrivers = route.activeDriversCount ?? 0;

                      return (
                        <article key={route.id} className={`rounded-xl border p-3 shadow-sm ${isPriorityIndiosVerdesRoute(route) ? 'border-brand-300 bg-gradient-to-br from-white to-blue-50' : 'border-slate-200 bg-white'}`}>
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
                            badge={route.templateKey === corridor.primaryTemplateKey ? 'Ruta troncal recomendada' : isPriorityIndiosVerdesRoute(route) ? 'Ruta prioritaria' : corridor.tagline}
                            tone={isPriorityIndiosVerdesRoute(route) ? 'priority' : 'default'}
                          />

                          {renderRouteActions(route, alreadyTaken)}

                          {isDriver && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs text-slate-600">
                                {activeDrivers <= 1
                                  ? 'Oportunidad alta: poca competencia en esta ruta.'
                                  : activeDrivers <= 3
                                    ? 'Oportunidad media: demanda estable en esta ruta.'
                                    : 'Competencia alta: revisa si te conviene por horario y zona.'}
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                {alreadyTaken ? (
                                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Ruta ya tomada</span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">Disponible para tomar</span>
                                )}

                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                </div>
              </section>
            ))
          )}
        </div>

        <ContextHelpPanel
          title="Guia de operacion"
          subtitle="Flujo simple"
          points={[
            '1) Admin publica rutas piloto con municipio, poblado libre, referencia y horario.',
            '2) Chofer pulsa Tomar ruta y personaliza su viaje.',
            '3) Pasajero elige conductor por referencia, horario y precio.',
            '4) Mantener puntos de abordaje claros y seguros.'
          ]}
          nextStep={
            isDriver
              ? 'Elige una ruta y pulsa Tomar ruta.'
              : isPassenger
                ? 'Abre una ruta y compara conductores disponibles.'
                : 'Publica y supervisa rutas desde admin.'
          }
          ctaHref={isAdmin ? '/dashboard/admin' : '/dashboard'}
          ctaLabel={isAdmin ? 'Ir a panel admin' : 'Volver al dashboard'}
        />
      </div>
    </section>
  );
}
