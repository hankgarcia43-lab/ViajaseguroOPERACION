'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { SafetyActionsPanel } from '@/components/safety-actions-panel';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { APP_COMPANY_NAME, formatCurrency } from '@/lib/app-config';
import { getVerificationStatusMeta } from '@/lib/status';
import { Incident } from '@/lib/incidents';
import { Payment } from '@/lib/payments';
import { Reservation } from '@/lib/reservations';
import { DriverTrip } from '@/lib/trips';

interface MeResponse {
  fullName: string;
  email: string;
  role: 'passenger' | 'driver' | 'admin';
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  driverProfile: { id: string; status: string } | null;
  passengerProfile: { id: string; status: string } | null;
}

const PASSENGER_HISTORY_STATUSES = new Set(['cancelled', 'no_show', 'refunded', 'completed']);
const TRIP_HISTORY_STATUSES = new Set(['finished', 'cancelled']);

function isReservationHistory(reservation: Reservation) {
  return PASSENGER_HISTORY_STATUSES.has(reservation.status) || TRIP_HISTORY_STATUSES.has(String(reservation.trip?.status ?? '').toLowerCase());
}

function isReservationInCourse(reservation: Reservation) {
  return reservation.trip?.status === 'started' && !isReservationHistory(reservation);
}

function isReservationPaid(reservation: Reservation) {
  return reservation.status === 'paid' || reservation.payment?.status === 'approved' || reservation.boardingCodeEnabled;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatFullTripDate(value?: string | null) {
  if (!value) return 'Fecha pendiente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha pendiente';
  return capitalize(new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date));
}

