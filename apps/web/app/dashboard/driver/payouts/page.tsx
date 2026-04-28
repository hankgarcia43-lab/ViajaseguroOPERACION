'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { getPayoutStatusMeta } from '@/lib/status';
import {
  DriverBankDetails,
  UpdateDriverBankDetailsPayload,
  WeeklyPayout,
  WeeklyPayoutStatsResponse
} from '@/lib/weekly-payouts';

export default function DriverPayoutsPage() {
  const [payouts, setPayouts] = useState<WeeklyPayout[]>([]);
  const [stats, setStats] = useState<WeeklyPayoutStatsResponse | null>(null);
  const [bankDetails, setBankDetails] = useState<DriverBankDetails | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [clabe, setClabe] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [requestingPayoutId, setRequestingPayoutId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadPayouts() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<WeeklyPayout[]>('/weekly-payouts/my-payouts', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setPayouts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus liquidaciones');
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(periodStartFilter?: string, periodEndFilter?: string) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setLoadingStats(true);

    try {
      const params = new URLSearchParams();
      if (periodStartFilter && periodEndFilter) {
        params.set('periodStart', new Date(periodStartFilter).toISOString());
        params.set('periodEnd', new Date(periodEndFilter).toISOString());
      }

      const query = params.toString();
      const data = await apiRequest<WeeklyPayoutStatsResponse>(`/weekly-payouts/my-stats${query ? `?${query}` : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus estadisticas de liquidacion');
    } finally {
      setLoadingStats(false);
    }
  }

  async function loadBankDetails() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    try {
      const data = await apiRequest<DriverBankDetails>('/weekly-payouts/my-bank-details', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setBankDetails(data);
      setAccountNumber(data.accountNumber ?? '');
      setClabe(data.clabe ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus datos bancarios');
    }
  }

  useEffect(() => {
    async function load() {
      await loadPayouts();
      await loadStats();
      await loadBankDetails();
    }

    void load();
  }, []);

  async function applyStatsFilter() {
    setError(null);

    if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
      setError('Para filtrar estadisticas define ambas fechas: inicio y fin.');
      return;
    }

    await loadStats(periodStart || undefined, periodEnd || undefined);
  }

  async function saveBankDetails() {
    setError(null);
    setSuccess(null);

    if (!/^\d{10,20}$/.test(accountNumber.trim())) {
      setError('El numero de cuenta debe tener entre 10 y 20 digitos numericos.');
      return;
    }

    if (!/^\d{18}$/.test(clabe.trim())) {
      setError('La CLABE debe tener exactamente 18 digitos numericos.');
      return;
    }

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setSavingBank(true);

    try {
      const payload: UpdateDriverBankDetailsPayload = {
        accountNumber: accountNumber.trim(),
        clabe: clabe.trim()
      };

      const updated = await apiRequest<DriverBankDetails>('/weekly-payouts/my-bank-details', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setBankDetails(updated);
      setSuccess('Datos bancarios guardados correctamente.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar tus datos bancarios');
    } finally {
      setSavingBank(false);
    }
  }

  async function requestPayment(payoutId: string) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setRequestingPayoutId(payoutId);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/weekly-payouts/${payoutId}/request-payment`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      setSuccess('Solicitud de pago enviada al administrador.');
      await loadPayouts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo solicitar el pago');
    } finally {
      setRequestingPayoutId(null);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando liquidaciones...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Mis liquidaciones semanales</h1>
          <p className="text-sm text-slate-600">La cuenta debe estar a nombre del usuario de la cuenta de Viaje Seguro.</p>
          <p className="text-xs text-slate-500">Tu pago se libera cuando terminas tus viajes del periodo y el admin marca la liquidacion como pagada.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mis viajes
          </Link>
          <Link href="/dashboard" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Dashboard
          </Link>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Datos bancarios para pago</h2>
        <p className="text-sm text-slate-600">Registra solo tu numero de cuenta y CLABE para solicitar pago.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Numero de cuenta
            <input
              type="text"
              inputMode="numeric"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-700">
            CLABE (18 digitos)
            <input
              type="text"
              inputMode="numeric"
              value={clabe}
              onChange={(event) => setClabe(event.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
<div>
          <button
            type="button"
            onClick={() => void saveBankDetails()}
            disabled={savingBank}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingBank ? 'Guardando...' : 'Guardar datos bancarios'}
          </button>
        </div>
{bankDetails && (
          <p className="text-xs text-slate-500">
            Estado: {bankDetails.isComplete ? 'Completo' : 'Incompleto'}
          </p>
        )}
      </section>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-slate-700">
          Period start
          <input
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          Period end
          <input
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="md:col-span-2 flex items-end">
          <button
            type="button"
            onClick={() => void applyStatsFilter()}
            disabled={loadingStats}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
          >
            {loadingStats ? 'Cargando estadisticas...' : 'Actualizar estadisticas'}
          </button>
        </div>
</div>
{stats && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Tus estadisticas de liquidacion</h2>
          <div className="grid gap-3 md:grid-cols-5">
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Viajes realizados</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stats.totals.totalCompletedTrips}</p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total generado</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">${stats.totals.totalMoney.toFixed(2)}</p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Comision app</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">${stats.totals.appCommissionAmount.toFixed(2)}</p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">% app</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stats.totals.appCommissionPercent.toFixed(2)}%</p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Neto para ti</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">${stats.totals.netAmount.toFixed(2)}</p>
            </article>
          </div>
</section>
      )}

      {payouts.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no tienes liquidaciones generadas.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {payouts.map((payout) => {
            const statusMeta = getPayoutStatusMeta(payout.status);
            const canRequest = payout.status === 'pending';
            const waitingBankData = !bankDetails?.isComplete;

            return (
              <article key={payout.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-700">
                  Periodo: {new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}
                </p>
                <p className="text-sm text-slate-700">Gross: ${payout.grossAmount.toFixed(2)} MXN</p>
                <p className="text-sm text-slate-700">Comision app: ${payout.appCommissionAmount.toFixed(2)} MXN</p>
                <p className="text-sm text-slate-700">Refunded: ${payout.refundedAmount.toFixed(2)} MXN</p>
                <p className="text-sm font-medium text-slate-900">Neto: ${payout.netAmount.toFixed(2)} MXN</p>
                <p className="mt-1 text-sm text-slate-700">
                  Estado: <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
                </p>
                {payout.notes && <p className="text-xs text-slate-500">Notas: {payout.notes}</p>}

                {canRequest && (
                  <button
                    type="button"
                    disabled={Boolean(waitingBankData) || requestingPayoutId === payout.id}
                    onClick={() => void requestPayment(payout.id)}
                    className="mt-3 rounded-md border border-blue-300 px-3 py-2 text-sm text-blue-700 disabled:opacity-60"
                  >
                    {requestingPayoutId === payout.id ? 'Solicitando...' : 'Solicitar pago'}
                  </button>
                )}
                {canRequest && waitingBankData && (
                  <p className="mt-2 text-xs text-amber-700">Primero registra numero de cuenta y CLABE para solicitar pago.</p>
                )}
              </article>
            );
          })}
        </div>
)}
    </section>
  );
}





