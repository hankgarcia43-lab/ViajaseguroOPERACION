'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { AvailableTrip, CreateReservationPayload, Reservation } from '@/lib/reservations';
import { getTripStatusMeta } from '@/lib/status';

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sabado',
  sunday: 'Domingo'
};

const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatWeekday(value: string) {
  return WEEKDAY_LABELS[value] ?? value;
}

function weekdayFromDate(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay();
  return WEEKDAY_ORDER[day] ?? '';
}

export default function ReserveTripPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params?.id;

  const [trip, setTrip] = useState<AvailableTrip | null>(null);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [totalSeats, setTotalSeats] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrip() {
      const token = getToken();
      if (!token || !tripId) {
        setError('No hay sesion activa o viaje invalido.');
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest<AvailableTrip>(`/trips/available/${tripId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setTrip(data);

        const routeWeekdays = data.route?.weekdays?.length ? data.route.weekdays : [];
        const tripWeekday = weekdayFromDate(data.tripDate);
        const initialWeekday = routeWeekdays.includes(tripWeekday) ? tripWeekday : routeWeekdays[0] ?? tripWeekday;
        setSelectedWeekdays(initialWeekday ? [initialWeekday] : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el viaje');
      } finally {
        setLoading(false);
      }
    }

    void loadTrip();
  }, [tripId]);

  const availableWeekdayList = useMemo(() => (trip ? WEEKDAY_ORDER : []), [trip]);

  const availableWeekdays = useMemo(() => new Set(availableWeekdayList), [availableWeekdayList]);
  const selectedDaysCount = selectedWeekdays.length || 1;

  const totalAmount = useMemo(() => {
    if (!trip) return 0;
    return selectedDaysCount * totalSeats * trip.pricePerSeatSnapshot;
  }, [trip, totalSeats, selectedDaysCount]);

  function selectReservationDays(count: number) {
    const nextDays = availableWeekdayList.slice(0, count);
    if (nextDays.length < count) {
      setError(`Selecciona al menos 1 dia disponible.`);
      setSelectedWeekdays(nextDays);
      return;
    }

    setError(null);
    setSelectedWeekdays(nextDays);
  }

  function toggleWeekday(weekday: string) {
    if (!availableWeekdays.has(weekday)) {
      setError('Ese dia no esta disponible para este viaje.');
      return;
    }

    setError(null);
    setSelectedWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((item) => item !== weekday);
      }
      if (current.length >= 3) {
        setError('Puedes seleccionar maximo 3 dias por semana.');
        return current;
      }
      return [...current, weekday];
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token || !trip) {
      setError('No hay sesion activa o viaje no disponible.');
      return;
    }

    if (!Number.isInteger(totalSeats) || totalSeats < 1) {
      setError('El total de asientos debe ser un numero entero mayor o igual a 1.');
      return;
    }

    if (totalSeats > trip.remainingSeats) {
      setError('La cantidad de asientos excede la disponibilidad actual.');
      return;
    }

    if (selectedWeekdays.length < 1) {
      setError('Selecciona al menos 1 dia para viajar.');
      return;
    }

    if (selectedWeekdays.length > 3) {
      setError('Puedes seleccionar maximo 3 dias por semana.');
      return;
    }

    const invalidDay = selectedWeekdays.find((weekday) => !availableWeekdays.has(weekday));
    if (invalidDay) {
      setError(`La ruta no opera en ${formatWeekday(invalidDay)}.`);
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreateReservationPayload = {
      tripId: trip.id,
      totalSeats,
      selectedWeekdays
    };

    try {
      const response = await apiRequest<Reservation | { primaryReservationId?: string | null; totalDays?: number }>('/reservations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const primaryReservationId = 'id' in response ? response.id : response.primaryReservationId;
      const target = selectedWeekdays.length === 1 && primaryReservationId ? `/dashboard/my-payments?reservation=${primaryReservationId}` : '/dashboard/my-payments';
      router.push(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la reserva');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando viaje...</p>;
  }

  if (!trip) {
    return <p className="rounded-md bg-red-50 p-3 text-red-700">{error ?? 'Viaje no disponible'}</p>;
  }

  const tripStatusMeta = getTripStatusMeta(trip.status);
  const showVerificationLink = (error ?? '').toLowerCase().includes('verific');

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Reservar viaje</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/my-reservations" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mis reservas
          </Link>
          <Link href="/dashboard/search-trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Volver a buscar
          </Link>
        </div>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {trip.route?.title || `${trip.route?.origin || 'Ruta'} -> ${trip.route?.destination || ''}`}
          </h2>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${tripStatusMeta.className}`}>{tripStatusMeta.label}</span>
        </div>
        <p className="text-sm text-slate-700">Fecha base: {new Date(trip.tripDate).toLocaleDateString()}</p>
        <p className="text-sm text-slate-700">Salida: {trip.departureTimeSnapshot}</p>
        <p className="text-sm text-slate-700">Precio por asiento: ${trip.pricePerSeatSnapshot.toFixed(2)} MXN</p>
        <p className="text-sm text-slate-700">Asientos disponibles: {trip.remainingSeats}</p>
      </article>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm text-slate-700">
          Total de asientos por dia
          <input
            required
            min={1}
            max={Math.max(1, trip.remainingSeats)}
            type="number"
            step={1}
            value={totalSeats}
            onChange={(event) => setTotalSeats(Number.parseInt(event.target.value, 10) || 0)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <div>
          <p className="text-sm text-slate-700">Dias para viajar</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((count) => {
              const active = selectedWeekdays.length === count;
              const disabled = availableWeekdayList.length === 0;
              return (
                <button
                  key={count}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectReservationDays(count)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {count} dia{count > 1 ? 's' : ''}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {WEEKDAY_ORDER.map((weekday) => {
              const available = availableWeekdays.has(weekday);
              const checked = selectedWeekdays.includes(weekday);
              return (
                <label key={weekday} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${available ? 'border-slate-300 text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  <input type="checkbox" checked={checked} disabled={!available} onChange={() => toggleWeekday(weekday)} />
                  {formatWeekday(weekday)}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Puedes elegir de 1 a 3 dias de la semana. La app sumara todos los dias y generara un solo pago semanal.</p>
        </div>

        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p>Dias seleccionados: {selectedWeekdays.length ? selectedWeekdays.map((day) => formatWeekday(day)).join(', ') : 'Sin seleccionar'}</p>
          <p>Precio por asiento: ${trip.pricePerSeatSnapshot.toFixed(2)} MXN</p>
          <p>Asientos por dia: {totalSeats}</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">Total a pagar: ${totalAmount.toFixed(2)} MXN</p>
          <p className="mt-1 text-xs text-slate-500">El total suma dias seleccionados por asientos. Pagaras desde Mercado Pago y subiras comprobante.</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
            <p>{error}</p>
            {showVerificationLink && (
              <Link href="/dashboard/verification" className="mt-2 inline-block underline">
                Completar verificacion
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || trip.remainingSeats < 1}
          className="w-full rounded-md bg-brand-500 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Reservando...' : 'Confirmar reserva y pagar'}
        </button>
      </form>
    </section>
  );
}
