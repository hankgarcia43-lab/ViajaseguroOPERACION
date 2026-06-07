'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { estimateRouteDistanceKm } from '@/lib/route-distance-estimator';

type AdminRoute = {
  id: string;
  publicId: number | null;
  title: string | null;
  origin: string;
  destination: string;
  weekdays?: Weekday[];
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

type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type RouteStatus = 'active' | 'paused';

const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string }> = [
  { value: 'monday', label: 'Lun' },
  { value: 'tuesday', label: 'Mar' },
  { value: 'wednesday', label: 'Mie' },
  { value: 'thursday', label: 'Jue' },
  { value: 'friday', label: 'Vie' },
  { value: 'saturday', label: 'Sab' },
  { value: 'sunday', label: 'Dom' }
];

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatWeekdays(weekdays?: Weekday[]) {
  if (!weekdays?.length) return 'Sin dias definidos';
  const labels = new Map(WEEKDAY_OPTIONS.map((item) => [item.value, item.label]));
  return weekdays.map((weekday) => labels.get(weekday) ?? weekday).join(', ');
}

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

  const [title, setTitle] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [stopsText, setStopsText] = useState('');
  const [weekdays, setWeekdays] = useState<Weekday[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [departureTime, setDepartureTime] = useState('06:00');
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('07:00');
  const [availableSeats, setAvailableSeats] = useState('4');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [status, setStatus] = useState<RouteStatus>('active');

  const estimatedDistanceKm = useMemo(() => (origin.trim() && destination.trim() ? estimateRouteDistanceKm(origin, destination) : null), [origin, destination]);
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

  function toggleWeekday(day: Weekday) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]));
  }

  function resetForm() {
    setTitle('');
    setOrigin('');
    setDestination('');
    setStopsText('');
    setWeekdays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    setDepartureTime('06:00');
    setEstimatedArrivalTime('07:00');
    setAvailableSeats('4');
    setPricePerSeat('');
    setStatus('active');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    const parsedPrice = Number(pricePerSeat);
    const parsedSeats = Number(availableSeats);

    if (!origin.trim() || !destination.trim()) {
      setError('Origen y destino son obligatorios.');
      return;
    }
    if (weekdays.length === 0) {
      setError('Selecciona al menos un dia de operacion.');
      return;
    }
    if (!HHMM_REGEX.test(departureTime) || !HHMM_REGEX.test(estimatedArrivalTime)) {
      setError('Los horarios deben tener formato HH:mm.');
      return;
    }
    if (!Number.isInteger(parsedSeats) || parsedSeats < 1 || parsedSeats > 20) {
      setError('Los asientos deben estar entre 1 y 20.');
      return;
    }
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
          title: title.trim() || undefined,
          origin: origin.trim(),
          destination: destination.trim(),
          stopsText: stopsText.trim() || undefined,
          weekdays,
          departureTime,
          estimatedArrivalTime,
          availableSeats: parsedSeats,
          pricePerSeat: parsedPrice,
          status
        })
      });

      setSuccess('Ruta creada correctamente.');
      resetForm();
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
    setSelectedRouteIds((prev) => Array.from(new Set([...prev, ...routes.map((route) => route.id)])));
  }

  async function handleDeleteRoute(routeId: string) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!window.confirm('Eliminar esta ruta? Si tiene reservas o viajes historicos, el sistema bloqueara el borrado.')) {
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
    if (!window.confirm(`Eliminar ${selectedRouteIds.length} rutas seleccionadas?`)) {
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

      setSuccess(`Proceso completado: ${response.deletedCount} eliminadas, ${response.blockedCount} bloqueadas.`);
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
      setSuccess('Ruta actualizada correctamente.');
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
        <h1 className="text-2xl font-semibold text-slate-900">Admin - Control de rutas</h1>
        <p className="mt-2 text-sm text-slate-600">Crea solo rutas reales del piloto y elimina cualquier ruta que no deba operar.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Crear ruta especifica</h2>

          <label className="block text-sm text-slate-700">
            Nombre interno de ruta
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Ej. Piloto Ecatepec - Indios Verdes 6 AM"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Origen exacto
              <input
                type="text"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ej. Ojo de Agua, Tecamac"
                required
              />
            </label>
            <label className="block text-sm text-slate-700">
              Destino exacto
              <input
                type="text"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ej. Indios Verdes CETRAM"
                required
              />
            </label>
          </div>

          <label className="block text-sm text-slate-700">
            Punto de abordaje y notas operativas
            <textarea
              value={stopsText}
              onChange={(event) => setStopsText(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={3}
              placeholder="Ej. Punto inicial, referencias, paradas autorizadas, reglas del piloto"
            />
          </label>

          <div className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">
            <p className="font-medium">Distancia estimada</p>
            <p>{estimatedDistanceKm ? `${estimatedDistanceKm.toFixed(1)} km aprox.` : 'Completa origen y destino.'}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Dias de operacion</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => (
                <label key={day.value} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={weekdays.includes(day.value)} onChange={() => toggleWeekday(day.value)} />
                  {day.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm text-slate-700">
              Salida
              <input type="time" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              Llegada estimada
              <input type="time" value={estimatedArrivalTime} onChange={(event) => setEstimatedArrivalTime(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              Asientos
              <input type="number" min={1} max={20} step={1} value={availableSeats} onChange={(event) => setAvailableSeats(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              Precio por asiento
              <input type="number" min={1} max={500} step="0.01" value={pricePerSeat} onChange={(event) => setPricePerSeat(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="40" />
            </label>
          </div>

          <label className="block text-sm text-slate-700">
            Estado inicial
            <select value={status} onChange={(event) => setStatus(event.target.value as RouteStatus)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="active">Activa</option>
              <option value="paused">Pausada</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Creando...' : 'Crear ruta'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Limpiar
            </button>
          </div>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Piloto controlado</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>Rutas activas: <span className="font-semibold text-slate-900">{routes.filter((route) => String(route.status).toLowerCase() === 'active').length}</span></p>
            <p>Rutas pausadas: <span className="font-semibold text-slate-900">{routes.filter((route) => String(route.status).toLowerCase() !== 'active').length}</span></p>
            <p>Total publicado: <span className="font-semibold text-slate-900">{routes.length}</span></p>
          </div>
          <Link href="/dashboard/routes" className="mt-4 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Ver feed de rutas
          </Link>
        </aside>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Rutas creadas</h2>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
              Seleccionar visibles
            </label>
            <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting || selectedRouteIds.length === 0} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60">
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
                    <button type="button" onClick={() => handleDeleteRoute(route.id)} disabled={isDeleting} className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60">
                      {isDeleting ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Ruta #{route.publicId ?? '-'}</p>
                  <h3 className="text-base font-semibold text-slate-900">{route.title || `${route.origin} -> ${route.destination}`}</h3>
                  <p className="text-sm text-slate-700">{route.origin} {'->'} {route.destination}</p>
                  <p className="text-sm text-slate-700">Dias: {formatWeekdays(route.weekdays)}</p>
                  <p className="text-sm text-slate-700">Horario: {route.departureTime} - {route.estimatedArrivalTime}</p>
                  <p className="text-sm text-slate-700">Distancia: {route.distanceKm.toFixed(2)} km</p>
                  <p className="text-sm text-slate-700">Asientos: {route.availableSeats}</p>
                  <p className="text-sm font-medium text-slate-900">Precio por asiento: ${route.pricePerSeat.toFixed(2)} MXN</p>
                  <p className="mt-1 text-xs text-slate-600">{route.stopsText || 'Sin notas operativas.'}</p>
                  <p className="mt-1 text-xs text-slate-600">Estado: {routeIsActive ? 'Activa' : 'Pausada'}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleQuickEdit(route)} disabled={isEditing} className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-60">
                      {isEditing ? 'Guardando...' : 'Editar precio/horario'}
                    </button>
                    <button type="button" onClick={() => void handleToggleStatus(route)} disabled={isStatusBusy} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-60">
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