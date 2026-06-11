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
  maxAllowedPrice?: number | null;
  fareRatePerKmApplied?: number | null;
  stopsText: string | null;
  status: string;
  createdAt: string;
};

type FarePolicyLite = {
  mode: string;
  ratePerKm: number;
  currency: string;
} | null;

type BulkDeleteResponse = {
  total: number;
  deletedCount: number;
  blockedCount: number;
  results: Array<{ routeId: string; deleted: boolean; message: string }>;
};

type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type RouteStatus = 'active' | 'paused';

type PilotOrigin = {
  municipality: string;
  towns: Array<{ label: string; value: string }>;
};

type PilotDestination = {
  delegation: string;
  options: Array<{ label: string; value: string }>;
};

const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string }> = [
  { value: 'monday', label: 'Lun' },
  { value: 'tuesday', label: 'Mar' },
  { value: 'wednesday', label: 'Mie' },
  { value: 'thursday', label: 'Jue' },
  { value: 'friday', label: 'Vie' },
  { value: 'saturday', label: 'Sab' },
  { value: 'sunday', label: 'Dom' }
];

const PILOT_ORIGINS: PilotOrigin[] = [
  {
    municipality: 'Acolman',
    towns: [
      { label: 'Acolman Centro', value: 'Acolman - Centro' },
      { label: 'Tepexpan', value: 'Acolman - Tepexpan' },
      { label: 'San Marcos Nepantla', value: 'Acolman - San Marcos Nepantla' }
    ]
  },
  {
    municipality: 'Ecatepec',
    towns: [
      { label: 'San Cristobal Centro', value: 'Ecatepec - San Cristobal Centro' },
      { label: 'Las Americas', value: 'Ecatepec - Las Americas' },
      { label: 'Ciudad Azteca', value: 'Ecatepec - Ciudad Azteca' },
      { label: 'Via Morelos', value: 'Ecatepec - Via Morelos' }
    ]
  },
  {
    municipality: 'Tecamac',
    towns: [
      { label: 'Tecamac Centro', value: 'Tecamac - Centro' },
      { label: 'Ojo de Agua', value: 'Tecamac - Ojo de Agua' },
      { label: 'Los Heroes Tecamac', value: 'Tecamac - Los Heroes' }
    ]
  },
  {
    municipality: 'Texcoco',
    towns: [
      { label: 'Texcoco Centro', value: 'Texcoco - Centro' },
      { label: 'Terminal Texcoco Centro', value: 'Texcoco - Terminal Centro' }
    ]
  },
  {
    municipality: 'Teotihuacan',
    towns: [
      { label: 'San Juan Teotihuacan', value: 'Teotihuacan - San Juan' },
      { label: 'Teotihuacan Centro', value: 'Teotihuacan - Centro' },
      { label: 'Zona Piramides', value: 'Teotihuacan - Piramides' }
    ]
  }
];

const PILOT_DESTINATIONS: PilotDestination[] = [
  {
    delegation: 'Gustavo A. Madero',
    options: [
      { label: 'Indios Verdes CETRAM', value: 'Gustavo A. Madero - Indios Verdes (CETRAM)' },
      { label: 'Martin Carrera Metro', value: 'Gustavo A. Madero - Martin Carrera (Metro)' },
      { label: 'La Raza Metro / Hospital', value: 'Gustavo A. Madero - La Raza (Metro/Hospital)' },
      { label: 'Politecnico Metro', value: 'Gustavo A. Madero - Politecnico (Metro)' }
    ]
  },
  {
    delegation: 'Venustiano Carranza',
    options: [
      { label: 'Pantitlan CETRAM', value: 'Venustiano Carranza - Pantitlan (CETRAM)' },
      { label: 'San Lazaro Metro / TAPO', value: 'Venustiano Carranza - San Lazaro (Metro/TAPO)' }
    ]
  },
  {
    delegation: 'Cuauhtemoc',
    options: [
      { label: 'Buenavista Suburbano / Metrobus', value: 'Cuauhtemoc - Buenavista (Suburbano/Metrobus)' },
      { label: 'Hidalgo Metro', value: 'Cuauhtemoc - Hidalgo (Metro)' }
    ]
  },
  {
    delegation: 'Azcapotzalco / Miguel Hidalgo',
    options: [
      { label: 'El Rosario CETRAM', value: 'Azcapotzalco - El Rosario (CETRAM)' },
      { label: 'Tacuba Metro', value: 'Miguel Hidalgo - Tacuba (Metro)' }
    ]
  }
];

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_UI_RATE_PER_KM = 2.5;

