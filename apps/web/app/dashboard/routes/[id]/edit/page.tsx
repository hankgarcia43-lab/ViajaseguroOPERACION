'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { FarePolicy } from '@/lib/fare-policy';
import { estimateRouteDistanceKm } from '@/lib/route-distance-estimator';
import { DriverRoute, farePolicyModeLabel, RoutePayload, WEEKDAY_OPTIONS, WeekdayValue } from '@/lib/routes';

interface RouteFormState {
  title: string;
  origin: string;
  destination: string;
  stopsText: string;
  departureTime: string;
  estimatedArrivalTime: string;
  availableSeats: string;
}

export default function EditRoutePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routeId = params?.id;

  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [farePolicy, setFarePolicy] = useState<FarePolicy | null>(null);
  const [form, setForm] = useState<RouteFormState | null>(null);
  const [selectedDays, setSelectedDays] = useState<WeekdayValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekdaySet = useMemo(() => new Set(selectedDays), [selectedDays]);
  const estimatedDistanceKm = form ? estimateRouteDistanceKm(form.origin, form.destination) : null;
  const systemPricePreview = farePolicy && estimatedDistanceKm ? Number((estimatedDistanceKm * farePolicy.ratePerKm).toFixed(2)) : null;

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token || !routeId) {
        setError('No se pudo validar la sesion o la ruta.');
        setLoading(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [routeData, policyData] = await Promise.all([
          apiRequest<DriverRoute>(`/routes/${routeId}`, { headers }),
          apiRequest<FarePolicy | null>('/fare-policy/current', { headers })
        ]);
        setRoute(routeData);
        setFarePolicy(policyData);
        setForm({
          title: routeData.title ?? '',
          origin: routeData.origin,
          destination: routeData.destination,
          stopsText: routeData.stopsText ?? '',
          departureTime: routeData.departureTime,
          estimatedArrivalTime: routeData.estimatedArrivalTime,
          availableSeats: String(routeData.availableSeats)
        });
        setSelectedDays(routeData.weekdays);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [routeId]);

  function toggleDay(day: WeekdayValue) {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((item) => item !== day);
      }
      return [...prev, day];
    });
  }

  function updateField<K extends keyof RouteFormState>(field: K, value: RouteFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token || !routeId || !form) {
      setError('No hay sesion activa o ruta invalida.');
      return;
    }

    if (selectedDays.length === 0) {
      setError('Selecciona al menos un dia de la semana.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: RoutePayload = {
      title: form.title.trim() || undefined,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      stopsText: form.stopsText.trim() || undefined,
      weekdays: selectedDays,
      departureTime: form.departureTime,
      estimatedArrivalTime: form.estimatedArrivalTime,
      availableSeats: Number(form.availableSeats)
    };

    try {
      await apiRequest<DriverRoute>(`/routes/${routeId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      router.push('/dashboard/routes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la ruta');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando ruta...</p>;
  }

  if (!route || !form) {
    return <p className="rounded-md bg-red-50 p-3 text-red-700">{error ?? 'Ruta no encontrada'}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Editar ruta</h1>
          <p className="text-sm text-slate-600">Ajusta horarios y datos operativos. La aportacion sugerida la calcula el sistema segun km y referencia activa. No es tarifa obligatoria.</p>
        </div>
        <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          Volver a mis rutas
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Referencia activa por km</p>
        {farePolicy ? (
          <>
            <p className="mt-2">{farePolicyModeLabel(farePolicy.mode)}: ${farePolicy.ratePerKm.toFixed(2)} {farePolicy.currency} por km.</p>
            {farePolicy.notes && <p className="mt-1 text-xs text-slate-500">Nota admin: {farePolicy.notes}</p>}
          </>
        ) : (
          <p className="mt-2 text-red-700">No hay una referencia activa por km. Consulta al admin antes de publicar o editar aportaciones sugeridas.</p>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-700 md:col-span-2">
            Titulo (opcional)
            <input name="title" value={form.title} onChange={(event) => updateField('title', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <label className="block text-sm text-slate-700">
            Origen
            <input required name="origin" value={form.origin} onChange={(event) => updateField('origin', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <label className="block text-sm text-slate-700">
            Destino
            <input required name="destination" value={form.destination} onChange={(event) => updateField('destination', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <label className="block text-sm text-slate-700 md:col-span-2">
            Referencia adicional (opcional)
            <textarea name="stopsText" rows={3} value={form.stopsText} onChange={(event) => updateField('stopsText', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm text-slate-700">Dias de la semana</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {WEEKDAY_OPTIONS.map((day) => (
                <label key={day.value} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm">
                  <input type="checkbox" checked={weekdaySet.has(day.value)} onChange={() => toggleDay(day.value)} />
                  {day.label}
                </label>
              ))}
            </div>
          </div>

          <label className="block text-sm text-slate-700">
            Hora de salida
            <input required type="time" name="departureTime" value={form.departureTime} onChange={(event) => updateField('departureTime', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <label className="block text-sm text-slate-700">
            Hora estimada de llegada
            <input required type="time" name="estimatedArrivalTime" value={form.estimatedArrivalTime} onChange={(event) => updateField('estimatedArrivalTime', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <label className="block text-sm text-slate-700">
            Asientos disponibles
            <input required min={1} max={20} type="number" name="availableSeats" value={form.availableSeats} onChange={(event) => updateField('availableSeats', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <div className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">
            <p className="font-medium">Distancia estimada por sistema</p>
            <p>{estimatedDistanceKm ? `${estimatedDistanceKm.toFixed(1)} km aprox.` : 'Captura origen y destino para calcularla.'}</p>
            <p className="mt-1 text-xs">Este dato ya no se captura manualmente.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Resumen de aportacion sugerida</p>
            <p className="mt-2">Distancia estimada: {estimatedDistanceKm ? `${estimatedDistanceKm.toFixed(2)} km` : '-'}</p>
            <p className="mt-2">Aportacion sugerida calculada: {systemPricePreview === null ? '-' : `${systemPricePreview.toFixed(2)} MXN`}</p>
            <p className="mt-1 text-xs text-slate-500">Formula interna: km estimados x referencia por km activa. El conductor no puede modificar este monto y VIAJASEGURO no cobra el traslado.</p>
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={saving} className="w-full rounded-md bg-brand-500 px-4 py-2 font-medium text-white disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  );
}
