'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { RequestedRoute, formatWeekdays, getProposalStatusLabel, getRequestedRouteStatusLabel } from '@/lib/route-needs';

export default function AdminRouteNeedsPage() {
  const [needs, setNeeds] = useState<RequestedRoute[]>([]);
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
        const data = await apiRequest<RequestedRoute[]>('/route-needs/admin/all', { headers: { Authorization: `Bearer ${token}` } });
        setNeeds(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar rutas solicitadas.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Operacion piloto</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Rutas solicitadas por usuarios</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Supervisa necesidades publicadas, propuestas de conductores y estado de coordinacion. No representa venta de boleto ni pago de traslado.
        </p>
      </header>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-sm text-slate-600">Cargando...</p> : needs.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Aun no hay rutas solicitadas por usuarios.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {needs.map((need) => (
            <article key={need.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{getRequestedRouteStatusLabel(need.status)}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">{need.originText} &gt; {need.destinationText}</h2>
                  <p className="mt-1 text-sm text-slate-600">{formatWeekdays(need.recurrenceDays)} | {need.desiredTime} | {need.seatsNeeded} lugar(es)</p>
                  {need.message && <p className="mt-2 text-sm text-slate-700">{need.message}</p>}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{need.proposals.length} propuesta(s)</span>
              </div>

              <div className="mt-4 space-y-2">
                {need.proposals.length === 0 ? <p className="text-sm text-slate-500">Sin propuestas todavia.</p> : need.proposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-bold text-slate-950">{proposal.driver?.fullName ?? 'Conductor'} | {getProposalStatusLabel(proposal.status)}</p>
                    <p>Horario: {proposal.proposedTime} | Aportacion sugerida: ${proposal.suggestedCashContribution.toFixed(2)} MXN efectivo</p>
                    <p>Punto: {proposal.boardingPoint}</p>
                    <p>Referencia: {proposal.boardingReference}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <Link href="/dashboard/admin" className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Volver a admin</Link>
    </section>
  );
}
