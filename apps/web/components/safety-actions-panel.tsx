'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import {
  DRIVER_QUICK_REPORT_OPTIONS,
  INCIDENT_TYPE_LABELS,
  IncidentQuickType,
  PASSENGER_QUICK_REPORT_OPTIONS
} from '@/lib/incidents';

type SafetyRole = 'passenger' | 'driver';
type ModalMode = 'sos' | 'report' | null;

interface SafetyActionsPanelProps {
  role: SafetyRole;
  tripId?: string | null;
  reservationId?: string | null;
  routeId?: string | null;
  routeOfferId?: string | null;
  contextLabel?: string;
  className?: string;
  compact?: boolean;
}

const ROLE_LABELS: Record<SafetyRole, string> = {
  passenger: 'usuario',
  driver: 'conductor'
};

function trimMessage(value: string) {
  return value.trim().slice(0, 1500);
}

export function SafetyActionsPanel({
  role,
  tripId,
  reservationId,
  routeId,
  routeOfferId,
  contextLabel,
  className = '',
  compact = false
}: SafetyActionsPanelProps) {
  const options = role === 'passenger' ? PASSENGER_QUICK_REPORT_OPTIONS : DRIVER_QUICK_REPORT_OPTIONS;
  const defaultReportType = options.find((option) => option.value !== 'sos')?.value ?? 'other_problem';
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [reportType, setReportType] = useState<IncidentQuickType>(defaultReportType);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const contextText = useMemo(() => {
    const parts = [contextLabel, tripId ? `Ruta: ${tripId}` : null, reservationId ? `Solicitud: ${reservationId}` : null].filter(Boolean);
    return parts.length ? parts.join(' | ') : `Panel ${ROLE_LABELS[role]}`;
  }, [contextLabel, reservationId, role, tripId]);

  async function submitSos() {
    await submitIncident({
      type: 'sos',
      title: `SOS - ${ROLE_LABELS[role]}`,
      message: trimMessage(`Alerta SOS enviada por ${ROLE_LABELS[role]}. Contexto: ${contextText}. Se requiere revision operativa inmediata.`),
      successMessage: 'Alerta enviada. Mantente en un lugar seguro y contacta a las autoridades si estas en peligro inmediato.'
    });
  }

  async function submitReport() {
    const selectedLabel = INCIDENT_TYPE_LABELS[reportType] ?? 'Reporte operativo';
    await submitIncident({
      type: reportType,
      title: selectedLabel,
      message: trimMessage(`${selectedLabel}. ${message.trim() || 'Sin comentario adicional.'}\nContexto: ${contextText}`),
      successMessage: 'Reporte enviado al panel admin para seguimiento.'
    });
  }

  async function submitIncident({ type, title, message, successMessage }: { type: IncidentQuickType; title: string; message: string; successMessage: string }) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest('/incidents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type,
          title,
          message,
          routeId: routeId || undefined,
          routeOfferId: routeOfferId || undefined,
          tripId: tripId || undefined,
          reservationId: reservationId || undefined
        })
      });
      setSuccess(successMessage);
      setMessage('');
      setModalMode(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo enviar la alerta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-black">Seguridad durante la ruta</p>
          {!compact && (
            <p className="mt-1 text-red-900">
              El SOS crea una alerta interna visible para admin. No llama automaticamente a emergencias.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setModalMode('sos');
            }}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-red-800"
          >
            SOS
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setModalMode('report');
            }}
            className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
          >
            Reportar problema
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-md bg-white p-3 font-semibold text-red-700">{error}</p>}
      {success && <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800">{success}</p>}

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-slate-900 shadow-2xl">
            {modalMode === 'sos' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Confirmacion SOS</p>
                  <h2 className="mt-1 text-xl font-black">Confirma el envio de alerta SOS</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Se enviara una alerta interna al panel admin con el contexto de la ruta. Si estas en peligro inmediato, contacta a las autoridades.
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{contextText}</div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setModalMode(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void submitSos()} disabled={saving} className="rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                    {saving ? 'Enviando...' : 'Enviar SOS'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Reporte rapido</p>
                  <h2 className="mt-1 text-xl font-black">Reportar problema</h2>
                  <p className="mt-2 text-sm text-slate-600">El reporte quedara visible para admin con fecha y relacion a la ruta o solicitud.</p>
                </div>
                <label className="block text-sm text-slate-700">
                  Tipo de reporte
                  <select
                    value={reportType}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => setReportType(event.target.value as IncidentQuickType)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  >
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-700">
                  Comentario breve
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Describe lo indispensable para que admin pueda revisar."
                  />
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{contextText}</div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setModalMode(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void submitReport()} disabled={saving} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                    {saving ? 'Enviando...' : 'Enviar reporte'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