function formatTimeLabel(value?: string | null) {
  if (!value) return 'Horario pendiente';
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number.parseInt(hourRaw ?? '', 10);
  const minute = Number.parseInt(minuteRaw ?? '', 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const date = new Date(Date.UTC(2026, 0, 1, hour, minute, 0));
  return new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
    .format(date)
    .replace(' a.m.', ' AM')
    .replace(' p.m.', ' PM');
}

function StatCard({ label, value, helper, tone = 'slate' }: { label: string; value: string | number; helper?: string; tone?: 'slate' | 'sky' | 'emerald' | 'amber' | 'rose' }) {
  const toneClass = {
    slate: 'border-slate-200 bg-white text-slate-950',
    sky: 'border-sky-200 bg-sky-50 text-sky-950',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950'
  }[tone];

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {helper && <p className="mt-1 text-xs font-medium opacity-80">{helper}</p>}
    </article>
  );
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [driverTrips, setDriverTrips] = useState<DriverTrip[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishBusy, setFinishBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        setError('No hay sesion activa. Inicia sesion primero.');
        setLoading(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const data = await apiRequest<MeResponse>('/auth/me', { headers });
        setMe(data);
        setStatsError(null);
        setReservations([]);
        setPayments([]);
        setDriverTrips([]);
        setIncidents([]);

        try {
          if (data.role === 'passenger') {
            const [reservationData, paymentData, incidentData] = await Promise.all([
              apiRequest<Reservation[]>('/reservations/my-reservations', { headers }),
              apiRequest<Payment[]>('/payments/my-payments?includeArchived=true', { headers }),
              apiRequest<Incident[]>('/incidents/my', { headers })
            ]);
            setReservations(reservationData);
            setPayments(paymentData);
            setIncidents(incidentData);
          }

          if (data.role === 'driver') {
            const [tripData, incidentData] = await Promise.all([
              apiRequest<DriverTrip[]>('/trips/my-trips', { headers }),
              apiRequest<Incident[]>('/incidents/my', { headers })
            ]);
            setDriverTrips(tripData);
            setIncidents(incidentData);
          }
        } catch (statsRequestError) {
          setStatsError(statsRequestError instanceof Error ? statsRequestError.message : 'No se pudieron cargar algunas estadisticas.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return <p className="text-slate-700">Cargando tu panel...</p>;
  }

  if (error) {
    return <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>;
  }

  if (!me) return null;

  const verificationMeta = getVerificationStatusMeta(me.verificationStatus);

  const roleCopy = {
    passenger: {
      title: 'Encuentra una ruta confiable y reserva sin complicaciones',
      subtitle: 'Elige corredor, compara conductor, selecciona dias de viaje y conserva tu boleto en el panel.',
      chips: ['Punto de abordaje claro', 'Reserva semanal disponible', 'Boleto con datos del viaje']
    },
    driver: {
      title: 'Genera ingresos trasladando personas cerca de tu ruta diaria',
      subtitle: 'Si ya manejas hacia una zona de trabajo, toma una ruta compatible, publica tus horarios y llena asientos disponibles con pasajeros verificados.',
      chips: ['Aprovecha tu trayecto', 'Define horarios y referencias', 'Solicita liquidacion semanal']
    },
    admin: {
      title: 'Control total para una operacion ordenada',
      subtitle: `Administra rutas, verificaciones, pagos y liquidaciones desde un tablero central de ${APP_COMPANY_NAME}.`,
      chips: ['Mayor control', 'Aprobaciones seguras', 'Operacion demostrable']
    }
  }[me.role];

  const roleGuide =
    me.role === 'passenger'
      ? {
          subtitle: 'Sigue este orden para evitar bloqueos en el viaje.',
          points: [
            'Completa verificacion con INE frente y reverso.',
            'Selecciona uno o mas dias si viajas por semana.',
            'Paga el total de tus asientos y dias en un solo movimiento.',
            'Sube comprobante y espera validacion admin.',
            'Cuando el pago este aprobado se habilita tu boleto.'
          ],
          nextStep: 'Ir a buscar viajes o revisar tus reservas.',
          ctaHref: '/dashboard/search-trips',
          ctaLabel: 'Buscar viajes'
        }
      : me.role === 'driver'
      ? {
          subtitle: 'Flujo rapido para operar sin friccion.',
          points: [
            'Manten tu verificacion y vehiculo en estado aprobado.',
            'Toma una ruta que coincida con tu trayecto real de trabajo.',
            'Registra horario, dias, asientos y referencia exacta de abordaje.',
            'Inicia viaje y valida a cada pasajero con su codigo numerico.',
            'Consulta tus ganancias y liquidaciones.'
          ],
          nextStep: 'Tomar ruta activa y continuar en Mis viajes.',
          ctaHref: '/dashboard/routes',
          ctaLabel: 'Ir a rutas'
        }
      : {
          subtitle: 'Prioriza estos puntos para mantener la operacion estable.',
          points: [
            'Crea solo rutas piloto reales y elimina o pausa las que no se operen.',
            'Aprueba verificaciones de usuario y vehiculo.',
            'Valida pagos para habilitar abordajes.',
            'Revisa personas registradas antes de promover o suspender cuentas.',
            'Cierra la semana con liquidaciones claras.'
          ],
          nextStep: 'Entrar al panel admin y revisar pendientes.',
          ctaHref: '/dashboard/admin',
          ctaLabel: 'Ir a panel admin'
        };

  const passengerUpcoming = reservations.filter((reservation) => !isReservationHistory(reservation) && reservation.trip?.status === 'scheduled').length;
  const passengerInCourse = reservations.filter(isReservationInCourse).length;
  const passengerFinished = reservations.filter(isReservationHistory).length;
  const passengerPaid = reservations.filter(isReservationPaid).length;
  const passengerInReview = payments.filter((payment) => payment.status === 'submitted').length;
  const passengerUsedTickets = reservations.filter((reservation) => reservation.status === 'boarded' || reservation.status === 'completed').length;
  const driverUpcoming = driverTrips.filter((trip) => trip.status === 'scheduled').length;
  const driverInCourse = driverTrips.filter((trip) => trip.status === 'started').length;
  const driverFinished = driverTrips.filter((trip) => TRIP_HISTORY_STATUSES.has(trip.status)).length;
  const driverPassengersTransported = driverTrips
    .filter((trip) => trip.status === 'finished')
    .reduce((total, trip) => total + (trip.reservationSummary?.reservedSeats ?? 0), 0);
  const driverTicketsOperated = driverTrips
    .filter((trip) => trip.status === 'finished')
    .reduce((total, trip) => total + (trip.reservationSummary?.reservationsCount ?? 0), 0);
  const driverEstimatedIncome = driverTrips.reduce((total, trip) => total + (trip.earningsSummary?.driverNetAfterRefunds ?? 0), 0);
  const currentPassengerReservation = reservations.find(isReservationInCourse) ?? null;
  const currentDriverTrip = driverTrips.find((trip) => trip.status === 'started') ?? null;
  const currentPassengerVehiclePhotoUrl = buildApiAssetUrl(currentPassengerReservation?.trip?.vehiclePhotoUrl);

  async function finishCurrentTrip(tripId: string) {
    const token = getToken();
    if (!token) {
      setStatsError('No hay sesion activa.');
      return;
    }

    setFinishBusy(true);
    setStatsError(null);

    try {
      await apiRequest(`/trips/${tripId}/finish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDriverTrips((current) => current.map((trip) => (trip.id === tripId ? { ...trip, status: 'finished' } : trip)));
    } catch (requestError) {
      setStatsError(requestError instanceof Error ? requestError.message : 'No se pudo finalizar el viaje.');
    } finally {
      setFinishBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-[0_30px_90px_-45px_rgba(7,17,31,0.85)] md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(21,184,166,0.25),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_25%)]" />
        <div className="relative space-y-5">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">Panel {me.role}</span>
          <div>
            <h1 className="text-4xl font-semibold leading-tight">{roleCopy.title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200">{roleCopy.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">{me.fullName}</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">{me.email}</span>
            <span className={`rounded-full px-4 py-2 text-sm font-medium ${verificationMeta.className}`}>Verificacion: {verificationMeta.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {roleCopy.chips.map((chip) => (
              <span key={chip} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-slate-100">{chip}</span>
            ))}
          </div>
        </div>
      </header>

      {statsError && me.role !== 'admin' && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">No se pudieron cargar algunas estadisticas: {statsError}</p>
      )}

      {me.role === 'passenger' && currentPassengerReservation && (
        <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Viaje en curso</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {currentPassengerReservation.trip?.route?.title || `${currentPassengerReservation.trip?.route?.origin || 'Ruta'} -> ${currentPassengerReservation.trip?.route?.destination || ''}`}
              </h2>
              <p className="mt-2 text-sm font-semibold text-emerald-900">
                Tu viaje esta en curso. Mantente atento al punto de descenso y reporta cualquier situacion sospechosa.
              </p>
            </div>
            <Link href={`/dashboard/my-reservations/${currentPassengerReservation.id}/ticket`} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">
              Ver boleto de hoy
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Fecha y horario</p>
              <p className="mt-1 font-black text-slate-950">{formatFullTripDate(currentPassengerReservation.trip?.tripDate)}</p>
              <p className="text-sm text-slate-700">{formatTimeLabel(currentPassengerReservation.trip?.departureTimeSnapshot)}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Conductor</p>
              <p className="mt-1 font-black text-slate-950">{currentPassengerReservation.trip?.driver?.fullName ?? 'Por confirmar'}</p>
              <p className="text-sm text-slate-700">Vehiculo asignado si aparece foto aprobada.</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Punto de abordaje</p>
              <p className="mt-1 font-black text-slate-950">{currentPassengerReservation.trip?.boardingReference ?? 'Pendiente de referencia'}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Destino</p>
              <p className="mt-1 font-black text-slate-950">{currentPassengerReservation.trip?.route?.destination ?? 'Destino pendiente'}</p>
              <p className="text-sm text-slate-700">Aborda solo en puntos publicos y visibles.</p>
            </div>
          </div>
          {currentPassengerVehiclePhotoUrl && (
            <img src={currentPassengerVehiclePhotoUrl} alt="Foto del vehiculo asignado" className="h-44 w-full rounded-xl border border-emerald-200 object-cover md:h-56" />
          )}
          <SafetyActionsPanel
            role="passenger"
            tripId={currentPassengerReservation.tripId}
            reservationId={currentPassengerReservation.id}
            routeId={currentPassengerReservation.trip?.route?.id}
            contextLabel={currentPassengerReservation.trip?.route?.title ?? 'Viaje en curso del pasajero'}
          />
        </section>
      )}

      {me.role === 'driver' && currentDriverTrip && (
        <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Viaje en curso</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {currentDriverTrip.route?.title || `${currentDriverTrip.route?.origin || 'Ruta'} -> ${currentDriverTrip.route?.destination || ''}`}
              </h2>
              <p className="mt-2 text-sm font-semibold text-emerald-900">
                Viaje en curso. Manten la validacion de pasajeros actualizada y reporta cualquier incidente.
              </p>
            </div>
            <button
              type="button"
              disabled={finishBusy}
              onClick={() => void finishCurrentTrip(currentDriverTrip.id)}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-700"
            >
              {finishBusy ? 'Finalizando...' : 'Finalizar viaje'}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pasajeros esperados" value={currentDriverTrip.reservationSummary?.reservedSeats ?? 0} tone="sky" />
            <StatCard label="Pasajeros abordados" value={currentDriverTrip.reservationSummary?.boardedSeats ?? 0} tone="emerald" />
            <StatCard label="Pasajeros pendientes" value={currentDriverTrip.reservationSummary?.pendingSeats ?? 0} tone="amber" />
            <StatCard label="Boletos pendientes" value={currentDriverTrip.reservationSummary?.pendingReservationsCount ?? 0} tone="amber" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Fecha y horario</p>
              <p className="mt-1 font-black text-slate-950">{formatFullTripDate(currentDriverTrip.tripDate)}</p>
              <p className="text-sm text-slate-700">{formatTimeLabel(currentDriverTrip.departureTimeSnapshot)}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Punto de abordaje</p>
              <p className="mt-1 font-black text-slate-950">{currentDriverTrip.boardingReference ?? 'Sin definir'}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Validacion</p>
              <Link href={`/dashboard/trips/${currentDriverTrip.id}/boarding`} className="mt-1 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                Validar boletos
              </Link>
            </div>
          </div>
          <SafetyActionsPanel
            role="driver"
            tripId={currentDriverTrip.id}
            routeId={currentDriverTrip.routeId}
            contextLabel={currentDriverTrip.route?.title ?? 'Viaje en curso del conductor'}
          />
        </section>
      )}

      {me.role === 'passenger' && (
        <section className="space-y-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm">
            <p className="font-bold">Tus datos terminados quedan en historial para no saturar el panel principal.</p>
            <p className="mt-1">Muestra al conductor el codigo correspondiente a la fecha del viaje y revisa la fecha antes de compartirlo.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Viajes proximos" value={passengerUpcoming} tone="sky" />
            <StatCard label="Viajes en curso" value={passengerInCourse} tone="emerald" />
            <StatCard label="Viajes terminados" value={passengerFinished} tone="slate" />
            <StatCard label="Reservas pagadas" value={passengerPaid} tone="emerald" />
            <StatCard label="Reservas en revision" value={passengerInReview} tone="amber" />
            <StatCard label="Boletos usados" value={passengerUsedTickets} tone="slate" />
            <StatCard label="Historial de viajes" value={passengerFinished} helper="Terminados o archivados" tone="slate" />
            <StatCard label="Alertas/reportes" value={incidents.length} helper="Enviados por tu cuenta" tone="rose" />
          </div>
        </section>
      )}

      {me.role === 'driver' && (
        <section className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
            <p className="font-bold">Valida unicamente boletos del dia y horario correspondiente.</p>
            <p className="mt-1">El panel principal muestra viajes activos o pendientes; los terminados y cancelados pasan a historial/archivo.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Viajes proximos" value={driverUpcoming} tone="sky" />
            <StatCard label="Viajes en curso" value={driverInCourse} tone="emerald" />
            <StatCard label="Viajes terminados" value={driverFinished} tone="slate" />
            <StatCard label="Pasajeros transportados" value={driverPassengersTransported} tone="emerald" />
            <StatCard label="Boletos operados" value={driverTicketsOperated} helper="Estimado por viajes terminados" tone="slate" />
            <StatCard label="Ingresos estimados" value={formatCurrency(driverEstimatedIncome)} helper="Segun liquidaciones disponibles" tone="emerald" />
            <StatCard label="Reportes/incidencias" value={incidents.length} tone="rose" />
            <StatCard label="Historial semanal" value={driverFinished} helper="Cerrados o archivables" tone="slate" />
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {me.role === 'driver' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <article className="vs-card">
                <p className="vs-kicker">Paso 1</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Verificacion y vehiculo</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Antes de operar, confirma tus aprobaciones para evitar bloqueos.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/verification" className="vs-button-secondary">Verificacion</Link>
                  <Link href="/dashboard/vehicle" className="vs-button-accent">Mi vehiculo</Link>
                </div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Paso 2</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Tomar ruta activa</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Elige una ruta cercana a tu traslado diario. Publica tus horarios, punto de abordaje y asientos disponibles para recibir reservas.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/routes" className="vs-button-accent">Tomar rutas</Link>
                  <Link href="/dashboard/trips" className="vs-button-secondary">Ver mis viajes</Link>
                </div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Paso 3</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Abordaje y liquidacion</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Cuando el pasajero pague y admin valide, veras la reserva. Al completar viajes, solicita tu liquidacion semanal.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/trips" className="vs-button-accent">Mis viajes</Link>
                  <Link href="/dashboard/driver/payouts" className="vs-button-secondary">Mis liquidaciones</Link>
                </div>
              </article>
            </div>
          )}

          {me.role === 'passenger' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <article className="vs-card">
                <p className="vs-kicker">Buscar</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Viaja con horario fijo y tarifa clara</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Consulta viajes disponibles, ocupacion y hora de salida antes de reservar.</p>
                <div className="mt-5 flex flex-wrap gap-2"><Link href="/dashboard/search-trips" className="vs-button-accent">Buscar viajes</Link></div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Reservar</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Sigue tu reserva sin perderte</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Revisa ticket, estado del pago y cuando se habilita tu codigo de abordaje.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/my-reservations" className="vs-button-secondary">Mis reservas</Link>
                  <Link href="/dashboard/my-payments" className="vs-button-secondary">Mis pagos</Link>
                </div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Confianza</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Mas orden, mas seguridad</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Completa tu verificacion para evitar bloqueos y mantener el flujo activo.</p>
                <div className="mt-5"><Link href="/dashboard/verification" className="vs-button-secondary">Ir a verificacion</Link></div>
              </article>
            </div>
          )}

          {me.role === 'admin' && (
            <article className="vs-card">
              <p className="vs-kicker">Centro de control</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">Panel operativo del MVP</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Publica rutas, autoriza cuentas, valida pagos y supervisa viajes desde un solo lugar.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/dashboard/admin" className="vs-button-accent">Abrir panel admin</Link>
                <Link href="/dashboard/admin/payments" className="vs-button-secondary">Pagos</Link>
                <Link href="/dashboard/admin/verifications" className="vs-button-secondary">Verificaciones</Link>
              </div>
            </article>
          )}
        </div>

        <ContextHelpPanel
          title="Guia rapida"
          subtitle={roleGuide.subtitle}
          points={roleGuide.points}
          nextStep={roleGuide.nextStep}
          ctaHref={roleGuide.ctaHref}
          ctaLabel={roleGuide.ctaLabel}
        />
      </div>
    </section>
  );
}




