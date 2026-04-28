'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { inferRouteCorridor } from '@/lib/route-corridors';
import { CreateReservationByOfferPayload, RouteOffer, RouteOffersByRouteResponse } from '@/lib/route-offers';

const WEEKDAY_ES_LABEL: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sabado',
  sunday: 'Domingo'
};

const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatWeekdayInSpanish(value: string) {
  return WEEKDAY_ES_LABEL[value] ?? value;
}

export default function RouteOffersDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<RouteOffersByRouteResponse | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [totalSeats, setTotalSeats] = useState('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest<RouteOffersByRouteResponse>(`/route-offers/route/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response);
      if (response.offers[0]) {
        setSelectedOfferId(response.offers[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [params.id]);

  const corridor = useMemo(() => {
    if (!data?.route) return null;
    return inferRouteCorridor(data.route);
  }, [data]);

  const selectedOffer = useMemo(() => data?.offers.find((item) => item.id === selectedOfferId) ?? null, [data, selectedOfferId]);
  const availableWeekdays = useMemo(() => new Set(selectedOffer?.weekdays ?? []), [selectedOffer]);

  const grossAmount = useMemo(() => {
    if (!selectedOffer) return 0;
    const seats = Number.parseInt(totalSeats, 10);
    if (!Number.isInteger(seats) || seats < 1) return 0;
    return selectedWeekdays.length * seats * selectedOffer.pricePerSeat;
  }, [selectedOffer, totalSeats, selectedWeekdays]);

  const weeklyPromoApplied = selectedWeekdays.length >= 5;
  const finalAmount = weeklyPromoApplied ? grossAmount * 0.9334 : grossAmount;

  function toggleWeekday(weekday: string) {
    if (!availableWeekdays.has(weekday)) {
      setError('Ese dia no esta disponible para el conductor seleccionado.');
      return;
    }

    setError(null);
    setSelectedWeekdays((prev) => (prev.includes(weekday) ? prev.filter((item) => item !== weekday) : [...prev, weekday]));
  }

  async function reserveByOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!selectedOffer) {
      setError('Selecciona un conductor disponible.');
      return;
    }

    const seats = Number.parseInt(totalSeats, 10);
    if (!Number.isInteger(seats) || seats < 1) {
      setError('Selecciona una cantidad valida de asientos.');
      return;
    }

    if (selectedWeekdays.length === 0) {
      setError('Selecciona al menos un dia de la semana.');
      return;
    }

    const hasInvalid = selectedWeekdays.some((weekday) => !availableWeekdays.has(weekday));
    if (hasInvalid) {
      setError('Hay dias seleccionados fuera de la disponibilidad del conductor.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: CreateReservationByOfferPayload = {
      offerId: selectedOffer.id,
      selectedWeekdays,
      totalSeats: seats
    };

    try {
      const response = await apiRequest<{ totalDays: number; totalAmount: number; grossAmount: number; finalAmount: number; weeklyDiscountApplied: boolean; message: string }>('/reservations/by-offer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      setSuccess(response.message + ` Total final: $${response.finalAmount.toFixed(2)} MXN.`);
      setSelectedWeekdays([]);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la reserva por dias.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-700">Cargando conductores disponibles...</p>;

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Conductores disponibles por corredor</h1>
        <p className="text-sm text-slate-600">
          Ruta: {data?.route.title || `${data?.route.origin ?? ''} -> ${data?.route.destination ?? ''}`}. Elige conductor por referencia, precio y dias disponibles.
        </p>
        {corridor && (
          <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
            <p className="font-semibold">{corridor.name}</p>
            <p>{corridor.municipalities} {'->'} {corridor.destinationHub}</p>
            <p className="text-xs">{corridor.description}</p>
          </div>
        )}
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {!data || data.offers.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no hay conductores adheridos a esta ruta.</p>
          ) : (
            data.offers.map((offer: RouteOffer) => {
              const vehiclePhoto = buildApiAssetUrl(offer.vehiclePhotoUrl);
              const isSelected = selectedOfferId === offer.id;
              return (
                <article key={offer.id} className={`rounded-xl border p-5 shadow-sm ${isSelected ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{offer.driver?.fullName ?? 'Conductor'}</p>
                      <p className="text-sm text-slate-700">Precio por asiento: ${offer.pricePerSeat.toFixed(2)} MXN</p>
                      <p className="text-sm text-slate-700">Referencia de abordaje: {offer.boardingReference}</p>
                      <p className="text-sm text-slate-700">Dias: {offer.weekdays.map((day) => formatWeekdayInSpanish(day)).join(', ')}</p>
                      <p className="text-sm text-slate-700">Modalidad: {offer.serviceType === 'weekly' ? 'Semanal recurrente' : offer.serviceType === 'round_trip' ? 'Ida y vuelta' : 'Servicio unico'}</p>
                    </div>
                    {vehiclePhoto ? <img src={vehiclePhoto} alt="Auto del conductor" className="h-20 w-28 rounded-md border border-slate-200 object-cover" /> : null}
                  </div>
                  <button type="button" onClick={() => setSelectedOfferId(offer.id)} className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    {isSelected ? 'Conductor seleccionado' : 'Elegir conductor'}
                  </button>
                </article>
              );
            })
          )}
        </div>

        <form onSubmit={reserveByOffer} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reserva por dias de la semana</h2>
          <p className="text-sm text-slate-600">Selecciona los dias (Lunes a Domingo) en que necesitas transporte.</p>

          <label className="block text-sm text-slate-700">
            Asientos
            <input type="number" min={1} max={10} value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <div>
            <p className="text-sm text-slate-700">Elige dias de la semana</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {WEEKDAY_ORDER.map((weekday) => {
                const available = availableWeekdays.has(weekday);
                const checked = selectedWeekdays.includes(weekday);
                return (
                  <label key={weekday} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${available ? 'border-slate-300 text-slate-700' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!available}
                      onChange={() => toggleWeekday(weekday)}
                    />
                    {formatWeekdayInSpanish(weekday)}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">Los dias deshabilitados no estan disponibles con el conductor seleccionado.</p>
          </div>

          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            <p>Dias seleccionados: {selectedWeekdays.length}</p>
            {selectedWeekdays.length > 0 ? (
              <p className="mt-1 text-xs text-slate-600">{selectedWeekdays.map((day) => formatWeekdayInSpanish(day)).join(', ')}</p>
            ) : null}
            <p className="mt-2 text-slate-600">Total bruto: ${grossAmount.toFixed(2)} MXN</p>
            {weeklyPromoApplied ? <p className="mt-1 text-xs font-medium text-emerald-700">Reserva semanal detectada: se aplicara un beneficio especial al pagar.</p> : null}
            <p className="mt-2 text-lg font-semibold text-emerald-700">Total final: ${finalAmount.toFixed(2)} MXN</p>
          </div>

          <button type="submit" disabled={saving || !selectedOffer} className="w-full rounded-md bg-brand-500 px-4 py-2 font-medium text-white disabled:opacity-60">
            {saving ? 'Reservando...' : 'Reservar dias seleccionados'}
          </button>

          <Link href="/dashboard/my-reservations" className="block text-center text-sm text-brand-700 underline">Ver mis reservas</Link>
        </form>
      </div>
    </section>
  );
}


