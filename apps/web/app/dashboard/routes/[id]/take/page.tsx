'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { BaseRouteSummary, CreateRouteOfferPayload, RouteOffer } from '@/lib/route-offers';

interface MeResponse {
  role: 'passenger' | 'driver' | 'admin';
}

const DAYS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miercoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sabado' },
  { key: 'sunday', label: 'Domingo' }
];

function isValidHour(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parseBoardingReference(raw: string | null | undefined) {
  const text = String(raw ?? '');

  const outboundRefMatch = text.match(/Salida - Referencia:\s*(.*?)\.\s*Salida - Direccion exacta:/i);
  const outboundAddressMatch = text.match(/Salida - Direccion exacta:\s*(.*?)(?:\.\s*Regreso CDMX - Hora:|$)/i);

  const legacyRefMatch = text.match(/Referencia:\s*(.*?)\.\s*Direccion exacta:/i);
  const legacyAddressMatch = text.match(/Direccion exacta:\s*(.*?)(?:\.\s*Regreso CDMX - Hora:|$)/i);

  const returnTimeMatch = text.match(/Regreso CDMX - Hora:\s*([01]\d|2[0-3]):[0-5]\d/i);
  const returnRefMatch = text.match(/Regreso CDMX - Referencia:\s*(.*?)\.\s*Regreso CDMX - Direccion exacta:/i);
  const returnAddressMatch = text.match(/Regreso CDMX - Direccion exacta:\s*(.*)$/i);

  return {
    reference: outboundRefMatch?.[1]?.trim() ?? legacyRefMatch?.[1]?.trim() ?? text.trim(),
    address: outboundAddressMatch?.[1]?.trim() ?? legacyAddressMatch?.[1]?.trim() ?? '',
    returnTime: returnTimeMatch?.[1]?.trim() ?? '',
    returnReference: returnRefMatch?.[1]?.trim() ?? '',
    returnAddress: returnAddressMatch?.[1]?.trim() ?? ''
  };
}

export default function DriverTakeRoutePage() {
  const [route, setRoute] = useState<BaseRouteSummary | null>(null);
  const [existingOffer, setExistingOffer] = useState<RouteOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [boardingReference, setBoardingReference] = useState('');
  const [boardingAddress, setBoardingAddress] = useState('');
  const [returnDepartureTime, setReturnDepartureTime] = useState('');
  const [returnBoardingReference, setReturnBoardingReference] = useState('');
  const [returnBoardingAddress, setReturnBoardingAddress] = useState('');

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState<'one_time' | 'weekly' | 'round_trip'>('weekly');
  const [availableSeats, setAvailableSeats] = useState('4');
  const [departureTime, setDepartureTime] = useState('');
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('');

  const router = useRouter();
  const params = useParams<{ id: string }>();
  const routeParamId = String(params?.id ?? '').trim();

  const routeLabel = useMemo(() => {
    if (!route) return 'Ruta';
    return route.title || `${route.origin} -> ${route.destination}`;
  }, [route]);

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        setError('No hay sesion activa.');
        setLoading(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const me = await apiRequest<MeResponse>('/auth/me', { headers });
        if (me.role !== 'driver') {
          setError('Solo conductores pueden tomar rutas.');
          setLoading(false);
          return;
        }

        const [baseRoutes, myRoutes, publicRoutes] = await Promise.all([
          apiRequest<BaseRouteSummary[]>('/route-offers/routes', { headers }),
          apiRequest<BaseRouteSummary[]>('/routes/my-routes', { headers }).catch(() => []),
          apiRequest<BaseRouteSummary[]>('/routes/public', { headers }).catch(() => [])
        ]);

        const normalizedRouteParam = routeParamId;
        const routes = [...baseRoutes, ...myRoutes, ...publicRoutes];
        const foundRoute =
          routes.find((item) => item.id === normalizedRouteParam || String(item.publicId ?? '') === normalizedRouteParam) ?? null;

        if (!foundRoute) {
          setError('No se encontro la ruta seleccionada. Regresa al feed y selecciona una ruta publicada para tomarla.');
          setLoading(false);
          return;
        }

        setRoute(foundRoute);
        setDepartureTime(foundRoute.departureTime ?? '');
        setEstimatedArrivalTime(foundRoute.estimatedArrivalTime ?? '');

        try {
          const offers = await apiRequest<RouteOffer[]>('/route-offers/my-offers', { headers });
          const foundOffer = offers.find((item) => item.routeId === foundRoute.id && item.status === 'active') ?? null;
          if (foundOffer) {
            setExistingOffer(foundOffer);
            const parsed = parseBoardingReference(foundOffer.boardingReference);
            setBoardingReference(parsed.reference);
            setBoardingAddress(parsed.address);
            setReturnDepartureTime(parsed.returnTime);
            setReturnBoardingReference(parsed.returnReference);
            setReturnBoardingAddress(parsed.returnAddress);
            setSelectedDays(foundOffer.weekdays ?? []);
            setServiceType(foundOffer.serviceType ?? 'weekly');
            setAvailableSeats(String(foundOffer.availableSeats ?? 4));
          }
        } catch {
          setExistingOffer(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la configuracion de la ruta.');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [routeParamId]);

  function toggleDay(day: string) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!boardingReference.trim()) {
      setError('Escribe una referencia de abordaje clara.');
      return;
    }

    if (!boardingAddress.trim()) {
      setError('Escribe una direccion especifica de abordaje.');
      return;
    }

    if (selectedDays.length === 0) {
      setError('Selecciona al menos un dia de operacion.');
      return;
    }

    if (serviceType === 'one_time' && selectedDays.length !== 1) {
      setError('Para servicio unico debes seleccionar solo un dia.');
      return;
    }

    if (!isValidHour(departureTime)) {
      setError('La hora de salida debe estar en formato HH:mm.');
      return;
    }

    if (!isValidHour(estimatedArrivalTime)) {
      setError('La hora estimada de llegada debe estar en formato HH:mm.');
      return;
    }

    if (serviceType === 'round_trip') {
      if (!isValidHour(returnDepartureTime)) {
        setError('Para ida y vuelta, la hora de regreso debe estar en formato HH:mm.');
        return;
      }

      if (!returnBoardingReference.trim()) {
        setError('Para ida y vuelta, escribe la referencia de abordaje en CDMX para el regreso.');
        return;
      }

      if (!returnBoardingAddress.trim()) {
        setError('Para ida y vuelta, escribe la direccion exacta de abordaje en CDMX para el regreso.');
        return;
      }
    }

    const seats = Number.parseInt(availableSeats, 10);
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
      setError('Los asientos disponibles deben estar entre 1 y 20.');
      return;
    }

    if (!route) {
      setError('No se pudo identificar la ruta seleccionada. Vuelve al feed y entra de nuevo desde "Tomar ruta".');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      let boardingReferenceText = `Salida - Referencia: ${boardingReference.trim()}. Salida - Direccion exacta: ${boardingAddress.trim()}.`;

      if (serviceType === 'round_trip') {
        boardingReferenceText += ` Regreso CDMX - Hora: ${returnDepartureTime.trim()}. Regreso CDMX - Referencia: ${returnBoardingReference.trim()}. Regreso CDMX - Direccion exacta: ${returnBoardingAddress.trim()}.`;
      }

      const payload: CreateRouteOfferPayload = {
        routeId: route.id,
        boardingReference: boardingReferenceText,
        weekdays: selectedDays,
        serviceType,
        availableSeats: seats
      };

      if (existingOffer) {
        await apiRequest(`/route-offers/${existingOffer.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            boardingReference: payload.boardingReference,
            weekdays: payload.weekdays,
            serviceType: payload.serviceType,
            availableSeats: payload.availableSeats
          })
        });
      } else {
        await apiRequest('/route-offers', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }

      await apiRequest(`/routes/${route.id}/take-viaje`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          departureTime,
          estimatedArrivalTime
        })
      });

      setSuccess('Ruta tomada y viaje personalizado correctamente.');
      setTimeout(() => {
        router.push(`/dashboard/trips?takenRoute=${encodeURIComponent(routeLabel)}`);
      }, 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la configuracion del viaje.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando personalizacion de ruta...</p>;
  }

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Tomar ruta y personalizar viaje</h1>
        <p className="text-sm text-slate-600">Ruta seleccionada: {routeLabel}</p>
        <p className="text-xs text-slate-500">Completa estos datos para publicar tu viaje de forma clara y segura.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      {!route && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">No se pudo cargar la ruta publicada.</p>
          <p className="mt-1">Regresa al feed y pulsa de nuevo en "Tomar ruta" para crear o editar tu viaje.</p>
          <Link href="/dashboard/routes" className="mt-3 inline-block rounded-md border border-amber-300 px-3 py-2 text-xs text-amber-900">
            Volver al feed de rutas
          </Link>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Reglas basicas de seguridad</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              <li>Usa puntos publicos y visibles para el abordaje.</li>
              <li>Evita zonas aisladas o referencias confusas.</li>
              <li>Comparte direccion exacta para reducir riesgos.</li>
            </ul>
          </div>

          <label className="block text-sm text-slate-700">
            Referencia de abordaje
            <input
              value={boardingReference}
              onChange={(event) => setBoardingReference(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Ej. Frente a la farmacia principal"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Direccion exacta de abordaje
            <input
              value={boardingAddress}
              onChange={(event) => setBoardingAddress(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Ej. Av. Central 123, San Cristobal, Ecatepec"
            />
          </label>

          <div>
            <p className="text-sm text-slate-700">Dias de operacion</p>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              {DAYS.map((day) => (
                <label key={day.key} className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={selectedDays.includes(day.key)} onChange={() => toggleDay(day.key)} />
                  {day.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Hora de salida
              <input
                type="time"
                value={departureTime}
                onChange={(event) => setDepartureTime(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              Hora estimada de llegada
              <input
                type="time"
                value={estimatedArrivalTime}
                onChange={(event) => setEstimatedArrivalTime(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              Tipo de servicio
              <select
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value as 'one_time' | 'weekly' | 'round_trip')}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="weekly">Recurrente semanal</option>
                <option value="one_time">Servicio unico</option>
                <option value="round_trip">Ida y vuelta</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Asientos disponibles
              <input
                type="number"
                min={1}
                max={20}
                value={availableSeats}
                onChange={(event) => setAvailableSeats(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          {serviceType === 'round_trip' && (
            <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-sm font-semibold text-cyan-900">Datos de regreso desde CDMX</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Hora de regreso
                  <input
                    type="time"
                    value={returnDepartureTime}
                    onChange={(event) => setReturnDepartureTime(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  Referencia de abordaje en CDMX (regreso)
                  <input
                    value={returnBoardingReference}
                    onChange={(event) => setReturnBoardingReference(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Ej. Salida principal del Metro Indios Verdes"
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  Direccion exacta de abordaje en CDMX (regreso)
                  <input
                    value={returnBoardingAddress}
                    onChange={(event) => setReturnBoardingAddress(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Ej. Av. Insurgentes Norte 1234, GAM, CDMX"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !route} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Guardando...' : existingOffer ? 'Actualizar viaje' : 'Confirmar y tomar ruta'}
            </button>
            <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Volver a corredores
            </Link>
          </div>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Resumen de la ruta</h2>
          {route ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p><strong>Origen:</strong> {route.origin}</p>
              <p><strong>Destino:</strong> {route.destination}</p>
              <p><strong>Precio por asiento:</strong> ${route.pricePerSeat.toFixed(2)} MXN</p>
              <p><strong>Distancia estimada:</strong> {route.distanceKm.toFixed(2)} km</p>
              <p><strong>Horario base:</strong> {route.departureTime} - {route.estimatedArrivalTime}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No se encontro la informacion de la ruta.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
