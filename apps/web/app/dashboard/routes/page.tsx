'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { apiRequest, getSessionRole, getToken } from '@/lib/api';
import { inferRouteCorridor, ROUTE_CORRIDORS } from '@/lib/route-corridors';
import { BaseRouteSummary, RouteOffer } from '@/lib/route-offers';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('norte-indios-verdes');

  const role = me?.role ?? sessionRole;
  const isDriver = role === 'driver';
  const isPassenger = role === 'passenger';
  const isAdmin = role === 'admin';

  const offerRouteIds = useMemo(() => new Set(myOffers.map((offer) => offer.routeId)), [myOffers]);

  const groupedRoutes = useMemo(() => {
    const bucket = new Map<string, { corridorName: string; order: number; routes: BaseRouteSummary[] }>();

    for (const route of routes) {
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
  }, [routes]);

  const corridorSummary = useMemo(() => {
    return ROUTE_CORRIDORS.map((corridor) => {
      const routesInCorridor = routes.filter((route) => inferRouteCorridor(route).id === corridor.id);
      const driverCount = routesInCorridor.reduce((acc, route) => acc + (route.activeDriversCount ?? 0), 0);
      return { corridor, count: routesInCorridor.length, driverCount };
    });
  }, [routes]);

  const selectedCorridor = useMemo(
    () => ROUTE_CORRIDORS.find((corridor) => corridor.id === selectedCorridorId) ?? ROUTE_CORRIDORS[0],
    [selectedCorridorId]
  );

  const visibleGroupedRoutes = useMemo(() => {
    if (!selectedCorridor) return groupedRoutes;
    return groupedRoutes.filter((group) => group.corridorName === selectedCorridor.name);
  }, [groupedRoutes, selectedCorridor]);

  const priorityRoutes = useMemo(() => {
    return routes
      .filter(isPriorityIndiosVerdesRoute)
      .sort((a, b) => (a.title ?? a.origin).localeCompare(b.title ?? b.origin));
  }, [routes]);

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
        const offers = await apiRequest<RouteOffer[]>('/route-offers/my-offers', { headers });
        setMyOffers(offers);
      } else {
        setMyOffers([]);
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

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {priorityRoutes.slice(0, 6).map((route) => {
              const alreadyTaken = offerRouteIds.has(route.id);
              return (
                <article key={`priority-${route.id}`} className="rounded-xl border border-white bg-white/90 p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">{route.title || `${route.origin} -> ${route.destination}`}</h3>
                  <p className="mt-1 text-xs text-slate-600">{route.origin} {'->'} {route.destination}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <span className="rounded-md bg-slate-50 px-2 py-1">Salida: {route.departureTime}</span>
                    <span className="rounded-md bg-slate-50 px-2 py-1">Llegada: {route.estimatedArrivalTime}</span>
                    <span className="rounded-md bg-slate-50 px-2 py-1">{route.distanceKm.toFixed(1)} km</span>
                    <span className="rounded-md bg-slate-50 px-2 py-1">${route.pricePerSeat.toFixed(2)} MXN</span>
                  </div>
                  {route.stopsText && <p className="mt-3 line-clamp-3 text-xs text-slate-600">{route.stopsText}</p>}
                  {renderRouteActions(route, alreadyTaken)}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {corridorSummary.map(({ corridor, count, driverCount }) => (
          <article key={corridor.id} className={`rounded-xl border p-4 shadow-sm ${selectedCorridorId === corridor.id ? 'border-brand-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{corridor.routeTypeLabel}</p>
            <h2 className="mt-2 text-base font-semibold text-slate-900">{corridor.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{corridor.municipalities}</p>
            <p className="text-sm text-slate-700">Destino fuerte: {corridor.destinationHub}</p>
            <p className="mt-2 text-xs text-slate-500">{corridor.description}</p>
            <p className="mt-2 text-xs font-medium text-emerald-700">Rutas publicadas: {count}</p>
            <p className="mt-1 text-xs font-medium text-cyan-700">Conductores activos: {driverCount}</p>
            <button type="button" onClick={() => selectCorridor(corridor.id)} className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
              Ver rutas del corredor
            </button>
          </article>
        ))}
      </section>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div id="routes-list" className="scroll-mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Lista operativa</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedCorridor?.name ?? 'Rutas publicadas'}</h2>
            <p className="text-sm text-slate-600">Abre una ruta para reservar como pasajero o tomala como conductor para publicar horarios, asientos y punto de abordaje.</p>
          </div>
          {visibleGroupedRoutes.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">No hay rutas activas por ahora.</p>
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
                      const priorityA = isPriorityIndiosVerdesRoute(a) ? 1 : 0;
                      const priorityB = isPriorityIndiosVerdesRoute(b) ? 1 : 0;
                      if (priorityA !== priorityB) return priorityB - priorityA;
                      return isDriver ? aCount - bCount : bCount - aCount;
                    })
                    .map((route) => {
                      const corridor = inferRouteCorridor(route);
                      const alreadyTaken = offerRouteIds.has(route.id);
                      const activeDrivers = route.activeDriversCount ?? 0;

                      return (
                        <article key={route.id} className={`rounded-xl border p-5 shadow-sm ${isPriorityIndiosVerdesRoute(route) ? 'border-brand-300 bg-gradient-to-br from-white to-blue-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{corridor.tagline}</p>
                              <h3 className="mt-1 text-lg font-semibold text-slate-900">{route.title || `${route.origin} -> ${route.destination}`}</h3>
                              <p className="text-sm text-slate-600">{route.origin} {'->'} {route.destination}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {isPriorityIndiosVerdesRoute(route) && <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">Ruta prioritaria</span>}
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{corridor.destinationHub}</span>
                            </div>
                          </div>

                          <p className="mt-2 text-sm text-slate-700">Horario base: {route.departureTime} - {route.estimatedArrivalTime}</p>
                          <p className="text-sm text-slate-700">Distancia aprox: {route.distanceKm.toFixed(2)} km</p>
                          <p className="text-sm font-medium text-slate-900">Precio por asiento: ${route.pricePerSeat.toFixed(2)} MXN</p>
                          <p className="text-sm text-slate-700">Conductores activos en esta ruta: <span className="font-semibold text-slate-900">{activeDrivers}</span></p>
                          {route.stopsText && (
                            <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-xs text-cyan-950">
                              <p className="font-semibold">Puntos especificos para operar esta ruta</p>
                              <p className="mt-1">{route.stopsText}</p>
                            </div>
                          )}

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
            '1) Admin publica rutas base por corredor.',
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
