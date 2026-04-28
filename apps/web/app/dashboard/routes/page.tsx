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

export default function RoutesPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  const [routes, setRoutes] = useState<BaseRouteSummary[]>([]);
  const [myOffers, setMyOffers] = useState<RouteOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            : 'Explora corredores claros y elige la mejor opcion segun destino, horario y precio.'}
        </p>
        {(isDriver || isAdmin) && (
          <div className="mt-3">
            <Link href="/dashboard/routes/create" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">
              Crear mi ruta para trabajar
            </Link>
          </div>
        )}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {corridorSummary.map(({ corridor, count, driverCount }) => (
          <article key={corridor.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{corridor.routeTypeLabel}</p>
            <h2 className="mt-2 text-base font-semibold text-slate-900">{corridor.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{corridor.municipalities}</p>
            <p className="text-sm text-slate-700">Destino fuerte: {corridor.destinationHub}</p>
            <p className="mt-2 text-xs text-slate-500">{corridor.description}</p>
            <p className="mt-2 text-xs font-medium text-emerald-700">Rutas publicadas: {count}</p>
            <p className="mt-1 text-xs font-medium text-cyan-700">Conductores activos: {driverCount}</p>
          </article>
        ))}
      </section>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {groupedRoutes.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">No hay rutas activas por ahora.</p>
          ) : (
            groupedRoutes.map((group) => (
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
                      return isDriver ? aCount - bCount : bCount - aCount;
                    })
                    .map((route) => {
                      const corridor = inferRouteCorridor(route);
                      const alreadyTaken = offerRouteIds.has(route.id);
                      const activeDrivers = route.activeDriversCount ?? 0;

                      return (
                        <article key={route.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{corridor.tagline}</p>
                              <h3 className="mt-1 text-lg font-semibold text-slate-900">{route.title || `${route.origin} -> ${route.destination}`}</h3>
                              <p className="text-sm text-slate-600">{route.origin} {'->'} {route.destination}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{corridor.destinationHub}</span>
                          </div>

                          <p className="mt-2 text-sm text-slate-700">Horario base: {route.departureTime} - {route.estimatedArrivalTime}</p>
                          <p className="text-sm text-slate-700">Distancia aprox: {route.distanceKm.toFixed(2)} km</p>
                          <p className="text-sm font-medium text-slate-900">Precio por asiento: ${route.pricePerSeat.toFixed(2)} MXN</p>
                          <p className="text-sm text-slate-700">Conductores activos en esta ruta: <span className="font-semibold text-slate-900">{activeDrivers}</span></p>
                          {route.stopsText && <p className="text-xs text-slate-600">{route.stopsText}</p>}

                          {isPassenger && (
                            <div className="mt-4">
                              <Link href={`/dashboard/routes/${route.id}`} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">
                                Ver conductores disponibles
                              </Link>
                            </div>
                          )}

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
                                <Link href={`/dashboard/routes/${route.id}/take`} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                                  {alreadyTaken ? 'Editar datos de mi viaje' : 'Tomar ruta'}
                                </Link>
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
