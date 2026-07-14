'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { FarePolicy } from '@/lib/fare-policy';
import { estimateRouteDistanceKm } from '@/lib/route-distance-estimator';

interface CreatedRouteResponse {
  id: string;
}

type PilotDestination = {
  delegation: string;
  options: Array<{ label: string; value: string }>;
};

const PILOT_ORIGINS = ['Acolman', 'Ecatepec', 'Tecamac', 'Texcoco', 'Teotihuacan'] as const;

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

const DEFAULT_UI_RATE_PER_KM = 2.5;
const DEFAULT_ROUTE_WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const DEFAULT_ROUTE_DEPARTURE_TIME = '06:00';
const DEFAULT_ROUTE_ARRIVAL_TIME = '07:00';
const DEFAULT_ROUTE_SEATS = 4;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export default function CreateRoutePage() {
  const router = useRouter();
  const [municipality, setMunicipality] = useState<string>(PILOT_ORIGINS[0]);
  const [destination, setDestination] = useState(PILOT_DESTINATIONS[0].options[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [farePolicy, setFarePolicy] = useState<FarePolicy | null>(null);

  const estimatedDistanceKm = useMemo(() => estimateRouteDistanceKm(municipality, destination), [municipality, destination]);
  const activeRatePerKm = farePolicy?.ratePerKm ?? DEFAULT_UI_RATE_PER_KM;
  const calculatedPricePerSeat = useMemo(() => roundCurrency(estimatedDistanceKm * activeRatePerKm), [estimatedDistanceKm, activeRatePerKm]);

  useEffect(() => {
    async function loadFarePolicy() {
      try {
        const token = getToken();
        const policy = await apiRequest<FarePolicy | null>(
          '/fare-policy/current',
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );
        setFarePolicy(policy);
      } catch {
        setFarePolicy(null);
      }
    }

    void loadFarePolicy();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();

    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!municipality.trim() || !destination.trim()) {
      setError('Selecciona punto de partida y destino.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const createdRoute = await apiRequest<CreatedRouteResponse>('/routes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `${municipality} -> ${destination}`,
          origin: municipality,
          destination: destination.trim(),
          weekdays: [...DEFAULT_ROUTE_WEEKDAYS],
          departureTime: DEFAULT_ROUTE_DEPARTURE_TIME,
          estimatedArrivalTime: DEFAULT_ROUTE_ARRIVAL_TIME,
          availableSeats: DEFAULT_ROUTE_SEATS,
          stopsText: 'Ruta base del piloto. Horario, dias, asientos y referencia se publican al tomar la ruta.'
        })
      });

      setSuccess('Ruta base lista. Ahora publica horario, asientos y punto de encuentro para operar.');
      window.setTimeout(() => {
        router.push(`/dashboard/routes/${createdRoute.id}/take`);
      }, 500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la ruta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">VIAJASEGURO piensa en tu bolsillo y seguridad</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Crear ruta base</h1>
        <p className="mt-2 text-sm text-slate-600">
          Para evitar rutas repetidas, primero registra solo el punto de partida y el destino. Despues publica tu horario, asientos y referencia al tomar la ruta.
        </p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Solo dos datos para empezar</h2>
            <p className="mt-1 text-sm text-slate-600">El horario, dias, asientos y punto exacto se capturan en el siguiente paso.</p>
          </div>

          <label className="block text-sm text-slate-700">
            Punto de partida
            <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              {PILOT_ORIGINS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Destino o zona de trabajo
            <select value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              {PILOT_DESTINATIONS.map((group) => (
                <optgroup key={group.delegation} label={group.delegation}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-950">
            <div className="grid gap-2 md:grid-cols-3">
              <p><span className="font-semibold">Ruta base:</span> {municipality} hacia CDMX</p>
              <p><span className="font-semibold">Km estimados:</span> {estimatedDistanceKm.toFixed(1)} km</p>
              <p><span className="font-semibold">Referencia por lugar:</span> ${calculatedPricePerSeat.toFixed(2)} MXN</p>
            </div>
            <p className="mt-2 text-xs">La aportacion es orientativa. VIAJASEGURO no cobra traslados; el acuerdo diario en efectivo se coordina entre usuario y conductor.</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Siguiente paso obligatorio</p>
            <p className="mt-1">Despues de crear la base, publica disponibilidad: dias, horario, asientos reales, referencia publica y punto seguro de encuentro.</p>
            <p className="mt-2 text-xs">La app envia valores tecnicos seguros para compatibilidad; el conductor solo decide los datos importantes en el siguiente paso.</p>
          </div>

          <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Guardando...' : 'Crear ruta base y publicar disponibilidad'}
          </button>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Flujo operativo</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>1. Crea una ruta base sin repetir datos.</p>
            <p>2. Toma la ruta para publicar horario, asientos y referencia.</p>
            <p>3. Recibe solicitudes de usuarios verificados.</p>
            <p>4. Inicia la ruta, identifica usuarios y opera pensando en seguridad y bolsillo.</p>
          </div>
          <Link href="/dashboard/routes" className="mt-4 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Ver rutas disponibles
          </Link>
        </aside>
      </div>
    </section>
  );
}