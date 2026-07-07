'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { ADMIN_NAV_ITEMS } from '@/lib/admin';
import { AdminPeopleSummary, fetchAdminPeopleSummary } from '@/lib/admin-people';
import { FarePolicy } from '@/lib/fare-policy';
import { Reservation } from '@/lib/reservations';
import { DriverTrip } from '@/lib/trips';
import { PendingVerificationSummary } from '@/lib/user-documents';
import { PendingVehicleSummary } from '@/lib/vehicles';
import { Incident } from '@/lib/incidents';
import { getPaymentStatusMeta, getReservationStatusMeta, getTripStatusMeta } from '@/lib/status';

type SummaryCard = {
  label: string;
  value: number | string;
  href: string;
  helper: string;
  tone?: 'slate' | 'emerald' | 'sky' | 'amber' | 'rose';
};

const adminResponsibilities = [
  {
    title: 'Validar documentos',
    detail: 'Revisa identidad, evidencias y vehiculos antes de aprobar usuarios o conductores.',
    href: '/dashboard/admin/verifications',
    label: 'Abrir verificaciones'
  },
  {
    title: 'Activar plan pagado',
    detail: 'Cuando el pago este confirmado, activa el plan semanal desde Personas.',
    href: '/dashboard/admin/people',
    label: 'Ver personas'
  },
  {
    title: 'Soporte tecnico',
    detail: 'Atiende reportes, alertas, dudas de uso y situaciones que bloqueen la operacion.',
    href: '/dashboard/admin/incidents',
    label: 'Abrir soporte'
  },
  {
    title: 'Comentarios y sugerencias',
    detail: 'Lee retroalimentacion para ajustar rutas, flujo de reserva y comunicacion del piloto.',
    href: '/dashboard/admin/incidents',
    label: 'Leer reportes'
  },
  {
    title: 'Datos y estadisticas',
    detail: 'Monitorea usuarios, conductores, rutas, solicitudes, actividad y crecimiento semanal.',
    href: '/dashboard/admin',
    label: 'Ver resumen'
  }
];

function toneClass(tone: SummaryCard['tone'] = 'slate') {
  return {
    slate: 'border-slate-200 bg-white text-slate-950',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    sky: 'border-sky-200 bg-sky-50 text-sky-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950'
  }[tone];
}

