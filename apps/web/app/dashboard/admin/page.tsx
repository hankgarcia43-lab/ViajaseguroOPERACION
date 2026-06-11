'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { ADMIN_NAV_ITEMS } from '@/lib/admin';
import { AdminPeopleSummary, fetchAdminPeopleSummary } from '@/lib/admin-people';
import { FarePolicy } from '@/lib/fare-policy';
import { Payment } from '@/lib/payments';
import { Refund } from '@/lib/refunds';
import { Reservation } from '@/lib/reservations';
import { DriverTrip } from '@/lib/trips';
import { PendingVerificationSummary } from '@/lib/user-documents';
import { PendingVehicleSummary } from '@/lib/vehicles';
import { WeeklyPayout } from '@/lib/weekly-payouts';
import { Incident } from '@/lib/incidents';
import { getPaymentStatusMeta, getReservationStatusMeta, getTripStatusMeta } from '@/lib/status';

type SummaryCard = {
  label: string;
  value: number | string;
  href: string;
  helper: string;
};

export default function AdminDashboardPage() {
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerificationSummary[]>([]);
  const [pendingVehicles, setPendingVehicles] = useState<PendingVehicleSummary[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [payouts, setPayouts] = useState<WeeklyPayout[]>([]);
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
        const [verificationData, vehicleData, paymentData, refundData, payoutData, tripData, reservationData, routeData, incidentData, farePolicyData, peopleSummaryData] = await Promise.all([
          apiRequest<PendingVerificationSummary[]>('/admin/verifications/pending', { headers }),
          apiRequest<PendingVehicleSummary[]>('/admin/vehicles/pending', { headers }),
          apiRequest<Payment[]>('/payments', { headers }),
          apiRequest<Refund[]>('/refunds', { headers }),
          apiRequest<WeeklyPayout[]>('/weekly-payouts', { headers }),
          apiRequest<DriverTrip[]>('/trips/admin/all', { headers }),
          apiRequest<Reservation[]>('/reservations/admin/all', { headers }),
          apiRequest<any[]>('/admin/routes', { headers }),
          apiRequest<Incident[]>('/incidents/admin/all', { headers }),
          apiRequest<FarePolicy | null>('/admin/fare-policy/current', { headers }),
          fetchAdminPeopleSummary(token)
        ]);

        setPendingVerifications(verificationData);
        setPendingVehicles(vehicleData);
        setPayments(paymentData);
        setRefunds(refundData);
        setPayouts(payoutData);
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

  const cards = useMemo<SummaryCard[]>(() => [
    { label: 'Usuarios totales', value: peopleSummary?.total ?? 0, href: '/dashboard/admin/people', helper: `${peopleSummary?.drivers ?? 0} conductores / ${peopleSummary?.passengers ?? 0} pasajeros` },
    { label: 'Suspendidos', value: peopleSummary?.suspended ?? 0, href: '/dashboard/admin/people', helper: 'Cuentas bloqueadas por admin' },
    { label: 'Verificaciones pendientes', value: pendingVerifications.length, href: '/dashboard/admin/verifications', helper: 'Usuarios esperando revision' },
    { label: 'Vehiculos pendientes', value: pendingVehicles.length, href: '/dashboard/admin/vehicles', helper: 'Conductores bloqueados por vehiculo' },
    { label: 'Tarifa por km activa', value: farePolicy ? `$${farePolicy.ratePerKm.toFixed(2)}` : 'Sin definir', href: '/dashboard/admin/fare-policy', helper: farePolicy ? `Modo: ${farePolicy.mode === 'fixed_per_km' ? 'fija' : 'maxima'} por km` : 'Configura politica comercial' },
    { label: 'Pagos registrados', value: payments.length, href: '/dashboard/admin/payments', helper: 'Seguimiento economico del MVP' },
    { label: 'Refunds', value: refunds.length, href: '/dashboard/admin/refunds', helper: 'Reembolsos manuales e internos' },
    { label: 'Liquidaciones', value: payouts.length, href: '/dashboard/admin/weekly-payouts', helper: 'Payouts internos generados' },
    { label: 'Rutas piloto', value: routesCount, href: '/dashboard/admin/routes', helper: 'Rutas especificas creadas por administracion' },
    { label: 'Soporte abierto', value: incidents.filter((item) => item.status === 'open').length, href: '/dashboard/admin/incidents', helper: 'Comentarios, reportes y alertas' },
    { label: 'Viajes', value: trips.length, href: '/dashboard/admin/trips', helper: 'Operacion de salidas reales' },
    { label: 'Reservas', value: reservations.length, href: '/dashboard/admin/reservations', helper: 'Seguimiento de ocupacion y pagos' }
  ] , [payments.length, payouts.length, pendingVerifications.length, pendingVehicles.length, refunds.length, reservations.length, routesCount, trips.length, incidents, farePolicy, peopleSummary]);

  if (loading) {
    return <p className="text-slate-700">Cargando resumen admin...</p>;
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard admin</h1>
        <p className="mt-2 text-sm text-slate-600">Centro operativo para revisar verificaciones, politica comercial, vehiculos, economia interna y estado del sistema.</p>
      </header>
{error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.helper}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Items que requieren accion</h2>
            <span className="text-sm text-slate-500">{pendingVerifications.length + pendingVehicles.length + incidents.filter((item) => item.status === 'open').length} abiertos</span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Verificaciones pendientes</p>
              <p className="mt-1 text-sm text-slate-600">{pendingVerifications.length === 0 ? 'Sin usuarios pendientes.' : `${pendingVerifications.length} usuarios esperan aprobacion o rechazo.`}</p>
              <Link href="/dashboard/admin/verifications" className="mt-3 inline-block text-sm text-brand-600 underline">Abrir verificaciones</Link>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Vehiculos pendientes</p>
              <p className="mt-1 text-sm text-slate-600">{pendingVehicles.length === 0 ? 'Sin vehiculos por revisar.' : `${pendingVehicles.length} vehiculos requieren revision admin.`}</p>
              <Link href="/dashboard/admin/vehicles" className="mt-3 inline-block text-sm text-brand-600 underline">Abrir vehiculos</Link>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Politica comercial</p>
              <p className="mt-1 text-sm text-slate-600">{farePolicy ? `Tarifa ${farePolicy.mode === 'fixed_per_km' ? 'fija' : 'maxima'} de $${farePolicy.ratePerKm.toFixed(2)} ${farePolicy.currency} por km.` : 'Aun no existe una tarifa activa por kilometro.'}</p>
              <Link href="/dashboard/admin/fare-policy" className="mt-3 inline-block text-sm text-brand-600 underline">Configurar tarifa por km</Link>
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
                    <p className="font-medium text-slate-900">Reserva {reservation.id.slice(0, 8)}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{reservation.trip?.route?.origin} {'->'} {reservation.trip?.route?.destination}</p>
                  {paymentStatus && <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${paymentStatus.className}`}>{paymentStatus.label}</span>}
                </div>
              );
            })}
            {trips.length === 0 && reservations.length === 0 && <p className="text-sm text-slate-600">Todavia no hay viajes ni reservas para inspeccionar.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Navegacion operativa</h2>
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












