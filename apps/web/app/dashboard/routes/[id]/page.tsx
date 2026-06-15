'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RouteHighlightCard } from '@/components/route-highlight-card';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { inferRouteCorridor } from '@/lib/route-corridors';
import { routeClusterKey, splitRouteOrigin } from '@/lib/route-display';
import { BaseRouteSummary, CreateReservationByOfferPayload, RouteOffer, RouteOffersByRouteResponse } from '@/lib/route-offers';

type UserRole = 'passenger' | 'driver' | 'admin';

interface MeResponse {
  role: UserRole;
}

interface TownGroup {
  town: string;
  route: BaseRouteSummary;
  offers: Array<{ offer: RouteOffer; route: BaseRouteSummary }>;
}

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

function normalizeKey(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parseBoardingReference(raw: string) {
  const text = String(raw ?? '').trim();
  const reference = text.match(/Salida - Referencia:\s*(.*?)\.\s*Salida - Direccion exacta:/i)?.[1]?.trim();
  const address = text.match(/Salida - Direccion exacta:\s*(.*?)(?:\.\s*Regreso CDMX - Hora:|$)/i)?.[1]?.trim();
  const returnTime = text.match(/Regreso CDMX - Hora:\s*([01]\d|2[0-3]):[0-5]\d/i)?.[1]?.trim();
  const returnReference = text.match(/Regreso CDMX - Referencia:\s*(.*?)\.\s*Regreso CDMX - Direccion exacta:/i)?.[1]?.trim();

  return {
    reference: reference || text,
    address: address || '',
    returnTime: returnTime || '',
    returnReference: returnReference || ''
  };
}

export default function RouteOffersDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routeId = String(params?.id ?? '').trim();
  const [role, setRole] = useState<UserRole | null>(null);
  const [data, setData] = useState<RouteOffersByRouteResponse | null>(null);
  const [routeDetails, setRouteDetails] = useState<RouteOffersByRouteResponse[]>([]);
  const [selectedTown, setSelectedTown] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [totalSeats, setTotalSeats] = useState('1');
  const [reservationMode, setReservationMode] = useState<'single' | 'weekly'>('single');
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
      const headers = { Authorization: `Bearer ${token}` };
      const [profile, response] = await Promise.all([
        apiRequest<MeResponse>('/auth/me', { headers }).catch(() => null),
        apiRequest<RouteOffersByRouteResponse>(`/route-offers/route/${routeId}`, { headers })
      ]);

      if (profile?.role) setRole(profile.role);

      let details: RouteOffersByRouteResponse[] = [response];
      try {
        const allRoutes = await apiRequest<BaseRouteSummary[]>('/route-offers/routes', { headers });
        const currentCluster = routeClusterKey(response.route);
        const siblingRoutes = allRoutes
          .filter((route) => route.id !== response.route.id && routeClusterKey(route) === currentCluster)
          .slice(0, 12);
        const siblingDetails = await Promise.all(
          siblingRoutes.map((route) => apiRequest<RouteOffersByRouteResponse>(`/route-offers/route/${route.id}`, { headers }).catch(() => null))
        );
        details = [response, ...siblingDetails.filter((item): item is RouteOffersByRouteResponse => Boolean(item))];
      } catch {
        details = [response];
      }

      setData(response);
      setRouteDetails(details);

      const firstGroup = buildTownGroups(details).find((group) => group.offers.length > 0) ?? buildTownGroups(details)[0];
      setSelectedTown(firstGroup?.town ?? '');
      setSelectedOfferId(firstGroup?.offers[0]?.offer.id ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [routeId]);

  const corridor = useMemo(() => {
    if (!data?.route) return null;
    return inferRouteCorridor(data.route);
  }, [data]);

  function buildTownGroups(details: RouteOffersByRouteResponse[]) {
    const groups = new Map<string, TownGroup>();

    for (const detail of details) {
      const { town } = splitRouteOrigin(detail.route.origin);
      const key = normalizeKey(town);
      const existing = groups.get(key) ?? { town, route: detail.route, offers: [] };
      existing.offers.push(...detail.offers.map((offer) => ({ offer, route: detail.route })));
      groups.set(key, existing);
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.offers.length !== b.offers.length) return b.offers.length - a.offers.length;
      return a.town.localeCompare(b.town);
    });
  }

  const townGroups = useMemo(() => buildTownGroups(routeDetails), [routeDetails]);
  const selectedTownGroup = useMemo(() => townGroups.find((group) => group.town === selectedTown) ?? townGroups[0] ?? null, [selectedTown, townGroups]);
  const selectedOfferRow = useMemo(() => selectedTownGroup?.offers.find((item) => item.offer.id === selectedOfferId) ?? selectedTownGroup?.offers[0] ?? null, [selectedOfferId, selectedTownGroup]);
  const selectedOffer = selectedOfferRow?.offer ?? null;

  useEffect(() => {
    setSelectedWeekdays([]);
    setReservationMode('single');
    setError(null);
  }, [selectedOfferId]);

  useEffect(() => {
    if (!selectedTownGroup) return;
    setSelectedOfferId(selectedTownGroup.offers[0]?.offer.id ?? '');
  }, [selectedTownGroup]);

  const availableWeekdayList = useMemo(() => (selectedOffer ? WEEKDAY_ORDER.filter((day) => selectedOffer.weekdays.includes(day)) : []), [selectedOffer]);
  const availableWeekdays = useMemo(() => new Set(availableWeekdayList), [availableWeekdayList]);

  const grossAmount = useMemo(() => {
    if (!selectedOffer) return 0;
    const seats = Number.parseInt(totalSeats, 10);
    if (!Number.isInteger(seats) || seats < 1) return 0;
    return selectedWeekdays.length * seats * selectedOffer.pricePerSeat;
  }, [selectedOffer, totalSeats, selectedWeekdays]);

  const weeklyDiscountApplied = selectedWeekdays.length > 1;
  const discountAmount = weeklyDiscountApplied ? Math.round(grossAmount * 0.1 * 100) / 100 : 0;
  const finalAmount = Math.max(0, Math.round((grossAmount - discountAmount) * 100) / 100);

  function toggleWeekday(weekday: string) {
    if (!availableWeekdays.has(weekday)) {
      setError('Ese dia no esta disponible para el conductor seleccionado.');
      return;
    }

    setError(null);
    setSelectedWeekdays((current) => {
      if (current.includes(weekday)) return current.filter((item) => item !== weekday);
      if (current.length >= 7) {
        setError('Puedes seleccionar maximo 7 dias por semana.');
        return current;
      }
      return [...current, weekday];
    });
  }

  function selectSingleDay() {
    if (!selectedOffer) {
      setError('Selecciona un conductor disponible.');
      return;
    }

    const nextDay = availableWeekdayList[0];
    if (!nextDay) {
      setError('No hay dias disponibles para este conductor.');
      return;
    }

    setReservationMode('single');
    setError(null);
    setSelectedWeekdays([nextDay]);
  }

  function selectWeeklyTrip() {
    if (!selectedOffer) {
      setError('Selecciona un conductor disponible.');
      return;
    }

    const nextDays = availableWeekdayList.slice(0, 7);
    if (nextDays.length < 2) {
      setError('Para viaje semanal se necesitan al menos 2 dias disponibles.');
      setSelectedWeekdays(nextDays);
      return;
    }

    setReservationMode('weekly');
    setError(null);
    setSelectedWeekdays(nextDays);
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
      setError('Selecciona el dia del viaje.');
      return;
    }

    const hasInvalid = selectedWeekdays.some((weekday) => !availableWeekdays.has(weekday));
    if (hasInvalid) {
      setError('El dia seleccionado no esta dentro de la disponibilidad del conductor.');
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
      const response = await apiRequest<{ totalDays: number; totalAmount: number; grossAmount: number; finalAmount: number; weeklyDiscountApplied: boolean; primaryReservationId?: string | null; message: string }>('/reservations/by-offer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      setSuccess(response.message + ` Total final: $${response.finalAmount.toFixed(2)} MXN. Te llevamos a pagos para subir tu comprobante.`);
      setSelectedWeekdays([]);
      setTimeout(() => {
        const target = response.totalDays === 1 && response.primaryReservationId ? `/dashboard/my-payments?reservation=${response.primaryReservationId}` : '/dashboard/my-payments';
        router.push(target);
      }, 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la reserva por dias.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-700">Cargando conductores disponibles...</p>;

  return (
    <section className="space-y-5">
      <header className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Elige poblado y conductor</h1>
          <p className="text-sm text-slate-600">Primero selecciona el poblado o paradero. Despues veras conductores con referencia, horario y precio resaltados.</p>
        </div>
        {data?.route && (
          <RouteHighlightCard
            title={data.route.title}
            origin={splitRouteOrigin(data.route.origin).municipality}
            destination={data.route.destination}
            weekdays={data.route.weekdays}
            departureTime={data.route.departureTime}
            estimatedArrivalTime={data.route.estimatedArrivalTime}
            pricePerSeat={data.route.pricePerSeat}
            distanceKm={data.route.distanceKm}
            activeDriversCount={townGroups.reduce((total, group) => total + group.offers.length, 0)}
            badge={corridor?.name ?? 'Ruta publicada'}
            showTown={false}
            showBoardingReference={false}
            tone="priority"
          />
        )}
        {corridor && <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">{corridor.description}</p>}
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-cyan-700">Poblados y paraderos</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Selecciona donde quieres abordar</h2>
            <p className="text-sm text-slate-600">Los paraderos con mas conductores aparecen primero para que encuentres opciones mas rapido.</p>
          </div>
          {selectedTownGroup && role === 'driver' && (
            <Link href={`/dashboard/routes/${selectedTownGroup.route.id}/take`} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
              Tomar esta ruta
            </Link>
          )}
        </div>

        {townGroups.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Aun no hay poblados publicados para esta ruta.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {townGroups.map((group) => {
              const active = group.town === selectedTown;
              const highFlow = group.offers.length >= 2;
              return (
                <button
                  key={group.town}
                  type="button"
                  onClick={() => setSelectedTown(group.town)}
                  className={`rounded-xl border p-4 text-left shadow-sm transition ${active ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-cyan-300 hover:bg-cyan-50'}`}
                >
                  <p className="text-xs font-bold uppercase text-slate-500">Poblado / paradero</p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-950">{group.town}</p>
                  <p className="mt-2 text-sm font-semibold text-cyan-800">{group.offers.length} conductores disponibles</p>
                  {highFlow && <p className="mt-2 rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">Paradero con alto flujo</p>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {!selectedTownGroup || selectedTownGroup.offers.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
              <p className="font-semibold text-slate-900">Aun no hay conductores en este poblado.</p>
              <p className="mt-1 text-sm">Puedes revisar otro poblado o invitar a un conductor de esta zona a tomar la ruta.</p>
              {selectedTownGroup && role === 'driver' && (
                <Link href={`/dashboard/routes/${selectedTownGroup.route.id}/take`} className="mt-3 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
                  Ser el primer conductor aqui
                </Link>
              )}
            </div>
          ) : (
            selectedTownGroup.offers.map(({ offer, route }) => {
              const vehiclePhoto = buildApiAssetUrl(offer.vehiclePhotoUrl);
              const isSelected = selectedOfferId === offer.id;
              const boarding = parseBoardingReference(offer.boardingReference);
              return (
                <article key={offer.id} className={`rounded-xl border p-4 shadow-sm ${isSelected ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-brand-700">Conductor disponible</p>
                      <p className="text-lg font-bold text-slate-950">{offer.driver?.fullName ?? 'Conductor'}</p>
                      <p className="text-sm font-semibold text-cyan-800">{selectedTownGroup.town}</p>
                    </div>
                    {vehiclePhoto ? <img src={vehiclePhoto} alt="Auto del conductor" className="h-20 w-28 rounded-md border border-slate-200 object-cover" /> : null}
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px]">
                    <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
                      <p className="text-xs font-bold uppercase text-cyan-900">Referencia de abordaje</p>
                      <p className="mt-1 break-words text-base font-bold leading-relaxed text-slate-950">{boarding.reference}</p>
                      {boarding.address && <p className="mt-1 break-words text-sm text-slate-700">{boarding.address}</p>}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {offer.weekdays.map((day) => (
                          <span key={day} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-cyan-900 shadow-sm">{formatWeekdayInSpanish(day)}</span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-slate-600">Modalidad: {offer.serviceType === 'weekly' ? 'Semanal recurrente' : offer.serviceType === 'round_trip' ? 'Ida y vuelta' : 'Servicio unico'}</p>
                      {boarding.returnTime && <p className="mt-1 text-xs text-slate-600">Regreso: {boarding.returnTime} {boarding.returnReference ? `- ${boarding.returnReference}` : ''}</p>}
                    </div>

                    <div className="rounded-lg bg-slate-950 p-4 text-center text-white">
                      <p className="text-xs font-bold uppercase opacity-80">Horario</p>
                      <p className="mt-1 text-xl font-black">{route.departureTime}</p>
                      <p className="text-xs opacity-80">llega {route.estimatedArrivalTime}</p>
                      <p className="mt-4 text-xs font-bold uppercase opacity-80">Por asiento</p>
                      <p className="mt-1 whitespace-nowrap text-2xl font-black xl:text-3xl">${offer.pricePerSeat.toFixed(2)}</p>
                      <p className="text-xs font-semibold opacity-90">MXN</p>
                    </div>
                  </div>

                  <button type="button" onClick={() => setSelectedOfferId(offer.id)} className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    {isSelected ? 'Conductor seleccionado' : 'Elegir conductor'}
                  </button>
                </article>
              );
            })
          )}
        </div>

        {role === 'driver' ? (
          <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Publica tu disponibilidad</h2>
            <p className="text-sm text-slate-600">Si este poblado tiene alto flujo o pasas seguido por aqui, toma la ruta y publica tus asientos.</p>
            {selectedTownGroup && (
              <Link href={`/dashboard/routes/${selectedTownGroup.route.id}/take`} className="block rounded-md bg-emerald-700 px-4 py-2 text-center text-sm font-medium text-white">
                Tomar ruta en {selectedTownGroup.town}
              </Link>
            )}
          </aside>
        ) : (
          <form onSubmit={reserveByOffer} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Arma tu reserva</h2>
            <p className="text-sm text-slate-600">Elige 1 dia o viaje semanal. Si reservas mas de un dia, se aplica 10% de descuento y pagas todo en un solo movimiento.</p>

            <label className="block text-sm text-slate-700">
              Asientos
              <input type="number" min={1} max={10} value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>

            <div>
              <p className="text-sm text-slate-700">Tipo de reserva</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={availableWeekdayList.length === 0}
                  onClick={selectSingleDay}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${reservationMode === 'single' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  1 dia
                </button>
                <button
                  type="button"
                  disabled={availableWeekdayList.length < 2}
                  onClick={selectWeeklyTrip}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${reservationMode === 'weekly' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Viaje semanal -10%
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {WEEKDAY_ORDER.map((weekday) => {
                  const available = availableWeekdays.has(weekday);
                  const checked = selectedWeekdays.includes(weekday);
                  return (
                    <label key={weekday} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${available ? 'border-slate-300 text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
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
              <p className="mt-2 text-xs text-slate-500">Puedes ajustar los dias disponibles del conductor. Si eliges 2 o mas dias, se aplica 10% de descuento semanal.</p>
            </div>

            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <p>Conductor: {selectedOffer?.driver?.fullName ?? 'Sin seleccionar'}</p>
              <p>Poblado: {selectedTownGroup?.town ?? 'Sin seleccionar'}</p>
              <p>Dias seleccionados: {selectedWeekdays.length ? selectedWeekdays.map((day) => formatWeekdayInSpanish(day)).join(', ') : 'Sin seleccionar'}</p>
              <p className="mt-2 text-slate-600">Precio por asiento: ${selectedOffer?.pricePerSeat.toFixed(2) ?? '0.00'} MXN</p>
              <p className="text-slate-600">Asientos: {Number.parseInt(totalSeats, 10) || 0}</p>
              <p className="mt-2 text-slate-600">Subtotal: ${grossAmount.toFixed(2)} MXN</p>
              {weeklyDiscountApplied && <p className="text-emerald-700">Descuento semanal 10%: -${discountAmount.toFixed(2)} MXN</p>}
              <p className="mt-2 text-lg font-semibold text-emerald-700">Total final: ${finalAmount.toFixed(2)} MXN</p>
            </div>

            <button type="submit" disabled={saving || !selectedOffer} className="w-full rounded-md bg-brand-500 px-4 py-2 font-medium text-white disabled:opacity-60">
              {saving ? 'Reservando...' : 'Confirmar reserva'}
            </button>

            <Link href="/dashboard/my-reservations" className="block text-center text-sm text-brand-700 underline">Ver mis reservas</Link>
          </form>
        )}
      </div>
    </section>
  );
}
