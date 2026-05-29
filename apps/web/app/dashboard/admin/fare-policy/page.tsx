'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { FarePolicy, FarePolicyPayload } from '@/lib/fare-policy';
import { farePolicyModeLabel } from '@/lib/routes';

const INITIAL_FORM: FarePolicyPayload = {
  mode: 'max_per_km',
  ratePerKm: 0,
  appCommissionPercent: 15,
  currency: 'MXN',
  notes: ''
};

const APP_COMMISSION_OPTIONS: Array<5 | 10 | 15> = [5, 10, 15];

export default function FarePolicyAdminPage() {
  const [currentPolicy, setCurrentPolicy] = useState<FarePolicy | null>(null);
  const [history, setHistory] = useState<FarePolicy[]>([]);
  const [form, setForm] = useState<FarePolicyPayload>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const previewLabel = useMemo(() => farePolicyModeLabel(form.mode), [form.mode]);

  async function loadData() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [current, historyData] = await Promise.all([
        apiRequest<FarePolicy | null>('/admin/fare-policy/current', { headers }),
        apiRequest<FarePolicy[]>('/admin/fare-policy/history', { headers })
      ]);

      setCurrentPolicy(current);
      setHistory(historyData);
      if (current) {
        setForm({
          mode: current.mode,
          ratePerKm: current.ratePerKm,
          appCommissionPercent: current.appCommissionPercent,
          currency: current.currency,
          notes: current.notes ?? ''
        });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la politica de tarifa.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (form.ratePerKm <= 0) {
      setError('La tarifa por kilometro debe ser mayor a 0.');
      return;
    }

    if (!APP_COMMISSION_OPTIONS.includes(form.appCommissionPercent)) {
      setError('La tarifa de cobro al chofer debe ser 5%, 10% o 15%.');
      return;
    }

    setSaving(true);
    try {
      const payload: FarePolicyPayload = {
        mode: form.mode,
        ratePerKm: Number(form.ratePerKm),
        appCommissionPercent: form.appCommissionPercent,
        currency: form.currency || 'MXN',
        notes: form.notes?.trim() || undefined
      };

      const updated = await apiRequest<FarePolicy>('/admin/fare-policy/current', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setCurrentPolicy(updated);
      setSuccess('Politica de tarifa y cobro al chofer actualizada correctamente.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar la politica de tarifa.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando politica de tarifa...</p>;
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Tarifas y cobro al chofer</h1>
        <p className="mt-2 text-sm text-slate-600">
          Controla la politica comercial de precio por asiento y el porcentaje que VIAJA SEGURO cobra al chofer sobre pagos aprobados.
        </p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Politica activa</p>
            <p className="mt-1 text-sm text-slate-600">
              {currentPolicy
                ? `${farePolicyModeLabel(currentPolicy.mode)} de $${currentPolicy.ratePerKm.toFixed(2)} ${currentPolicy.currency} por km. Cobro al chofer: ${currentPolicy.appCommissionPercent}%.`
                : 'Aun no existe una politica activa.'}
            </p>
          </div>

          <label className="block text-sm text-slate-700">
            Tipo de politica
            <select
              value={form.mode}
              onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as FarePolicy['mode'] }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="max_per_km">Tarifa maxima por km</option>
              <option value="fixed_per_km">Tarifa fija por km</option>
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Tarifa por kilometro
            <input
              type="number"
              min={0.1}
              step="0.01"
              value={form.ratePerKm}
              onChange={(event) => setForm((prev) => ({ ...prev, ratePerKm: Number(event.target.value) }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Tarifa de cobro al chofer
            <select
              value={form.appCommissionPercent}
              onChange={(event) => setForm((prev) => ({ ...prev, appCommissionPercent: Number(event.target.value) as 5 | 10 | 15 }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {APP_COMMISSION_OPTIONS.map((percent) => (
                <option key={percent} value={percent}>{percent}% de cada pago aprobado</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Moneda
            <input
              value={form.currency ?? 'MXN'}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Nota administrativa
            <textarea
              rows={4}
              value={form.notes ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Describe el criterio comercial o la vigencia de esta politica"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Vista previa</p>
            <p className="mt-2">{previewLabel}: ${Number(form.ratePerKm || 0).toFixed(2)} {form.currency ?? 'MXN'} por km.</p>
            <p className="mt-1">VIAJA SEGURO cobrara {form.appCommissionPercent}% y el chofer recibira {100 - form.appCommissionPercent}% del pago aprobado.</p>
            <p className="mt-2 text-xs text-slate-500">
              {form.mode === 'fixed_per_km'
                ? 'El sistema reemplazara el precio propuesto y calculara el precio final automaticamente.'
                : 'El sistema dejara proponer precio, pero bloqueara cualquier valor que supere el maximo permitido.'}
            </p>
          </div>

          <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar politica'}
          </button>
        </form>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Historial reciente</p>
            <p className="mt-1 text-sm text-slate-600">Trazabilidad basica de cambios aplicados por admin.</p>
          </div>

          {history.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Aun no hay politicas registradas.</p>
          ) : (
            <div className="space-y-3">
              {history.map((policy) => (
                <article key={policy.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{farePolicyModeLabel(policy.mode)}</p>
                      <p className="text-sm text-slate-600">${policy.ratePerKm.toFixed(2)} {policy.currency} por km</p>
                      <p className="text-sm text-slate-600">Cobro al chofer: {policy.appCommissionPercent}%</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${policy.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {policy.isActive ? 'Activa' : 'Historica'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Actualizada: {new Date(policy.updatedAt).toLocaleString()}</p>
                  {policy.createdByAdmin && <p className="text-xs text-slate-500">Admin: {policy.createdByAdmin.fullName}</p>}
                  {policy.notes && <p className="mt-2 text-sm text-slate-700">{policy.notes}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

