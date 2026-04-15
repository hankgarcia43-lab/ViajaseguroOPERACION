'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getSessionRole, getToken } from '@/lib/api';
import { inferRouteCorridor } from '@/lib/route-corridors';
import { BaseRouteSummary, RouteOffer } from '@/lib/route-offers';

type UserRole = 'passenger' | 'driver' | 'admin';

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

function formatWeekdays(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return 'No definido';
  }

  return values.map((value) => WEEKDAY_LABELS[value] ?? value).join(', ');
}

export default function SearchTripsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  const [routes, setRoutes] = useState<BaseRouteSummary[]>([]);
  const [myOffers, setMyOffers] = useState<RouteOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const role = me?.role ?? sessionRole;
  const isDriver = role === 'driver';
  const isPassenger = role === 'passenger';
  const isAdmin = role === 'admin';
  const offerRouteIds = useMemo(() => new Set(myOffers.map((offer) => offer.routeId)), [myOffers]);

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

  if (loading) {
    return <p className="text-slate-700">Cargando feed de rutas publicadas...</p>;
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Feed principal de rutas</h1>
            <p className="text-sm text-slate-600">Rutas preestablecidas para una operacion clara entre usuario, conductor y admin.</p>
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Rutas publicadas: <span className="font-semibold text-slate-900">{routes.length}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Mi rol actual: <span className="font-semibold text-slate-900">{role ?? 'No disponible'}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Modo: <span className="font-semibold text-slate-900">Rutas preestablecidas</span></div>
        </div>
      </div>

      {isDriver && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Toma de rutas rapida para conductores</p>
          <p className="mt-1">Te mostramos primero rutas con menor competencia para ayudarte a decidir mas rapido.</p>
        </div>
      )}
      {isPassenger && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
          <p className="font-semibold">Reserva semanal recomendada</p>
          <p className="mt-1">Si viajas al trabajo cada semana, reserva varios dias para asegurar tu lugar y mantener un traslado mas estable.</p>
        </div>
      )}

      {error && (<div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700"><p>{error}</p><p className="text-sm">Si estas en local y no levantaste API en el puerto 4000, la app intentara usar el respaldo remoto automaticamente.</p></div>)}

      {routes.length === 0 ? (!error ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-base font-semibold">No hay rutas cercanas o publicadas para tu zona.</p>
          <p className="text-sm">Aun no hay rutas publicadas para esta zona. Revisa de nuevo en unos minutos o consulta otro corredor disponible.</p>
          {(isDriver || isAdmin) && (
            <Link href="/dashboard/routes/create" className="inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white">
              Crear ruta ahora
            </Link>
          )}
        </div>
      ) : null) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...routes]
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{corridor.routeTypeLabel}</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">{route.title || `${route.origin} -> ${route.destination}`}</h2>
                      <p className="text-sm text-slate-600">{route.origin} {'->'} {route.destination}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Ruta publicada</span>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="text-slate-700">Horario: <span className="font-semibold text-slate-900">{route.departureTime} - {route.estimatedArrivalTime}</span></p>
                    <p className="text-slate-700">Dias: <span className="font-semibold text-slate-900">{formatWeekdays(route.weekdays)}</span></p>
                    <p className="text-slate-700">Punto de abordaje: <span className="font-semibold text-slate-900">{route.stopsText || 'Definelo al tomar la ruta'}</span></p>
                    <p className="text-slate-700">Pueblo o direccion base: <span className="font-semibold text-slate-900">{route.origin}</span></p>
                  </div>

                  <div className="mt-3 grid gap-1 text-sm">
                    <p className="text-slate-700">Distancia aprox: <span className="font-medium text-slate-900">{route.distanceKm.toFixed(2)} km</span></p>
                    <p className="text-slate-700">Precio por asiento: <span className="font-semibold text-slate-900">${route.pricePerSeat.toFixed(2)} MXN</span></p>
                    <p className="text-slate-700">Conductores activos: <span className="font-semibold text-slate-900">{activeDrivers}</span></p>
                  </div>

                  {isDriver && (
                    <p className="mt-2 text-xs text-slate-600">
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
                        Ver conductores disponibles
                      </Link>
                    ) : isDriver ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {alreadyTaken && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Ruta ya tomada</span>}
                        <Link href={`/dashboard/routes/${route.id}/take`} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                          {alreadyTaken ? 'Editar datos de mi viaje' : 'Tomar ruta'}
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
          <p className="mt-1">Mantener horarios claros, abordajes visibles y rutas consistentes facilita que pasajeros y conductores decidan mas rapido.</p>
        </div>
      )}
    </section>
  );
}
