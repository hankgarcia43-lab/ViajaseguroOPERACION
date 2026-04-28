'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { CDMX_ALCALDIAS, CDMX_DESTINATION_HUBS, EDOMEX_MUNICIPALITIES, ROUTE_SERVICE_SCOPE_OPTIONS, RouteServiceScope } from '@/lib/route-location-options';

type AdminRoute = {
  id: string;
  publicId: number | null;
  title: string | null;
  origin: string;
  destination: string;
  departureTime: string;
  estimatedArrivalTime: string;
  availableSeats: number;
  distanceKm: number;
  pricePerSeat: number;
  stopsText: string | null;
  status: string;
  createdAt: string;
};

type BulkDeleteResponse = {
  total: number;
  deletedCount: number;
  blockedCount: number;
  results: Array<{ routeId: string; deleted: boolean; message: string }>;
};

type Region = 'edomex' | 'cdmx';

function originOptionsByRegion(region: Region) {
  return region === 'edomex' ? EDOMEX_MUNICIPALITIES : CDMX_ALCALDIAS;
}

function destinationOptionsByRegion(region: Region) {
  return region === 'edomex' ? EDOMEX_MUNICIPALITIES : CDMX_DESTINATION_HUBS;
}

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [busyRouteAction, setBusyRouteAction] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [originRegion, setOriginRegion] = useState<Region>('edomex');
  const [destinationRegion, setDestinationRegion] = useState<Region>('cdmx');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [serviceScope, setServiceScope] = useState<RouteServiceScope>('edomex_to_cdmx');
  const [description, setDescription] = useState('');

  const originOptions = useMemo(() => originOptionsByRegion(originRegion), [originRegion]);
  const destinationOptions = useMemo(() => destinationOptionsByRegion(destinationRegion), [destinationRegion]);

  const allVisibleSelected = routes.length > 0 && routes.every((route) => selectedRouteIds.includes(route.id));

  async function loadRoutes() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<AdminRoute[]>('/admin/routes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoutes(data);
      setSelectedRouteIds((prev) => prev.filter((id) => data.some((route) => route.id === id)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las rutas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoutes();
  }, []);

  useEffect(() => {
    setOrigin('');
  }, [originRegion]);

  useEffect(() => {
    setDestination('');
  }, [destinationRegion]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!origin.trim() || !destination.trim()) {
      setError('Punto de inicio y destino son obligatorios.');
      return;
    }

    const parsedPrice = Number(pricePerSeat);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 1 || parsedPrice > 500) {
      setError('El precio por asiento debe estar entre 1 y 500.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest('/admin/routes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          origin,
          destination,
          pricePerSeat: parsedPrice,
          serviceScope,
          description: description.trim() || undefined
        })
      });

      setSuccess('Ruta principal creada correctamente. Ya puede aparecer en el feed para ser tomada por conductores.');
      setOrigin('');
      setDestination('');
      setPricePerSeat('');
      setServiceScope('edomex_to_cdmx');
      setDescription('');
      await loadRoutes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la ruta.');
    } finally {
      setSaving(false);
    }
  }

  function toggleRouteSelection(routeId: string) {
    setSelectedRouteIds((prev) => (prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId]));
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedRouteIds((prev) => prev.filter((id) => !routes.some((route) => route.id === id)));
      return;
    }
    setSelectedRouteIds((prev) => {
      const merged = new Set(prev);
      routes.forEach((route) => merged.add(route.id));
      return Array.from(merged);
    });
  }

  async function handleDeleteRoute(routeId: string) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    const confirmDelete = window.confirm('Esta accion eliminara la ruta seleccionada. Deseas continuar?');
    if (!confirmDelete) {
      return;
    }

    setDeletingRouteId(routeId);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/admin/routes/${routeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Ruta eliminada correctamente.');
      await loadRoutes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar la ruta.');
    } finally {
      setDeletingRouteId(null);
    }
  }

  async function handleBulkDelete() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }
    if (selectedRouteIds.length === 0) {
      setError('Selecciona al menos una ruta para eliminar.');
      return;
    }

    const confirmDelete = window.confirm(
      `Se eliminaran ${selectedRouteIds.length} rutas seleccionadas. Las rutas con dependencias activas se bloquearan automaticamente. Continuar?`
    );
    if (!confirmDelete) {
      return;
    }

    setBulkDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiRequest<BulkDeleteResponse>('/admin/routes/bulk-delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ routeIds: selectedRouteIds })
      });

      setSuccess(
        `Proceso completado: ${response.deletedCount} eliminadas, ${response.blockedCount} bloqueadas por seguridad de datos.`
      );
      const blockedMessages = response.results.filter((item) => !item.deleted).map((item) => item.message);
      if (blockedMessages.length > 0) {
        setError(blockedMessages.slice(0, 2).join(' | '));
      }
      setSelectedRouteIds([]);
      await loadRoutes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo ejecutar el borrado multiple.');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleQuickEdit(route: AdminRoute) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    const nextDeparture = window.prompt('Nueva hora de salida (HH:mm):', route.departureTime)?.trim();
    if (!nextDeparture) return;
    if (!HHMM_REGEX.test(nextDeparture)) {
      setError('La hora de salida debe tener formato HH:mm.');
      return;
    }

    const nextArrival = window.prompt('Nueva hora estimada de llegada (HH:mm):', route.estimatedArrivalTime)?.trim();
    if (!nextArrival) return;
    if (!HHMM_REGEX.test(nextArrival)) {
      setError('La hora de llegada debe tener formato HH:mm.');
      return;
    }

    const nextPriceRaw = window.prompt('Nuevo precio por asiento (1 a 500):', route.pricePerSeat.toFixed(2))?.trim();
    if (!nextPriceRaw) return;
    const nextPrice = Number(nextPriceRaw);
    if (!Number.isFinite(nextPrice) || nextPrice < 1 || nextPrice > 500) {
      setError('El precio por asiento debe estar entre 1 y 500.');
      return;
    }

    setBusyRouteAction(`edit:${route.id}`);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/admin/routes/${route.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          departureTime: nextDeparture,
          estimatedArrivalTime: nextArrival,
          pricePerSeat: nextPrice
        })
      });
      setSuccess('Ruta actualizada correctamente (precio y horarios).');
      await loadRoutes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar la ruta.');
    } finally {
      setBusyRouteAction(null);
    }
  }

  async function handleToggleStatus(route: AdminRoute) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    const routeIsActive = String(route.status).toLowerCase() === 'active';
    const endpoint = routeIsActive ? 'pause' : 'activate';

    setBusyRouteAction(`status:${route.id}`);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/admin/routes/${route.id}/${endpoint}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(routeIsActive ? 'Ruta pausada correctamente.' : 'Ruta activada correctamente.');
      await loadRoutes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cambiar el estado de la ruta.');
    } finally {
      setBusyRouteAction(null);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando rutas admin...</p>;
  }

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin - Rutas principales</h1>
        <p className="mt-2 text-sm text-slate-600">
          Define rutas base del sistema con punto de inicio, destino y precio por asiento (maximo 500 MXN).
        </p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Crear ruta principal</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Region de inicio
              <select
                value={originRegion}
                onChange={(event) => setOriginRegion(event.target.value as Region)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="edomex">Estado de Mexico</option>
                <option value="cdmx">CDMX</option>
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              Punto de inicio
              <select value={origin} onChange={(event) => setOrigin(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="">Selecciona punto de inicio</option>
                {originOptions.map((item) => (
                  <option key={`origin-${item}`} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Region de destino
              <select
                value={destinationRegion}
                onChange={(event) => setDestinationRegion(event.target.value as Region)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="edomex">Estado de Mexico</option>
                <option value="cdmx">CDMX</option>
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              Destino (terminal, hospital o estacion principal)
              <select value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="">Selecciona destino</option>
                {destinationOptions.map((item) => (
                  <option key={`destination-${item}`} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm text-slate-700">
            Tipo de servicio
            <select value={serviceScope} onChange={(event) => setServiceScope(event.target.value as RouteServiceScope)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              {ROUTE_SERVICE_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Precio por asiento (MXN)
            <input
              type="number"
              min={1}
              max={500}
              step="0.01"
              value={pricePerSeat}
              onChange={(event) => setPricePerSeat(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Ej. 35"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Descripcion (opcional)
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={3}
              placeholder="Ej. Ruta laboral con alta demanda"
            />
          </label>

          <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Creando...' : 'Crear ruta'}
          </button>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Guia rapida</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Primero elige region y despues ubicacion exacta.</li>
            <li>Punto de inicio y destino deben ser claros y reales.</li>
            <li>El precio por asiento no puede superar 500 MXN.</li>
            <li>Ahora puedes editar precio y horarios desde cada tarjeta.</li>
          </ul>
          <Link href="/dashboard/routes" className="mt-4 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Ver feed de rutas
          </Link>
        </aside>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Rutas publicadas</h2>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
              Seleccionar visibles
            </label>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedRouteIds.length === 0}
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
            >
              {bulkDeleting ? 'Eliminando...' : `Eliminar seleccionadas (${selectedRouteIds.length})`}
            </button>
          </div>
        </div>

        {routes.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Aun no hay rutas creadas.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {routes.map((route) => {
              const isSelected = selectedRouteIds.includes(route.id);
              const isDeleting = deletingRouteId === route.id;
              const isEditing = busyRouteAction === `edit:${route.id}`;
              const isStatusBusy = busyRouteAction === `status:${route.id}`;
              const routeIsActive = String(route.status).toLowerCase() === 'active';

              return (
                <article key={route.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRouteSelection(route.id)} />
                      Seleccionar
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoute(route.id)}
                      disabled={isDeleting}
                      className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                    >
                      {isDeleting ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Ruta #{route.publicId ?? '-'}</p>
                  <h3 className="text-base font-semibold text-slate-900">{route.title || `${route.origin} -> ${route.destination}`}</h3>
                  <p className="text-sm text-slate-700">{route.origin} {'->'} {route.destination}</p>
                  <p className="text-sm text-slate-700">Horario: {route.departureTime} - {route.estimatedArrivalTime}</p>
                  <p className="text-sm text-slate-700">Distancia: {route.distanceKm.toFixed(2)} km</p>
                  <p className="text-sm text-slate-700">Asientos base: {route.availableSeats}</p>
                  <p className="text-sm font-medium text-slate-900">Precio por asiento: ${route.pricePerSeat.toFixed(2)} MXN</p>
                  <p className="mt-1 text-xs text-slate-600">{route.stopsText || 'Sin descripcion.'}</p>
                  <p className="mt-1 text-xs text-slate-600">Estado: {routeIsActive ? 'Activa' : 'Pausada'}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleQuickEdit(route)}
                      disabled={isEditing}
                      className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-60"
                    >
                      {isEditing ? 'Guardando...' : 'Editar precio/horario'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(route)}
                      disabled={isStatusBusy}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-60"
                    >
                      {isStatusBusy ? 'Actualizando...' : routeIsActive ? 'Pausar ruta' : 'Activar ruta'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

