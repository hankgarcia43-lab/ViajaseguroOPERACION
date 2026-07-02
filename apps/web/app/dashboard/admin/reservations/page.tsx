'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { Reservation } from '@/lib/reservations';
import { getPaymentStatusMeta, getReservationStatusMeta, getTripStatusMeta } from '@/lib/status';

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'accepted', label: 'Aceptadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'confirmed', label: 'Confirmadas legacy' },
  { value: 'paid', label: 'Aceptadas legacy' },
  { value: 'boarded', label: 'Abordadas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas legacy' },
  { value: 'cancelled_by_user', label: 'Canceladas por usuario' },
  { value: 'cancelled_by_driver', label: 'Canceladas por conductor' },
  { value: 'refunded', label: 'Reembolsadas' }
] as const;

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]['value']>('all');
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
        const data = await apiRequest<Reservation[]>('/reservations/admin/all', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setReservations(data);
        setSelectedReservationId(data[0]?.id ?? null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las solicitudes.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filteredReservations = useMemo(
    () => reservations.filter((reservation) => statusFilter === 'all' || reservation.status === statusFilter),
    [reservations, statusFilter]
  );
  const selectedReservation = filteredReservations.find((reservation) => reservation.id === selectedReservationId) ?? filteredReservations[0] ?? null;

  if (loading) {
    return <p className="text-slate-700">Cargando solicitudes del sistema...</p>;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin - Solicitudes</h1>
        <p className="mt-2 text-sm text-slate-600">Vista operativa para revisar estados de solicitud, estado y trazabilidad sin tomar el rol del usuario.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-full px-3 py-2 text-sm ${statusFilter === filter.value ? 'bg-brand-500 text-white' : 'border border-slate-300 text-slate-700'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {filteredReservations.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">No hay solicitudes para este filtro.</p>
          ) : (
            filteredReservations.map((reservation) => {
              const status = getReservationStatusMeta(reservation.status);
              return (
                <button
                  key={reservation.id}
                  type="button"
                  onClick={() => setSelectedReservationId(reservation.id)}
                  className={`w-full rounded-xl border p-4 text-left shadow-sm ${selectedReservation?.id === reservation.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Solicitud {reservation.id.slice(0, 8)}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{reservation.trip?.route?.origin} {'->'} {reservation.trip?.route?.destination}</p>
                  <p className="text-sm text-slate-600">Lugares: {reservation.totalSeats}</p>
                </button>
              );
            })
          )}
        </aside>

        <section>
          {!selectedReservation ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">Selecciona una solicitud para ver detalle.</p>
          ) : (
            <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Solicitud {selectedReservation.id}</h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedReservation.trip?.route?.origin} {'->'} {selectedReservation.trip?.route?.destination}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getReservationStatusMeta(selectedReservation.status).className}`}>{getReservationStatusMeta(selectedReservation.status).label}</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Usuario</p>
                  <p className="mt-2 text-sm text-slate-700">{(selectedReservation as Reservation & { passenger?: { fullName?: string; email?: string } | null }).passenger?.fullName ?? selectedReservation.passengerUserId}</p>
                  <p className="text-sm text-slate-700">{(selectedReservation as Reservation & { passenger?: { email?: string } | null }).passenger?.email ?? 'Sin email visible'}</p>
                  <p className="text-sm text-slate-700">Codigo: {selectedReservation.numericCode ?? 'Pendiente hasta aceptacion del conductor'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Viaje</p>
                  <p className="mt-2 text-sm text-slate-700">Fecha: {selectedReservation.trip ? new Date(selectedReservation.trip.tripDate).toLocaleDateString() : 'N/A'}</p>
                  <p className="text-sm text-slate-700">Estado ruta: {selectedReservation.trip ? getTripStatusMeta(selectedReservation.trip.status).label : 'N/A'}</p>
                  <p className="text-sm text-slate-700">Salida: {selectedReservation.trip?.departureTimeSnapshot ?? 'N/A'}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Capacidad y estimacion</p>
                  <p className="mt-2 text-sm text-slate-700">Total de lugares: {selectedReservation.totalSeats}</p>
                  <p className="text-sm text-slate-700">Acompanantes: {selectedReservation.companionCount}</p>
                  <p className="text-sm font-medium text-slate-900">Estimacion total: ${selectedReservation.totalAmount.toFixed(2)} MXN</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Registro plataforma</p>
                  {selectedReservation.payment ? (
                    <>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${getPaymentStatusMeta(selectedReservation.payment.status).className}`}>{getPaymentStatusMeta(selectedReservation.payment.status).label}</span>
                      <p className="mt-2 text-sm text-slate-700">Provider: {selectedReservation.payment.provider}</p>
                      <p className="text-sm text-slate-700">Referencia: {selectedReservation.payment.providerReference ?? 'N/A'}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-700">No hay registro economico asociado.</p>
                  )}
                </div>
              </div>
            </article>
          )}
        </section>
      </div>
    </section>
  );
}