export default function AdminDashboardPage() {
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerificationSummary[]>([]);
  const [pendingVehicles, setPendingVehicles] = useState<PendingVehicleSummary[]>([]);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [routesCount, setRoutesCount] = useState(0);
  const [peopleSummary, setPeopleSummary] = useState<AdminPeopleSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [farePolicy, setFarePolicy] = useState<FarePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        setError('No hay sesion activa.');
        setLoading(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [verificationData, vehicleData, tripData, reservationData, routeData, incidentData, farePolicyData, peopleSummaryData] = await Promise.all([
          apiRequest<PendingVerificationSummary[]>('/admin/verifications/pending', { headers }),
          apiRequest<PendingVehicleSummary[]>('/admin/vehicles/pending', { headers }),
          apiRequest<DriverTrip[]>('/trips/admin/all', { headers }),
          apiRequest<Reservation[]>('/reservations/admin/all', { headers }),
          apiRequest<any[]>('/admin/routes', { headers }),
          apiRequest<Incident[]>('/incidents/admin/all', { headers }),
          apiRequest<FarePolicy | null>('/admin/fare-policy/current', { headers }),
          fetchAdminPeopleSummary(token)
        ]);

        setPendingVerifications(verificationData);
        setPendingVehicles(vehicleData);
        setTrips(tripData);
        setReservations(reservationData);
        setRoutesCount(routeData.length);
        setIncidents(incidentData);
        setFarePolicy(farePolicyData);
        setPeopleSummary(peopleSummaryData);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el panel admin.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const openIncidents = incidents.filter((item) => item.status === 'open').length;
  const activeTrips = trips.filter((trip) => ['scheduled', 'started'].includes(trip.status)).length;
  const completedTrips = trips.filter((trip) => ['finished', 'completed'].includes(trip.status)).length;
  const confirmedReservations = reservations.filter((reservation) => ['confirmed', 'paid', 'boarded'].includes(reservation.status)).length;

  const cards = useMemo<SummaryCard[]>(() => [
    { label: 'Personas registradas', value: peopleSummary?.total ?? 0, href: '/dashboard/admin/people', helper: `${peopleSummary?.drivers ?? 0} conductores / ${peopleSummary?.passengers ?? 0} usuarios`, tone: 'slate' },
    { label: 'Planes activos', value: peopleSummary?.activeSubscriptions ?? 0, href: '/dashboard/admin/payments', helper: 'Planes semanales pagados o activados', tone: 'emerald' },
    { label: 'Usuarios en prueba', value: peopleSummary?.trialUsers ?? 0, href: '/dashboard/admin/people', helper: 'Prueba digital de 7 dias', tone: 'sky' },
    { label: 'Suspendidos', value: peopleSummary?.suspended ?? 0, href: '/dashboard/admin/people', helper: 'Cuentas bloqueadas por admin', tone: 'rose' },
    { label: 'Documentos pendientes', value: pendingVerifications.length, href: '/dashboard/admin/verifications', helper: 'Usuarios esperando revision', tone: 'amber' },
    { label: 'Vehiculos pendientes', value: pendingVehicles.length, href: '/dashboard/admin/vehicles', helper: 'Conductores esperando validacion', tone: 'amber' },
    { label: 'Rutas piloto', value: routesCount, href: '/dashboard/admin/routes', helper: 'Rutas especificas creadas para operar', tone: 'slate' },
    { label: 'Soporte abierto', value: openIncidents, href: '/dashboard/admin/incidents', helper: 'Comentarios, sugerencias y alertas', tone: openIncidents > 0 ? 'rose' : 'emerald' },
    { label: 'Viajes activos', value: activeTrips, href: '/dashboard/admin/trips', helper: 'Programados o en curso', tone: 'emerald' },
    { label: 'Viajes terminados', value: completedTrips, href: '/dashboard/admin/trips', helper: 'Historial operativo', tone: 'slate' },
    { label: 'Solicitudes confirmadas', value: confirmedReservations, href: '/dashboard/admin/reservations', helper: 'Reservas con avance operativo', tone: 'sky' },
    { label: 'Tarifa por km', value: farePolicy ? `$${farePolicy.ratePerKm.toFixed(2)}` : 'Sin definir', href: '/dashboard/admin/fare-policy', helper: farePolicy ? `${farePolicy.currency} por km orientativo` : 'Configura referencia orientativa', tone: 'slate' }
  ], [activeTrips, completedTrips, confirmedReservations, farePolicy, openIncidents, pendingVerifications.length, pendingVehicles.length, peopleSummary, routesCount]);

  if (loading) {
    return <p className="text-slate-700">Cargando resumen admin...</p>;
  }

  return (
    <section className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Centro de administracion</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Control operativo del piloto</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              El admin valida documentos, confirma planes pagados, atiende soporte, revisa comentarios y mantiene visibilidad completa de usuarios, conductores, rutas, solicitudes y estadisticas.
            </p>
          </div>
          <div className="bg-slate-950 p-6 text-white md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Prioridad de hoy</p>
            <p className="mt-3 text-4xl font-black">{pendingVerifications.length + pendingVehicles.length + openIncidents}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Pendientes entre documentos, vehiculos y soporte abierto.</p>
            <Link href="/dashboard/admin/incidents" className="mt-5 inline-flex rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-400">Abrir soporte</Link>
          </div>
        </div>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {adminResponsibilities.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
            <Link href={item.href} className="mt-4 inline-flex text-sm font-bold text-emerald-700 underline">{item.label}</Link>
          </article>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={`${card.href}-${card.label}`} href={card.href} className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass(card.tone)}`}>
            <p className="text-sm font-bold opacity-70">{card.label}</p>
            <p className="mt-3 text-3xl font-black">{card.value}</p>
            <p className="mt-2 text-sm opacity-80">{card.helper}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Acciones que requieren decision</h2>
            <span className="text-sm text-slate-500">{pendingVerifications.length + pendingVehicles.length + openIncidents} abiertos</span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Documentos por validar</p>
              <p className="mt-1 text-sm text-slate-600">{pendingVerifications.length === 0 ? 'Sin usuarios pendientes.' : `${pendingVerifications.length} usuarios esperan aprobacion o rechazo.`}</p>
              <Link href="/dashboard/admin/verifications" className="mt-3 inline-block text-sm text-brand-600 underline">Abrir documentos</Link>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Vehiculos por validar</p>
              <p className="mt-1 text-sm text-slate-600">{pendingVehicles.length === 0 ? 'Sin vehiculos por revisar.' : `${pendingVehicles.length} vehiculos requieren revision admin.`}</p>
              <Link href="/dashboard/admin/vehicles" className="mt-3 inline-block text-sm text-brand-600 underline">Abrir vehiculos</Link>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Planes pagados</p>
              <p className="mt-1 text-sm text-slate-600">Valida pagos de plataforma y activa el plan semanal desde el perfil de la persona.</p>
              <Link href="/dashboard/admin/people" className="mt-3 inline-block text-sm text-brand-600 underline">Activar plan en Personas</Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Actividad reciente</h2>
            <span className="text-sm text-slate-500">Vista rapida</span>
          </div>
          <div className="mt-4 space-y-3">
            {trips.slice(0, 3).map((trip) => {
              const status = getTripStatusMeta(trip.status);
              const tripDriver = (trip as DriverTrip & { driver?: { fullName?: string } | null }).driver;
              return (
                <div key={trip.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{trip.route?.title ?? `${trip.route?.origin ?? 'Ruta'} -> ${trip.route?.destination ?? ''}`}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{new Date(trip.tripDate).toLocaleDateString()} - {tripDriver?.fullName ?? trip.driverUserId}</p>
                </div>
              );
            })}
            {reservations.slice(0, 3).map((reservation) => {
              const status = getReservationStatusMeta(reservation.status);
              const paymentStatus = reservation.payment ? getPaymentStatusMeta(reservation.payment.status) : null;
              return (
                <div key={reservation.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">Solicitud {reservation.id.slice(0, 8)}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{reservation.trip?.route?.origin} {'->'} {reservation.trip?.route?.destination}</p>
                  {paymentStatus && <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${paymentStatus.className}`}>{paymentStatus.label}</span>}
                </div>
              );
            })}
            {trips.length === 0 && reservations.length === 0 && <p className="text-sm text-slate-600">Todavia no hay viajes ni solicitudes para inspeccionar.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Navegacion util para administracion</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_NAV_ITEMS.filter((item) => item.href !== '/dashboard/admin').map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              <span className="block font-semibold text-slate-900">{item.label}</span>
              <span className="mt-1 block text-slate-600">{item.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
