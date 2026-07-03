'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { RequestedRoute, formatWeekdays, getRequestedRouteStatusLabel } from '@/lib/route-needs';

const CASH_NOTICE = 'El monto mostrado es una aportacion sugerida en efectivo acordada directamente entre usuario y conductor. VIAJASEGURO no cobra traslados, no fija tarifas obligatorias y no administra pagos entre las partes.';

type ProposalForm = {
  proposedTime: string;
  boardingPoint: string;
  boardingReference: string;
  suggestedCashContribution: number;
  availableSeats: number;
  messageToUser: string;
};

const initialForm: ProposalForm = {
  proposedTime: '07:00',
  boardingPoint: '',
  boardingReference: '',
  suggestedCashContribution: 40,
  availableSeats: 4,
  messageToUser: ''
};

export default function RouteNeedsPage() {
  const [needs, setNeeds] = useState<RequestedRoute[]>([]);
  const [activeNeedId, setActiveNeedId] = useState<string | null>(null);
  const [form, setForm] = useState<ProposalForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadNeeds() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<RequestedRoute[]>('/route-needs/open', { headers: { Authorization: `Bearer ${token}` } });
      setNeeds(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar rutas solicitadas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNeeds();
  }, []);

  function startProposal(need: RequestedRoute) {
    setActiveNeedId(need.id);
    setForm({ ...initialForm, proposedTime: need.desiredTime, availableSeats: Math.max(need.seatsNeeded, 1) });
    setError(null);
    setSuccess(null);
  }

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || !activeNeedId) {
      setError('No hay sesion activa o ruta seleccionada.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/route-needs/${activeNeedId}/proposals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      setSuccess('Propuesta enviada. El usuario podra aceptarla o rechazarla desde su panel.');
      setActiveNeedId(null);
      setForm(initialForm);
      await loadNeeds();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo enviar la propuesta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Conductor verificado</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Rutas solicitadas por usuarios</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6">
          Revisa necesidades reales de la comunidad. Si una ruta coincide con tu traslado, responde con horario, punto de abordaje, referencia visible y aportacion sugerida en efectivo.
        </p>
        <p className="mt-3 rounded-xl border border-white/70 bg-white p-3 text-xs font-semibold text-slate-700">{CASH_NOTICE}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/routes/create" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">Publicar ruta</Link>
        <Link href="/dashboard/trips" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white">Mis rutas activas</Link>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      {loading ? <p className="text-sm text-slate-600">Cargando rutas solicitadas...</p> : needs.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Aun no hay rutas solicitadas abiertas por usuarios.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {needs.map((need) => (
            <article key={need.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{getRequestedRouteStatusLabel(need.status)}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">{need.originText} &gt; {need.destinationText}</h2>
                  <p className="mt-1 text-sm text-slate-600">{formatWeekdays(need.recurrenceDays)} | Horario deseado: {need.desiredTime}</p>
                  <p className="text-sm text-slate-600">Lugares necesarios: {need.seatsNeeded}</p>
                  {need.message && <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{need.message}</p>}
                </div>
                <button type="button" onClick={() => startProposal(need)} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">Tomar esta ruta</button>
              </div>

              {activeNeedId === need.id && (
                <form onSubmit={submitProposal} className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Horario
                      <input type="time" value={form.proposedTime} onChange={(event) => setForm((current) => ({ ...current, proposedTime: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Cupos
                      <input type="number" min={need.seatsNeeded} max={20} value={form.availableSeats} onChange={(event) => setForm((current) => ({ ...current, availableSeats: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Aportacion sugerida
                      <input type="number" min={0} max={500} step="0.01" value={form.suggestedCashContribution} onChange={(event) => setForm((current) => ({ ...current, suggestedCashContribution: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </label>
                  </div>

                  <label className="block text-sm font-medium text-slate-700">
                    Punto de abordaje
                    <input value={form.boardingPoint} onChange={(event) => setForm((current) => ({ ...current, boardingPoint: event.target.value }))} placeholder="Ej. Paradero publico, esquina visible, terminal" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Referencia visual de abordaje
                    <input value={form.boardingReference} onChange={(event) => setForm((current) => ({ ...current, boardingReference: event.target.value }))} placeholder="Ej. Frente a farmacia, junto a puente, bahia de ascenso" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Mensaje al usuario
                    <textarea value={form.messageToUser} onChange={(event) => setForm((current) => ({ ...current, messageToUser: event.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
                  </label>

                  <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{CASH_NOTICE}</p>

                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={saving} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:bg-slate-300">{saving ? 'Enviando...' : 'Enviar propuesta'}</button>
                    <button type="button" onClick={() => setActiveNeedId(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancelar</button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
