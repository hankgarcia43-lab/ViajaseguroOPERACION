'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { AvailableTrip, CreateReservationPayload, Reservation } from '@/lib/reservations';
import { getTripStatusMeta } from '@/lib/status';

export default function ReserveTripPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params?.id;

  const [trip, setTrip] = useState<AvailableTrip | null>(null);
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el viaje');
      } finally {
        setLoading(false);
      }
    }

    void loadTrip();
  }, [tripId]);

  const totalAmount = useMemo(() => {
    if (!trip) return 0;
    return totalSeats * trip.pricePerSeatSnapshot;
  }, [trip, totalSeats]);

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

    setSaving(true);
    setError(null);

    const payload: CreateReservationPayload = {
      tripId: trip.id,
      totalSeats
    };

    try {
      const reservation = await apiRequest<Reservation>('/reservations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      router.push(`/dashboard/my-reservations/${reservation.id}/ticket`);
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
        <p className="text-sm text-slate-700">Fecha: {new Date(trip.tripDate).toLocaleDateString()}</p>
        <p className="text-sm text-slate-700">Salida: {trip.departureTimeSnapshot}</p>
        <p className="text-sm text-slate-700">Precio por asiento: ${trip.pricePerSeatSnapshot.toFixed(2)} MXN</p>
        <p className="text-sm text-slate-700">Asientos disponibles: {trip.remainingSeats}</p>
      </article>

      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
        <p className="font-semibold">Tip para usuarios frecuentes</p>
        <p className="mt-1">Si vas a trabajar toda la semana, prioriza tu reserva semanal para asegurar lugar y mantener tarifa estable.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm text-slate-700">
          Total de asientos
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

        <p className="text-sm text-slate-700">Total calculado: ${totalAmount.toFixed(2)} MXN</p>

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
          {saving ? 'Reservando...' : 'Confirmar reserva'}
        </button>
      </form>
    </section>
  );
}

