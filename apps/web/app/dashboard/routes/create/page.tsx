'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { FarePolicy } from '@/lib/fare-policy';
import { estimateRouteDistanceKm } from '@/lib/route-distance-estimator';
import { HHMM_REGEX, WEEKDAY_OPTIONS, WeekdayValue } from '@/lib/routes';

type PilotDestination = {
  delegation: string;
  options: Array<{ label: string; value: string }>;
};

interface CreatedRouteResponse {
  id: string;
}

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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function addMinutesToTime(time: string, minutes: number) {
  if (!HHMM_REGEX.test(time)) return '07:00';
  const [hours, mins] = time.split(':').map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  const nextHours = Math.floor(total / 60).toString().padStart(2, '0');
  const nextMinutes = (total % 60).toString().padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

export default function CreateRoutePage() {
  const router = useRouter();
  const [municipality, setMunicipality] = useState<string>(PILOT_ORIGINS[0]);
  const [originTown, setOriginTown] = useState('');
  const [destination, setDestination] = useState(PILOT_DESTINATIONS[0].options[0].value);
  const [boardingReference, setBoardingReference] = useState('');
  const [weekdays, setWeekdays] = useState<WeekdayValue[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [departureTime, setDepartureTime] = useState('06:00');
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('07:00');
  const [availableSeats, setAvailableSeats] = useState('4');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [farePolicy, setFarePolicy] = useState<FarePolicy | null>(null);

  const composedOrigin = useMemo(() => {
    const trimmedTown = originTown.trim();
    if (!trimmedTown) return municipality;
    return trimmedTown.toLowerCase().startsWith(municipality.toLowerCase()) ? trimmedTown : `${municipality} - ${trimmedTown}`;
  }, [municipality, originTown]);

  const estimatedDistanceKm = useMemo(() => estimateRouteDistanceKm(composedOrigin, destination), [composedOrigin, destination]);
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

  useEffect(() => {
    const minutes = Math.max(35, Math.min(140, Math.round(estimatedDistanceKm * 1.7)));
    setEstimatedArrivalTime(addMinutesToTime(departureTime, minutes));
  }, [departureTime, estimatedDistanceKm]);

  function handleMunicipalityChange(nextMunicipality: string) {
    setMunicipality(nextMunicipality);
    setOriginTown('');
  }

  function toggleWeekday(day: WeekdayValue) {
    setWeekdays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();

    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!originTown.trim()) {
      setError('Escribe el poblado o colonia de salida.');
      return;
    }

    if (!destination.trim()) {
      setError('Selecciona la zona de trabajo o terminal de destino.');
      return;
    }

    if (!boardingReference.trim()) {
      setError('Agrega una referencia clara de abordaje para que el pasajero te encuentre.');
      return;
    }

    if (weekdays.length === 0) {
      setError('Selecciona al menos un dia de operacion.');
      return;
    }

    if (!HHMM_REGEX.test(departureTime) || !HHMM_REGEX.test(estimatedArrivalTime)) {
      setError('La hora de salida y llegada debe tener formato HH:mm.');
      return;
    }

    const parsedSeats = Number.parseInt(availableSeats, 10);
    if (!Number.isInteger(parsedSeats) || parsedSeats < 1 || parsedSeats > 20) {
      setError('Los asientos disponibles deben estar entre 1 y 20.');
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
          title: `${composedOrigin} -> ${destination} ${departureTime}`,
          origin: composedOrigin,
          destination: destination.trim(),
          weekdays,
          departureTime,
          estimatedArrivalTime,
          availableSeats: parsedSeats,
          stopsText: boardingReference.trim()
        })
      });

      setSuccess('Ruta creada. Te llevare a Mis rutas para tomarla y publicar tu disponibilidad.');
      window.setTimeout(() => {
        router.push('/dashboard/routes?createdRoute=' + encodeURIComponent(createdRoute.id));
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
        <h1 className="text-2xl font-semibold text-slate-900">Crear ruta para trabajar</h1>
        <p className="mt-2 text-sm text-slate-600">
          Crea una ruta especifica para la prueba piloto: elige punto de partida, escribe el poblado real, agrega referencia de abordaje y confirma horario.
        </p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Datos de la ruta</h2>
            <p className="mt-1 text-sm text-slate-600">Paso 1: punto de partida. Paso 2: poblado libre. Paso 3: referencia exacta para abordar.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-700">
              1. Punto de partida
              <select value={municipality} onChange={(event) => handleMunicipalityChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                {PILOT_ORIGINS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-700">
              2. Poblado o colonia de salida
              <input
                type="text"
                value={originTown}
                onChange={(event) => setOriginTown(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ej. Tepexpan, Ojo de Agua, Las Americas, San Cristobal, Centro"
                required
              />
              <span className="mt-1 block text-xs text-slate-500">Campo libre: escribe el punto real donde hay demanda.</span>
            </label>
          </div>

          <label className="block text-sm text-slate-700">
            3. Referencia exacta de abordaje
            <textarea
              value={boardingReference}
              onChange={(event) => setBoardingReference(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={2}
              placeholder="Ej. Frente a la iglesia, junto al Oxxo, entrada del fraccionamiento, parada principal"
              required
            />
          </label>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Punto que se publicara:</span> {composedOrigin}
          </div>

          <label className="block text-sm text-slate-700">
            4. Zona de trabajo / terminal CDMX
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
              Asientos disponibles
              <input type="number" min={1} max={20} step={1} value={availableSeats} onChange={(event) => setAvailableSeats(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <div className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-950">
            <div className="grid gap-2 md:grid-cols-3">
              <p><span className="font-semibold">Km calculados:</span> {estimatedDistanceKm.toFixed(1)} km</p>
              <p><span className="font-semibold">Tarifa/km:</span> ${activeRatePerKm.toFixed(2)} MXN</p>
              <p><span className="font-semibold">Precio sistema:</span> ${calculatedPricePerSeat.toFixed(2)} MXN</p>
            </div>
            <p className="mt-1 text-xs">El sistema calcula el precio por asiento. El conductor no modifica el monto.</p>
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

          <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Guardando...' : 'Crear mi ruta para trabajar'}
          </button>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Flujo recomendado</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>1. Elige uno de los puntos piloto: Acolman, Ecatepec, Tecamac, Texcoco o Teotihuacan.</p>
            <p>2. Escribe el poblado o colonia exacta donde puedes recoger pasajeros.</p>
            <p>3. Publica la ruta y luego tomala desde Mis rutas para abrir disponibilidad.</p>
            <p>4. Los pasajeros veran precio, horario, dias y referencia de abordaje.</p>
          </div>
          <Link href="/dashboard/routes" className="mt-4 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Ir a Mis rutas
          </Link>
        </aside>
      </div>
    </section>
  );
}