function formatWeekdays(weekdays?: Weekday[]) {
  if (!weekdays?.length) return 'Sin dias definidos';
  const labels = new Map(WEEKDAY_OPTIONS.map((item) => [item.value, item.label]));
  return weekdays.map((weekday) => labels.get(weekday) ?? weekday).join(', ');
}

function getTowns(municipality: string) {
  return PILOT_ORIGINS.find((item) => item.municipality === municipality)?.towns ?? [];
}

function getDestinationOptions() {
  return PILOT_DESTINATIONS.flatMap((group) => group.options.map((option) => ({ ...option, group: group.delegation })));
}

function inferMunicipality(origin: string) {
  const normalized = origin.toLowerCase();
  return PILOT_ORIGINS.find((item) => normalized.includes(item.municipality.toLowerCase()))?.municipality ?? PILOT_ORIGINS[0].municipality;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFive(value: number) {
  return Math.max(1, Math.min(500, Math.ceil(value / 5) * 5));
}

function addMinutesToTime(time: string, minutes: number) {
  if (!HHMM_REGEX.test(time)) return '07:00';
  const [hours, mins] = time.split(':').map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  const nextHours = Math.floor(total / 60).toString().padStart(2, '0');
  const nextMinutes = (total % 60).toString().padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [farePolicy, setFarePolicy] = useState<FarePolicyLite>(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [busyRouteAction, setBusyRouteAction] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [municipality, setMunicipality] = useState(PILOT_ORIGINS[0].municipality);
  const [originTown, setOriginTown] = useState('');
  const [destination, setDestination] = useState(PILOT_DESTINATIONS[0].options[0].value);
  const [boardingReference, setBoardingReference] = useState('');
  const [weekdays, setWeekdays] = useState<Weekday[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [departureTime, setDepartureTime] = useState('06:00');
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('07:00');
  const [availableSeats, setAvailableSeats] = useState('4');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [status, setStatus] = useState<RouteStatus>('active');


  const destinationOptions = useMemo(() => {
    const options = getDestinationOptions();
    if (options.some((item) => item.value === destination)) return options;
    return [...options, { label: destination, value: destination, group: 'Ruta existente' }];
  }, [destination]);

  const composedOrigin = useMemo(() => {
    const trimmedTown = originTown.trim();
    if (!trimmedTown) return municipality;
    return trimmedTown.toLowerCase().includes(municipality.toLowerCase()) ? trimmedTown : `${municipality} - ${trimmedTown}`;
  }, [municipality, originTown]);
  const townSuggestions = useMemo(() => getTowns(municipality), [municipality]);
  const estimatedDistanceKm = useMemo(() => estimateRouteDistanceKm(composedOrigin, destination), [composedOrigin, destination]);
  const activeRatePerKm = farePolicy?.ratePerKm ?? DEFAULT_UI_RATE_PER_KM;
  const suggestedPrice = useMemo(() => roundToFive(estimatedDistanceKm * activeRatePerKm), [estimatedDistanceKm, activeRatePerKm]);
  const allVisibleSelected = routes.length > 0 && routes.every((route) => selectedRouteIds.includes(route.id));
  const formModeLabel = editingRouteId ? 'Editar ruta' : 'Crear ruta piloto';

  useEffect(() => {
    const minutes = Math.max(35, Math.min(140, Math.round(estimatedDistanceKm * 1.7)));
    setEstimatedArrivalTime(addMinutesToTime(departureTime, minutes));
  }, [departureTime, estimatedDistanceKm]);

  async function loadRoutes() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [routeData, policyData] = await Promise.all([
        apiRequest<AdminRoute[]>('/admin/routes', { headers }),
        apiRequest<FarePolicyLite>('/admin/fare-policy/current', { headers })
      ]);
      setRoutes(routeData);
      setFarePolicy(policyData);
      setSelectedRouteIds((prev) => prev.filter((id) => routeData.some((route) => route.id === id)));
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
    const firstMunicipality = PILOT_ORIGINS[0].municipality;
    setEditingRouteId(null);
    setMunicipality(firstMunicipality);
    setOriginTown('');
    setDestination(PILOT_DESTINATIONS[0].options[0].value);
    setBoardingReference('');
    setWeekdays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    setDepartureTime('06:00');
    setEstimatedArrivalTime('07:00');
    setAvailableSeats('4');
    setPricePerSeat('');
    setStatus('active');
    setError(null);
    setSuccess(null);
  }

  function handleMunicipalityChange(nextMunicipality: string) {
    setMunicipality(nextMunicipality);
    setOriginTown('');
  }

  function applySuggestedPrice() {
    setPricePerSeat(suggestedPrice.toFixed(2));
  }

  function startEdit(route: AdminRoute) {
    const nextMunicipality = inferMunicipality(route.origin);
    setEditingRouteId(route.id);
    setMunicipality(nextMunicipality);
    setOriginTown(route.origin.includes(' - ') ? route.origin.split(' - ').slice(1).join(' - ') : route.origin);
    setDestination(route.destination);
    setBoardingReference(route.stopsText ?? '');
    setWeekdays(route.weekdays?.length ? route.weekdays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    setDepartureTime(route.departureTime);
    setEstimatedArrivalTime(route.estimatedArrivalTime);
    setAvailableSeats(String(route.availableSeats));
    setPricePerSeat(route.pricePerSeat.toFixed(2));
    setStatus(String(route.status).toLowerCase() === 'paused' ? 'paused' : 'active');
    setError(null);
    setSuccess(`Editando ruta #${route.publicId ?? route.id.slice(0, 8)}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (!originTown.trim() || !destination.trim()) {
      setError('Poblado/zona de salida y destino son obligatorios.');
      return;
    }
    if (!boardingReference.trim()) {
      setError('Agrega una referencia clara de abordaje.');
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

    const payload = {
      title: `${composedOrigin} -> ${destination} ${departureTime}`,
      origin: composedOrigin,
      destination: destination.trim(),
      stopsText: boardingReference.trim(),
      weekdays,
      departureTime,
      estimatedArrivalTime,
      availableSeats: parsedSeats,
      pricePerSeat: roundCurrency(parsedPrice),
      status
    };

    try {
      if (editingRouteId) {
        await apiRequest(`/admin/routes/${editingRouteId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        setSuccess('Ruta actualizada correctamente.');
      } else {
        await apiRequest('/admin/routes', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        setSuccess('Ruta piloto creada correctamente.');
      }

      resetForm();
      await loadRoutes();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar la ruta.');
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
      if (editingRouteId === routeId) resetForm();
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

      if (editingRouteId && selectedRouteIds.includes(editingRouteId)) resetForm();
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
        <h1 className="text-2xl font-semibold text-slate-900">Admin - Rutas piloto</h1>
        <p className="mt-2 text-sm text-slate-600">Crea y edita rutas simples para Acolman, Ecatepec, Tecamac, Texcoco y Teotihuacan. El poblado es libre para capturar colonias, unidades, paraderos o zonas de alta demanda.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{formModeLabel}</h2>
              <p className="mt-1 text-sm text-slate-600">Elige municipio, escribe el poblado o colonia exacta, agrega referencia de abordaje y hora. El sistema estima km y tarifa sugerida.</p>
            </div>
            {editingRouteId && (
              <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                Cancelar edicion
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Municipio piloto
              <select value={municipality} onChange={(event) => handleMunicipalityChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                {PILOT_ORIGINS.map((item) => (
                  <option key={item.municipality} value={item.municipality}>{item.municipality}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-700">
              Poblado, colonia o zona de salida
              <input
                type="text"
                list="pilot-town-suggestions"
                value={originTown}
                onChange={(event) => setOriginTown(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ej. Ojo de Agua, Las Americas, San Cristobal, Tepexpan"
                required
              />
              <datalist id="pilot-town-suggestions">
                {townSuggestions.map((town) => (
                  <option key={town.value} value={town.label} />
                ))}
              </datalist>
              <span className="mt-1 block text-xs text-slate-500">Puedes escribir cualquier colonia, poblado, unidad o paradero. Las sugerencias son solo referencia rapida.</span>
            </label>
          </div>

          <label className="block text-sm text-slate-700">
            Zona de trabajo / terminal CDMX
            <select value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              {PILOT_DESTINATIONS.map((group) => (
                <optgroup key={group.delegation} label={group.delegation}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              ))}
              {!destinationOptions.some((option) => option.value === destination && option.group !== 'Ruta existente') && (
                <option value={destination}>{destination}</option>
              )}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Referencia de abordaje
            <textarea
              value={boardingReference}
              onChange={(event) => setBoardingReference(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={2}
              placeholder="Ej. Frente a la iglesia, junto al Oxxo, parada principal"
              required
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm text-slate-700">
              Hora de salida
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
          </div>

          <div className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-950">
            <div className="grid gap-2 md:grid-cols-3">
              <p><span className="font-semibold">Km calculados:</span> {estimatedDistanceKm.toFixed(1)} km</p>
              <p><span className="font-semibold">Tarifa/km:</span> ${activeRatePerKm.toFixed(2)} MXN</p>
              <p><span className="font-semibold">Sugerencia:</span> ${suggestedPrice.toFixed(2)} MXN</p>
            </div>
            <p className="mt-1 text-xs">{farePolicy ? 'La politica activa del backend validara el precio final.' : 'No se detecto politica activa; la sugerencia visual usa una referencia temporal.'}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block text-sm text-slate-700">
              Precio por asiento
              <input type="number" min={1} max={500} step="0.01" value={pricePerSeat} onChange={(event) => setPricePerSeat(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder={suggestedPrice.toFixed(2)} />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={applySuggestedPrice} className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">
                Usar sugerida
              </button>
            </div>
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

          <label className="block text-sm text-slate-700">
            Estado
            <select value={status} onChange={(event) => setStatus(event.target.value as RouteStatus)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="active">Activa</option>
              <option value="paused">Pausada</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Guardando...' : editingRouteId ? 'Guardar cambios' : 'Crear ruta'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Limpiar
            </button>
          </div>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Piloto controlado</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>Municipios: <span className="font-semibold text-slate-900">Acolman, Ecatepec, Tecamac, Texcoco, Teotihuacan</span></p>
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
          <h2 className="text-lg font-semibold text-slate-900">Rutas existentes</h2>
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
              const isStatusBusy = busyRouteAction === `status:${route.id}`;
              const routeIsActive = String(route.status).toLowerCase() === 'active';
              const routeRate = route.fareRatePerKmApplied ?? activeRatePerKm;
              const routeSuggested = route.maxAllowedPrice ?? roundCurrency(route.distanceKm * routeRate);

              return (
                <article key={route.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRouteSelection(route.id)} />
                      Seleccionar
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(route)} className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDeleteRoute(route.id)} disabled={isDeleting} className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60">
                        {isDeleting ? 'Borrando...' : 'Borrar'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Ruta #{route.publicId ?? '-'}</p>
                  <h3 className="text-base font-semibold text-slate-900">{route.title || `${route.origin} -> ${route.destination}`}</h3>
                  <p className="text-sm text-slate-700">{route.origin} {'->'} {route.destination}</p>
                  <p className="text-sm text-slate-700">Dias: {formatWeekdays(route.weekdays)}</p>
                  <p className="text-sm text-slate-700">Horario: {route.departureTime} - {route.estimatedArrivalTime}</p>
                  <p className="text-sm text-slate-700">Distancia: {route.distanceKm.toFixed(1)} km</p>
                  <p className="text-sm text-slate-700">Asientos: {route.availableSeats}</p>
                  <p className="text-sm font-medium text-slate-900">Precio: ${route.pricePerSeat.toFixed(2)} MXN</p>
                  <p className="text-xs text-slate-500">Tarifa calculada: ${routeSuggested.toFixed(2)} MXN</p>
                  <p className="mt-1 text-xs text-slate-600">{route.stopsText || 'Sin referencia de abordaje.'}</p>
                  <p className="mt-1 text-xs text-slate-600">Estado: {routeIsActive ? 'Activa' : 'Pausada'}</p>

                  <button type="button" onClick={() => void handleToggleStatus(route)} disabled={isStatusBusy} className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-60">
                    {isStatusBusy ? 'Actualizando...' : routeIsActive ? 'Pausar ruta' : 'Activar ruta'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
