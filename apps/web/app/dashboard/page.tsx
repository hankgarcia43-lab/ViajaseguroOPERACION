'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { SafetyActionsPanel } from '@/components/safety-actions-panel';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { APP_COMPANY_NAME } from '@/lib/app-config';
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
  subscription?: {
    status: string;
    storedStatus: string;
    planType: string | null;
    trialDaysRemaining: number;
    trialEndsAt: string | null;
    subscriptionExpiresAt: string | null;
    isTrialActive: boolean;
    isActivePaid: boolean;
  };
  access?: {
    canUsePremiumFeatures: boolean;
    reason: string | null;
  };
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
  const subscription = me.subscription;
  const trialDaysRemaining = subscription?.trialDaysRemaining ?? 0;
  const subscriptionStatusLabel = subscription?.isActivePaid
    ? 'Suscripcion activa'
    : subscription?.isTrialActive
      ? `Prueba gratis: ${trialDaysRemaining} dia(s) restantes`
      : 'Prueba vencida';
  const subscriptionTone = subscription?.isActivePaid
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
    : subscription?.isTrialActive && trialDaysRemaining <= 3
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : subscription?.isTrialActive
        ? 'border-sky-200 bg-sky-50 text-sky-950'
        : 'border-rose-200 bg-rose-50 text-rose-950';

  const roleCopy = {
    passenger: {
      title: 'Encuentra rutas compartidas hacia tu trabajo, escuela o zona de destino',
      subtitle: 'Publica la ruta que necesitas o solicita unirte a rutas de conductores verificados de tu zona.',
      chips: ['Necesito una ruta', 'Buscar rutas disponibles', 'Coordinacion directa']
    },
    driver: {
      title: 'Publica rutas recurrentes y coordina con miembros verificados',
      subtitle: 'Si ya manejas hacia una zona de trabajo, publica una ruta compatible, tus horarios y lugares disponibles para recibir solicitudes.',
      chips: ['Aprovecha tu trayecto', 'Define horarios y referencias', 'Actividad de ruta']
    },
    admin: {
      title: 'Control total para una operacion ordenada',
      subtitle: `Administra rutas, verificaciones, membresias y solicitudes desde un tablero central de ${APP_COMPANY_NAME}.`,
      chips: ['Mayor control', 'Aprobaciones seguras', 'Operacion demostrable']
    }
  }[me.role];

  const roleGuide =
    me.role === 'passenger'
      ? {
          subtitle: 'Sigue este orden para coordinar tu ruta compartida.',
          points: [
            'Completa verificacion con INE frente y reverso.',
            'Selecciona uno o mas dias si necesitas ruta semanal.',
            'Envia tu solicitud y espera aceptacion del conductor.',
            'Revisa conductor, vehiculo y referencia antes de abordar.',
            'Cuando el conductor acepte se habilita tu pase.'
          ],
          nextStep: 'Ir a buscar rutas o revisar tus solicitudes.',
          ctaHref: '/dashboard/routes/request',
          ctaLabel: 'Necesito una ruta'
        }
      : me.role === 'driver'
      ? {
          subtitle: 'Flujo rapido para operar sin friccion.',
          points: [
            'Manten tu verificacion y vehiculo en estado aprobado.',
            'Toma una ruta que coincida con tu trayecto real de trabajo.',
            'Registra horario, dias, asientos y referencia exacta de abordaje.',
            'Inicia ruta y valida a cada usuario con su codigo numerico.',
            'Consulta actividad de ruta y reportes.'
          ],
          nextStep: 'Publicar ruta activa y continuar en Mis rutas.',
          ctaHref: '/dashboard/routes',
          ctaLabel: 'Ir a rutas'
        }
      : {
          subtitle: 'Prioriza estos puntos para mantener la operacion estable.',
          points: [
            'Crea solo rutas piloto reales y elimina o pausa las que no se operen.',
            'Aprueba verificaciones de usuario y vehiculo.',
            'Supervisa membresias de plataforma y solicitudes.',
            'Revisa personas registradas antes de promover o suspender cuentas.',
            'Mantiene control de rutas, documentos e incidentes.'
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
      setStatsError(requestError instanceof Error ? requestError.message : 'No se pudo finalizar la ruta.');
    } finally {
      setFinishBusy(false);
    }
  }

  const quickActions = me.role === 'passenger'
    ? [
        { href: '/dashboard/routes/request', label: 'Necesito una ruta', helper: 'Publica origen, destino, dias y horario.' },
        { href: '/dashboard/search-trips', label: 'Buscar rutas disponibles', helper: 'Compara conductores y horarios.' },
        { href: '/dashboard/routes/request', label: 'Mis solicitudes', helper: 'Responde propuestas de conductores.' },
        { href: '/dashboard/my-payments', label: 'Mi suscripcion', helper: 'Activa acceso digital al terminar la prueba.' }
      ]
    : me.role === 'driver'
      ? [
          { href: '/dashboard/routes/create', label: 'Publicar ruta', helper: 'Da de alta tu ruta recurrente.' },
          { href: '/dashboard/route-needs', label: 'Ver rutas solicitadas', helper: 'Toma necesidades compatibles.' },
          { href: '/dashboard/trips', label: 'Mis rutas activas', helper: 'Inicia ruta y valida pases.' },
          { href: '/dashboard/verification', label: 'Mi verificacion / plan', helper: 'Mantente aprobado para operar.' }
        ]
      : [
          { href: '/dashboard/admin/verifications', label: 'Conductores pendientes', helper: 'Aprueba o rechaza documentos.' },
          { href: '/dashboard/admin/routes', label: 'Rutas publicadas', helper: 'Pausa o ajusta rutas.' },
          { href: '/dashboard/admin/people', label: 'Usuarios en piloto', helper: 'Suspende, reactiva o revisa registros.' },
          { href: '/dashboard/admin/payments', label: 'Pagos plataforma', helper: 'Solo membresias y servicios digitales.' }
        ];

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

      {me.role !== 'admin' && subscription && (
        <section className={`rounded-2xl border p-4 shadow-sm ${subscriptionTone}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">Acceso digital VIAJASEGURO</p>
              <h2 className="mt-1 text-lg font-black">{subscriptionStatusLabel}</h2>
              <p className="mt-1 text-sm font-medium opacity-85">
                La suscripcion habilita funciones digitales de la comunidad: publicar rutas, solicitar unirse y recibir respuestas. No representa el pago de un traslado.
              </p>
            </div>
            <Link href="/dashboard/my-payments" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
              Activar suscripcion
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.href + action.label} href={action.href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
            <p className="text-sm font-black text-slate-950">{action.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{action.helper}</p>
          </Link>
        ))}
      </section>

      {statsError && me.role !== 'admin' && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">No se pudieron cargar algunas estadisticas: {statsError}</p>
      )}

      {me.role === 'passenger' && currentPassengerReservation && (
        <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Ruta en curso</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {currentPassengerReservation.trip?.route?.title || `${currentPassengerReservation.trip?.route?.origin || 'Ruta'} -> ${currentPassengerReservation.trip?.route?.destination || ''}`}
              </h2>
              <p className="mt-2 text-sm font-semibold text-emerald-900">
                Tu ruta esta en curso. Mantente atento al punto de descenso y reporta cualquier situacion sospechosa.
              </p>
            </div>
            <Link href={`/dashboard/my-reservations/${currentPassengerReservation.id}/ticket`} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">
              Ver pase de hoy
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
              <p className="text-sm text-slate-700">Verifica vehiculo, placas y conductor antes de abordar.</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Punto de abordaje</p>
              <p className="mt-1 font-black text-slate-950">{currentPassengerReservation.trip?.boardingReference ?? 'Pendiente de referencia'}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Destino</p>
              <p className="mt-1 font-black text-slate-950">{currentPassengerReservation.trip?.route?.destination ?? 'Destino pendiente'}</p>
              <p className="text-sm text-slate-700">Usa solo puntos publicos y visibles.</p>
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
            contextLabel={currentPassengerReservation.trip?.route?.title ?? 'Ruta en curso del usuario'}
          />
        </section>
      )}

      {me.role === 'driver' && currentDriverTrip && (
        <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Ruta en curso</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {currentDriverTrip.route?.title || `${currentDriverTrip.route?.origin || 'Ruta'} -> ${currentDriverTrip.route?.destination || ''}`}
              </h2>
              <p className="mt-2 text-sm font-semibold text-emerald-900">
                Ruta en curso. Manten la validacion de usuarios actualizada y reporta cualquier incidente.
              </p>
            </div>
            <button
              type="button"
              disabled={finishBusy}
              onClick={() => void finishCurrentTrip(currentDriverTrip.id)}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-700"
            >
              {finishBusy ? 'Finalizando...' : 'Finalizar ruta'}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Usuarios esperados" value={currentDriverTrip.reservationSummary?.reservedSeats ?? 0} tone="sky" />
            <StatCard label="Usuarios abordados" value={currentDriverTrip.reservationSummary?.boardedSeats ?? 0} tone="emerald" />
            <StatCard label="Usuarios pendientes" value={currentDriverTrip.reservationSummary?.pendingSeats ?? 0} tone="amber" />
            <StatCard label="Pases pendientes" value={currentDriverTrip.reservationSummary?.pendingReservationsCount ?? 0} tone="amber" />
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
                Validar pases
              </Link>
            </div>
          </div>
          <SafetyActionsPanel
            role="driver"
            tripId={currentDriverTrip.id}
            routeId={currentDriverTrip.routeId}
            contextLabel={currentDriverTrip.route?.title ?? 'Ruta en curso del conductor'}
          />
        </section>
      )}

      {me.role === 'passenger' && (
        <section className="space-y-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm">
            <p className="font-bold">Tus datos terminados quedan en historial para no saturar el panel principal.</p>
            <p className="mt-1">Muestra al conductor el codigo correspondiente a la fecha de la ruta y revisa la fecha antes de compartirlo.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Rutas proximas" value={passengerUpcoming} tone="sky" />
            <StatCard label="Rutas en curso" value={passengerInCourse} tone="emerald" />
            <StatCard label="Rutas terminadas" value={passengerFinished} tone="slate" />
            <StatCard label="Solicitudes aceptadas" value={passengerPaid} tone="emerald" />
            <StatCard label="Solicitudes en revision" value={passengerInReview} tone="amber" />
            <StatCard label="Pases usados" value={passengerUsedTickets} tone="slate" />
            <StatCard label="Historial de rutas" value={passengerFinished} helper="Terminados o archivados" tone="slate" />
            <StatCard label="Alertas/reportes" value={incidents.length} helper="Enviados por tu cuenta" tone="rose" />
          </div>
        </section>
      )}

      {me.role === 'driver' && (
        <section className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
            <p className="font-bold">Valida unicamente pases del dia y horario correspondiente.</p>
            <p className="mt-1">El panel principal muestra rutas activas o pendientes; los terminados y cancelados pasan a historial/archivo.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Rutas proximas" value={driverUpcoming} tone="sky" />
            <StatCard label="Rutas en curso" value={driverInCourse} tone="emerald" />
            <StatCard label="Rutas terminadas" value={driverFinished} tone="slate" />
            <StatCard label="Usuarios transportados" value={driverPassengersTransported} tone="emerald" />
            <StatCard label="Pases operados" value={driverTicketsOperated} helper="Estimado por rutas terminadas" tone="slate" />
            <StatCard label="Actividad aceptada" value={driverTicketsOperated} helper="Pases operados" tone="emerald" />
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
                <p className="mt-3 text-sm leading-6 text-slate-600">Elige una ruta cercana a tu traslado diario. Publica horarios, punto de encuentro y lugares disponibles para recibir solicitudes.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/routes" className="vs-button-accent">Tomar rutas</Link>
                  <Link href="/dashboard/trips" className="vs-button-secondary">Ver mis rutas</Link>
                </div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Paso 3</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Validacion y actividad</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Cuando aceptes una solicitud, el usuario vera su pase. Al completar rutas, revisa tu actividad operativa.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/trips" className="vs-button-accent">Mis rutas</Link>
                  <Link href="/dashboard/driver/payouts" className="vs-button-secondary">Actividad de ruta</Link>
                </div>
              </article>
            </div>
          )}

          {me.role === 'passenger' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <article className="vs-card">
                <p className="vs-kicker">Buscar</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Encuentra ruta con horario claro y aportacion sugerida</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Consulta rutas disponibles, ocupacion y hora de salida antes de solicitar unirte.</p>
                <div className="mt-5 flex flex-wrap gap-2"><Link href="/dashboard/search-trips" className="vs-button-accent">Buscar rutas</Link></div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Solicitar</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Sigue tus solicitudes sin perderte</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Revisa pase, estado de solicitud y codigo de abordaje.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/my-reservations" className="vs-button-secondary">Mis solicitudes</Link>
                  <Link href="/dashboard/my-payments" className="vs-button-secondary">Membresia</Link>
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
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Publica rutas, autoriza cuentas, revisa membresias y supervisa solicitudes desde un solo lugar.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/dashboard/admin" className="vs-button-accent">Abrir panel admin</Link>
                <Link href="/dashboard/admin/payments" className="vs-button-secondary">Pagos plataforma</Link>
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
