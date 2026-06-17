'use client';

import { useEffect, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { INCIDENT_TYPE_LABELS, Incident } from '@/lib/incidents';

export default function AdminIncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      const data = await apiRequest<Incident[]>('/incidents/admin/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el panel de incidencias.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function getIncidentTone(type: Incident['type']) {
    if (type === 'sos') return 'border-red-300 bg-red-50';
    if (type === 'alert' || type === 'attempted_theft' || type === 'suspicious_behavior') return 'border-amber-300 bg-amber-50';
    return 'border-slate-200 bg-white';
  }

  function getStatusClass(status: Incident['status']) {
    if (status === 'resolved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'false_alarm') return 'bg-slate-200 text-slate-700';
    if (status === 'reviewing') return 'bg-sky-100 text-sky-700';
    return 'bg-amber-100 text-amber-700';
  }

  function getStatusLabel(status: Incident['status']) {
    if (status === 'resolved') return 'Resuelto';
    if (status === 'reviewing') return 'En revision';
    if (status === 'false_alarm') return 'Falsa alarma';
    return 'Abierto';
  }

  async function resolveIncident(id: string) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyId(id);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/incidents/admin/${id}/resolve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      setSuccess('Incidencia marcada como resuelta.');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo resolver la incidencia.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-slate-700">Cargando incidencias...</p>;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Comentarios, reportes y alertas</h1>
        <p className="text-sm text-slate-600">Panel de supervision para dar seguimiento a incidencias operativas, SOS y reportes rapidos.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Sin incidencias registradas.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((incident) => (
            <article key={incident.id} className={`rounded-xl border p-4 shadow-sm ${getIncidentTone(incident.type)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{incident.title}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(incident.status)}`}>
                  {getStatusLabel(incident.status)}
                </span>
              </div>
              <p className="text-sm text-slate-600">Tipo: {INCIDENT_TYPE_LABELS[incident.type] ?? incident.type} | Reportado por: {incident.reporter.fullName} ({incident.reporter.role})</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                {incident.tripId && <span className="rounded-full bg-white px-2 py-1">Viaje: {incident.tripId}</span>}
                {incident.reservationId && <span className="rounded-full bg-white px-2 py-1">Reserva: {incident.reservationId}</span>}
                {incident.routeId && <span className="rounded-full bg-white px-2 py-1">Ruta: {incident.routeId}</span>}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{incident.message}</p>
              {incident.status !== 'resolved' && (
                <button type="button" disabled={busyId === incident.id} onClick={() => void resolveIncident(incident.id)} className="mt-3 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60">
                  {busyId === incident.id ? 'Procesando...' : 'Marcar resuelto'}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}