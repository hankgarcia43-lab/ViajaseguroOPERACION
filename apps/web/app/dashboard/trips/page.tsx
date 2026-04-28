'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { apiRequest, getToken } from '@/lib/api';
import { getTripStatusMeta } from '@/lib/status';
import { DriverTrip } from '@/lib/trips';

type TripAction = 'start' | 'finish' | 'cancel';

function TripsPageContent() {
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const takenRouteName = searchParams.get('takenRoute');

  const normalizedError = (error ?? '').toLowerCase();
  const showVerificationLink = normalizedError.includes('verific');
  const showVehicleLink = normalizedError.includes('vehiculo');

  const loadTrips = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<DriverTrip[]>('/trips/my-trips', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setTrips(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  async function changeStatus(trip: DriverTrip, action: TripAction) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyAction(`${trip.id}:${action}`);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/trips/${trip.id}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const successMap: Record<TripAction, string> = {
        start: 'Viaje iniciado correctamente. Los pasajeros ya ven el aviso de abordaje en su panel.',
        finish: 'Viaje finalizado correctamente.',
        cancel: 'Viaje cancelado correctamente.'
      };
      setSuccess(successMap[action]);
      await loadTrips();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar el viaje');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando viajes...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Mis viajes</h1>
              <p className="text-sm text-slate-600">Revisa ocupacion, estado y referencia de abordaje de cada salida.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Rutas asignadas</Link>
              <Link href="/dashboard/routes" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">Tomar ruta</Link>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-red-700">
              <p>{error}</p>
              {showVerificationLink && <Link href="/dashboard/verification" className="mt-2 inline-block underline">Completar verificacion</Link>}
              {showVehicleLink && <Link href="/dashboard/vehicle" className="mt-2 ml-3 inline-block underline">Registrar o revisar mi vehiculo</Link>}
            </div>
          )}
          {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
            <p className="font-semibold">Reglas de salida del conductor</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
              <li>Cuando estes listo para viajar, aprieta el boton Iniciar.</li>
              <li>Al iniciar, los pasajeros veran aviso de que ya los esperas en la zona indicada.</li>
              <li>Confirma que la referencia sea clara antes de validar abordaje.</li>
            </ul>
          </div>

          {takenRouteName && !error && (
            <p className="rounded-md bg-cyan-50 p-3 text-cyan-800">
              Ruta tomada: <strong>{takenRouteName}</strong>. Ya puedes iniciar tu viaje desde este panel.
            </p>
          )}

          {trips.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no tienes viajes programados. Ve a Rutas para tomar una y crear tu viaje automaticamente.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {trips.map((trip) => {
                const statusMeta = getTripStatusMeta(trip.status);
                const isStartBusy = busyAction === `${trip.id}:start`;
                const isFinishBusy = busyAction === `${trip.id}:finish`;
                const isCancelBusy = busyAction === `${trip.id}:cancel`;

                return (
                  <article key={trip.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{trip.route?.title || `${trip.route?.origin || 'Ruta'} -> ${trip.route?.destination || ''}`}</h2>
                        <p className="text-xs text-slate-500">Viaje # {trip.publicId ?? '-'}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
                    </div>
                    <p className="text-sm text-slate-700">Fecha: {new Date(trip.tripDate).toLocaleDateString()}</p>
                    <p className="text-sm text-slate-700">Salida: {trip.departureTimeSnapshot}</p>
                    <p className="text-sm text-slate-700">Llegada estimada: {trip.estimatedArrivalTimeSnapshot}</p>
                    <p className="text-sm text-slate-700">Asientos configurados: {trip.availableSeatsSnapshot}</p>
                    <p className="text-sm text-slate-700">Reservas activas: {trip.reservationSummary?.reservationsCount ?? 0}</p>
                    <p className="text-sm text-slate-700">Asientos reservados: {trip.reservationSummary?.reservedSeats ?? 0}</p>
                    <p className="text-sm text-slate-700">Asientos disponibles: {trip.reservationSummary?.remainingSeats ?? trip.availableSeatsSnapshot}</p>
                    <p className="text-sm text-slate-700">Precio: ${trip.pricePerSeatSnapshot.toFixed(2)} MXN</p>
                    <p className="text-sm text-slate-700">Referencia de abordaje: {trip.boardingReference ?? 'Sin definir'}</p>
                    <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">Usa siempre una referencia visible y publica para proteger al pasajero y al conductor.</p>

                    {trip.earningsSummary && (
                      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <p className="font-semibold">Ganancia del conductor (comision descontada)</p>
                        <p>Bruto cobrado: ${trip.earningsSummary.grossCollected.toFixed(2)} MXN</p>
                        <p>Comision app: ${trip.earningsSummary.appCommissionAmount.toFixed(2)} MXN</p>
                        <p>Reembolsos: ${trip.earningsSummary.refundedAmount.toFixed(2)} MXN</p>
                        <p className="font-semibold">Neto estimado a recibir: ${trip.earningsSummary.driverNetAfterRefunds.toFixed(2)} MXN</p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(trip.status === 'scheduled' || trip.status === 'started') && (
                        <Link href={`/dashboard/trips/${trip.id}/boarding`} className="rounded-md border border-emerald-300 px-3 py-2 text-sm text-emerald-700">
                          Validar abordaje
                        </Link>
                      )}
                      {trip.status === 'scheduled' && (
                        <button type="button" disabled={isStartBusy} onClick={() => changeStatus(trip, 'start')} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">
                          {isStartBusy ? 'Iniciando...' : 'Iniciar'}
                        </button>
                      )}
                      {trip.status === 'started' && (
                        <button type="button" disabled={isFinishBusy} onClick={() => changeStatus(trip, 'finish')} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">
                          {isFinishBusy ? 'Finalizando...' : 'Finalizar'}
                        </button>
                      )}
                      {(trip.status === 'scheduled' || trip.status === 'started') && (
                        <button type="button" disabled={isCancelBusy} onClick={() => changeStatus(trip, 'cancel')} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">
                          {isCancelBusy ? 'Cancelando...' : 'Cancelar'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <ContextHelpPanel
          title="Que hacer"
          subtitle="Operacion diaria del conductor"
          points={[
            'Sigue los pasos para operar tu viaje con claridad.',
            'Verifica siempre el punto de encuentro antes de iniciar.',
            'Valida el abordaje usando el codigo numerico del pasajero.',
            'Manten visibles los estados de tu viaje y tus pagos.'
          ]}
          nextStep="Inicia viaje y valida abordajes en orden."
          ctaHref="/dashboard/routes"
          ctaLabel="Tomar ruta"
        />
      </div>
    </section>
  );
}


export default function TripsPage() {
  return (
    <Suspense fallback={<p className="text-slate-700">Cargando viajes...</p>}>
      <TripsPageContent />
    </Suspense>
  );
}
