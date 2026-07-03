'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { DriverRouteProposal, RequestedRoute, WEEKDAY_OPTIONS, formatWeekdays, getProposalStatusLabel, getRequestedRouteStatusLabel } from '@/lib/route-needs';

const CASH_NOTICE = 'El monto mostrado es una aportacion sugerida en efectivo acordada directamente entre usuario y conductor. VIAJASEGURO no cobra traslados, no fija tarifas obligatorias y no administra pagos entre las partes.';

export default function RequestRoutePage() {
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [desiredTime, setDesiredTime] = useState('07:00');
  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(['monday']);
  const [message, setMessage] = useState('');
  const [needs, setNeeds] = useState<RequestedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pendingProposalsCount = useMemo(
    () => needs.reduce((total, need) => total + need.proposals.filter((proposal) => proposal.status === 'pending_user_response').length, 0),
    [needs]
  );

  async function loadNeeds() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa. Inicia sesion primero.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<RequestedRoute[]>('/route-needs/my', { headers: { Authorization: `Bearer ${token}` } });
      setNeeds(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar tus rutas solicitadas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNeeds();
  }, []);

  function toggleWeekday(value: string) {
    setRecurrenceDays((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  async function submitNeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest<RequestedRoute>('/route-needs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ originText, destinationText, desiredTime, seatsNeeded, recurrenceDays, message })
      });
      setOriginText('');
      setDestinationText('');
      setMessage('');
      setSuccess('Tu necesidad de ruta fue publicada. Los conductores verificados podran responderla.');
      await loadNeeds();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo publicar la ruta solicitada.');
    } finally {
      setSaving(false);
    }
  }

  async function respondProposal(proposal: DriverRouteProposal, action: 'accept' | 'reject') {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyProposalId(proposal.id);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/route-needs/proposals/${proposal.id}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(action === 'accept' ? 'Propuesta aceptada. Revisa la coordinacion antes de abordar.' : 'Propuesta rechazada. Puedes esperar otra respuesta.');
      await loadNeeds();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo responder la propuesta.');
    } finally {
      setBusyProposalId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Usuario miembro</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Necesito una ruta</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6">
          Publica la ruta que necesitas en pocos pasos. Un conductor verificado puede responder con horario, punto de abordaje y aportacion sugerida en efectivo.
        </p>
        <p className="mt-3 rounded-xl border border-white/70 bg-white p-3 text-xs font-semibold text-slate-700">{CASH_NOTICE}</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
        <form onSubmit={submitNeed} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Publicar necesidad</h2>
            <p className="text-sm text-slate-600">Usa referencias claras: colonia, municipio, terminal o zona de trabajo.</p>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Punto de salida
            <input value={originText} onChange={(event) => setOriginText(event.target.value)} required placeholder="Ej. Acolman centro, Ojo de Agua, Tecamac" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Punto de llegada
            <input value={destinationText} onChange={(event) => setDestinationText(event.target.value)} required placeholder="Ej. Indios Verdes, Pantitlan, Buenavista" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Horario deseado
              <input type="time" value={desiredTime} onChange={(event) => setDesiredTime(event.target.value)} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Lugares necesarios
              <input type="number" min={1} max={12} value={seatsNeeded} onChange={(event) => setSeatsNeeded(Number(event.target.value))} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Dias recurrentes</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WEEKDAY_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={recurrenceDays.includes(option.value)} onChange={() => toggleWeekday(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium text-slate-700">
            Mensaje opcional
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Ej. Entro a las 8:00, puedo caminar al punto de abordaje." className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>

          {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {success && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

          <button type="submit" disabled={saving || recurrenceDays.length === 0} className="w-full rounded-md bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
            {saving ? 'Publicando...' : 'Publicar ruta solicitada'}
          </button>
        </form>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Mis solicitudes</h2>
                <p className="text-sm text-slate-600">Conductores que respondieron: <span className="font-semibold text-slate-950">{pendingProposalsCount}</span></p>
              </div>
              <Link href="/dashboard/search-trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Buscar rutas publicadas</Link>
            </div>
          </div>

          {loading ? <p className="text-sm text-slate-600">Cargando solicitudes...</p> : needs.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Aun no has publicado necesidades de ruta.</div>
          ) : needs.map((need) => (
            <article key={need.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{getRequestedRouteStatusLabel(need.status)}</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{need.originText} &gt; {need.destinationText}</h3>
                  <p className="mt-1 text-sm text-slate-600">{formatWeekdays(need.recurrenceDays)} a las {need.desiredTime} | {need.seatsNeeded} lugar(es)</p>
                  {need.message && <p className="mt-2 text-sm text-slate-700">{need.message}</p>}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {need.proposals.length === 0 ? (
                  <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Aun no hay propuestas de conductores.</p>
                ) : need.proposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{proposal.driver?.fullName ?? 'Conductor verificado'}</p>
                        <p className="text-sm text-slate-600">{proposal.driver?.vehicle ? `${proposal.driver.vehicle.brand} ${proposal.driver.vehicle.model} | Placas ${proposal.driver.vehicle.plates}` : 'Vehiculo pendiente de mostrar'}</p>
                        <p className="mt-2 text-sm text-slate-700">Horario: <span className="font-semibold">{proposal.proposedTime}</span></p>
                        <p className="text-sm text-slate-700">Punto: <span className="font-semibold">{proposal.boardingPoint}</span></p>
                        <p className="text-sm text-slate-700">Referencia: <span className="font-semibold">{proposal.boardingReference}</span></p>
                        <p className="text-sm text-slate-700">Aportacion sugerida: <span className="font-semibold">${proposal.suggestedCashContribution.toFixed(2)} MXN</span></p>
                        {proposal.messageToUser && <p className="mt-2 text-sm text-slate-600">{proposal.messageToUser}</p>}
                        <p className="mt-2 text-xs font-semibold text-amber-800">{CASH_NOTICE}</p>
                        <p className="mt-2 text-xs font-semibold text-rose-700">Antes de abordar, verifica que conductor, vehiculo y placas coincidan. No abordes si algun dato no coincide.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{getProposalStatusLabel(proposal.status)}</span>
                    </div>
                    {proposal.status === 'pending_user_response' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busyProposalId === proposal.id} onClick={() => void respondProposal(proposal, 'accept')} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:bg-slate-300">Aceptar conductor</button>
                        <button type="button" disabled={busyProposalId === proposal.id} onClick={() => void respondProposal(proposal, 'reject')} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white disabled:text-slate-400">Rechazar propuesta</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
