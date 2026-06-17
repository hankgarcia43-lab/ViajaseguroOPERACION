'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, getToken } from '@/lib/api';
import { CreateIncidentPayload, INCIDENT_TYPE_LABELS, Incident, IncidentType } from '@/lib/incidents';

export default function IncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [type, setType] = useState<IncidentType>('comment');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<Incident[]>('/incidents/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar tu historial.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!title.trim() || !message.trim()) {
      setError('Captura titulo y detalle de tu comentario/reporte/alerta.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: CreateIncidentPayload = {
      type,
      title: title.trim(),
      message: message.trim()
    };

    try {
      await apiRequest('/incidents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      setSuccess('Tu reporte fue enviado al panel admin para seguimiento.');
      setTitle('');
      setMessage('');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar tu reporte.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-700">Cargando comentarios y reportes...</p>;

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Comentarios, reportes y alertas</h1>
        <p className="text-sm text-slate-600">Usa este canal para reportar incidencias operativas. Durante un viaje en curso tambien veras botones rapidos de SOS y reportar problema.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <form onSubmit={submitIncident} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value as IncidentType)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="comment">Comentario</option>
              <option value="report">Reporte</option>
              <option value="alert">Alerta</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Titulo
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm text-slate-700">
          Detalle
          <textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {saving ? 'Enviando...' : 'Enviar al panel admin'}
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Historial</h2>
          <Link href="/dashboard" className="text-sm text-brand-700 underline">Volver al dashboard</Link>
        </div>
        {items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Aun no has enviado incidencias.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((incident) => (
              <article key={incident.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{incident.title}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${incident.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {incident.status === 'resolved' ? 'Resuelto' : 'Abierto'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">Tipo: {INCIDENT_TYPE_LABELS[incident.type] ?? incident.type}</p>
                <p className="mt-2 text-sm text-slate-700">{incident.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
