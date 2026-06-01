'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { estimateRouteDistanceKm } from '@/lib/route-distance-estimator';
import { CDMX_DESTINATION_HUBS, EDOMEX_ORIGIN_OPTIONS, ROUTE_SERVICE_SCOPE_OPTIONS, RouteServiceScope } from '@/lib/route-location-options';

type Region = 'edomex' | 'cdmx';

function originOptionsByRegion(region: Region) {
  return region === 'edomex' ? EDOMEX_ORIGIN_OPTIONS : CDMX_DESTINATION_HUBS;
}

function destinationOptionsByRegion(region: Region) {
  return region === 'edomex' ? EDOMEX_ORIGIN_OPTIONS : CDMX_DESTINATION_HUBS;
}

export default function CreateRoutePage() {
  const [originRegion, setOriginRegion] = useState<Region>('edomex');
  const [destinationRegion, setDestinationRegion] = useState<Region>('cdmx');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [serviceScope, setServiceScope] = useState<RouteServiceScope>('edomex_to_cdmx');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const originOptions = useMemo(() => originOptionsByRegion(originRegion), [originRegion]);
  const destinationOptions = useMemo(() => destinationOptionsByRegion(destinationRegion), [destinationRegion]);
  const estimatedDistanceKm = useMemo(() => (origin && destination ? estimateRouteDistanceKm(origin, destination) : null), [origin, destination]);

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

    if (!origin || !destination) {
      setError('Selecciona punto de inicio y destino.');
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
      await apiRequest('/routes', {
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

      setSuccess('Ruta principal creada. Ahora aparecera en el feed y podras tomarla para personalizar tu viaje.');
      setOrigin('');
      setDestination('');
      setPricePerSeat('');
      setServiceScope('edomex_to_cdmx');
      setDescription('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la ruta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Crear ruta principal</h1>
        <p className="text-sm text-slate-600">
          Selecciona region y punto de inicio/destino para crear una ruta clara y operativa. Como conductor tambien puedes crear tu propia ruta para trabajar.
        </p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <div className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">
            <p className="font-medium">Distancia estimada por sistema</p>
            <p>{estimatedDistanceKm ? `${estimatedDistanceKm.toFixed(1)} km aprox.` : 'Selecciona origen y destino para calcularla.'}</p>
            <p className="mt-1 text-xs">La distancia se calcula automaticamente y se usa para validar la tarifa por km.</p>
          </div>

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
              placeholder="Ej. 40"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Descripcion (opcional)
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={3}
              placeholder="Ej. Ruta frecuente para traslados laborales"
            />
          </label>

          <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Guardando...' : 'Crear mi ruta para trabajar'}
          </button>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Flujo recomendado</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>1) Elige region de inicio y destino.</li>
            <li>2) Selecciona punto de inicio y destino; la app estima los km.</li>
            <li>3) En el feed, pulsa Tomar ruta para personalizar viaje.</li>
            <li>4) Publica para que pasajeros reserven.</li>
          </ul>
          <Link href="/dashboard/routes" className="mt-4 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Ir al feed de rutas
          </Link>
        </aside>
      </div>
    </section>
  );
}


