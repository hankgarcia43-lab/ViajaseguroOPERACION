'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildApiAssetUrl, getToken } from '@/lib/api';
import {
  AdminPeopleSummary,
  AdminPerson,
  deleteAdminPerson,
  fetchAdminPeople,
  fetchAdminPeopleSummary,
  runAdminPersonAction
} from '@/lib/admin-people';
import { getVerificationStatusMeta, getVehicleStatusMeta } from '@/lib/status';

const ROLE_LABEL: Record<string, string> = {
  passenger: 'Pasajero',
  driver: 'Conductor',
  admin: 'Admin'
};

const DOCUMENT_LABEL: Record<string, string> = {
  identity_document_front: 'INE frente',
  identity_document_back: 'INE reverso',
  identity_document: 'INE legado',
  vehicle_photo: 'Foto vehiculo',
  circulation_card: 'Tarjeta circulacion',
  insurance_policy: 'Seguro'
};

function operationalLabel(status: string) {
  return status === 'suspended' ? 'Suspendido' : 'Activo';
}

function recognitionLabel(level: string) {
  return level === 'excellent' ? 'Destacado' : 'Estandar';
}

export default function AdminPeoplePage() {
  const [summary, setSummary] = useState<AdminPeopleSummary | null>(null);
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedPerson = useMemo(() => people.find((person) => person.id === selectedPersonId) ?? people[0] ?? null, [people, selectedPersonId]);

  async function load(filters = { q, role, status }) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const [summaryData, peopleData] = await Promise.all([
        fetchAdminPeopleSummary(token),
        fetchAdminPeople(token, filters)
      ]);
      setSummary(summaryData);
      setPeople(peopleData);
      setSelectedPersonId((current) => (current && peopleData.some((person) => person.id === current) ? current : peopleData[0]?.id ?? null));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el registro de personas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function applyFilters() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    await load({ q: q.trim(), role, status });
  }

  async function runAction(person: AdminPerson, action: 'suspend' | 'activate' | 'promote' | 'standard' | 'activate-subscription' | 'expire-subscription') {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    const actionLabel = {
      suspend: 'suspender',
      activate: 'reactivar/aprobar',
      promote: 'destacar',
      standard: 'quitar destacado',
      'activate-subscription': 'activar plan pagado',
      'expire-subscription': 'vencer plan'
    }[action];

    const notes = window.prompt(`Nota opcional para ${actionLabel} a ${person.fullName}:`) ?? undefined;
    if (action === 'suspend' && !window.confirm(`Suspender a ${person.fullName}? No podra operar ni iniciar sesion.`)) {
      return;
    }
    if (action === 'activate' && !window.confirm(`Reactivar y aprobar a ${person.fullName}?`)) {
      return;
    }

    setBusyAction(`${action}:${person.id}`);
    setError(null);
    setSuccess(null);

    try {
      await runAdminPersonAction(token, person.id, action, notes);
      setSuccess(`Accion completada: ${actionLabel}.`);
      await load({ q: q.trim(), role, status });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo completar la accion.');
    } finally {
      setBusyAction(null);
    }
  }

  async function removePerson(person: AdminPerson) {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!window.confirm(`Eliminar definitivamente a ${person.fullName}? Si tiene historial, la API bloqueara el borrado.`)) {
      return;
    }

    setBusyAction(`delete:${person.id}`);
    setError(null);
    setSuccess(null);

    try {
      const response = await deleteAdminPerson(token, person.id);
      setSuccess(response.message);
      await load({ q: q.trim(), role, status });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar.');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando registro de personas...</p>;
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin - Personas registradas</h1>
        <p className="mt-2 text-sm text-slate-600">Control operativo de pasajeros, conductores, documentos y estado de cuenta para la prueba piloto.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      {summary && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Usuarios totales" value={summary.total} helper={`${summary.active} activos / ${summary.suspended} suspendidos`} />
          <SummaryCard label="Pasajeros" value={summary.passengers} helper="Usuarios registrados para reservar" />
          <SummaryCard label="Conductores" value={summary.drivers} helper="Perfiles disponibles para operar" />
          <SummaryCard label="Destacados" value={summary.excellent} helper={`${summary.pendingVerifications} verificaciones pendientes`} />
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por nombre, email o telefono"
          />
          <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos los roles</option>
            <option value="passenger">Pasajeros</option>
            <option value="driver">Conductores</option>
            <option value="admin">Admins</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
          </select>
          <button type="button" onClick={() => void applyFilters()} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {people.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">No hay personas con esos filtros.</p>
          ) : (
            people.map((person) => {
              const selected = selectedPerson?.id === person.id;
              const verificationMeta = getVerificationStatusMeta(person.verificationStatus);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedPersonId(person.id)}
                  className={`w-full rounded-xl border p-4 text-left shadow-sm transition ${selected ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{person.fullName}</p>
                      <p className="text-sm text-slate-600">{person.email}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${verificationMeta.className}`}>{verificationMeta.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{ROLE_LABEL[person.role]} - {operationalLabel(person.operationalStatus)}</p>
                  <p className="text-xs text-slate-500">Docs: {person.documents.length} usuario / {person.vehicle?.documents.length ?? 0} vehiculo</p>
                </button>
              );
            })
          )}
        </aside>

        <section>
          {!selectedPerson ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">Selecciona una persona.</p>
          ) : (
            <PersonDetail
              person={selectedPerson}
              busyAction={busyAction}
              onAction={runAction}
              onDelete={removePerson}
            />
          )}
        </section>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{helper}</p>
    </article>
  );
}

function PersonDetail({
  person,
  busyAction,
  onAction,
  onDelete
}: {
  person: AdminPerson;
  busyAction: string | null;
  onAction: (person: AdminPerson, action: 'suspend' | 'activate' | 'promote' | 'standard' | 'activate-subscription' | 'expire-subscription') => Promise<void>;
  onDelete: (person: AdminPerson) => Promise<void>;
}) {
  const verificationMeta = getVerificationStatusMeta(person.verificationStatus);
  const profileStatus = person.role === 'driver' ? person.driverProfileStatus : person.passengerProfileStatus;

  return (
    <div className="space-y-4">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{person.fullName}</h2>
            <p className="text-sm text-slate-700">{person.email}</p>
            <p className="text-sm text-slate-700">Telefono: {person.phone}</p>
            <p className="text-sm text-slate-700">Rol: {ROLE_LABEL[person.role]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${verificationMeta.className}`}>{verificationMeta.label}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${person.operationalStatus === 'suspended' ? 'bg-zinc-200 text-zinc-800' : 'bg-emerald-100 text-emerald-700'}`}>{operationalLabel(person.operationalStatus)}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${person.recognitionLevel === 'excellent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{recognitionLabel(person.recognitionLevel)}</span>
            {person.subscription && (
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${person.subscription.isActivePaid ? 'bg-emerald-100 text-emerald-700' : person.subscription.isTrialActive ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}`}>
                {person.subscription.isActivePaid ? 'Plan activo' : person.subscription.isTrialActive ? `Trial ${person.subscription.trialDaysRemaining}d` : 'Sin acceso premium'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info label="Perfil" value={profileStatus ? getVerificationStatusMeta(profileStatus).label : 'N/A'} />
          <Info label="Emergencia" value={person.emergencyContactName ? `${person.emergencyContactName} - ${person.emergencyContactPhone ?? ''}` : 'Sin contacto'} />
          <Info label="Registro" value={new Date(person.createdAt).toLocaleString()} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {person.operationalStatus === 'suspended' ? (
            <button type="button" disabled={busyAction === `activate:${person.id}`} onClick={() => void onAction(person, 'activate')} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busyAction === `activate:${person.id}` ? 'Reactivando...' : 'Reactivar/aprobar'}
            </button>
          ) : (
            <button type="button" disabled={busyAction === `suspend:${person.id}`} onClick={() => void onAction(person, 'suspend')} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-60">
              {busyAction === `suspend:${person.id}` ? 'Suspendiendo...' : 'Suspender'}
            </button>
          )}

          <button type="button" disabled={busyAction === `activate-subscription:${person.id}`} onClick={() => void onAction(person, 'activate-subscription')} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-60">
            {busyAction === `activate-subscription:${person.id}` ? 'Activando...' : 'Activar plan pagado 7d'}
          </button>
          <button type="button" disabled={busyAction === `expire-subscription:${person.id}`} onClick={() => void onAction(person, 'expire-subscription')} className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-60">
            {busyAction === `expire-subscription:${person.id}` ? 'Actualizando...' : 'Vencer plan'}
          </button>

          {person.recognitionLevel === 'excellent' ? (
            <button type="button" disabled={busyAction === `standard:${person.id}`} onClick={() => void onAction(person, 'standard')} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-60">
              Quitar destacado
            </button>
          ) : (
            <button type="button" disabled={busyAction === `promote:${person.id}`} onClick={() => void onAction(person, 'promote')} className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-60">
              Destacar buen trabajador
            </button>
          )}

          {person.role !== 'admin' && (
            <button type="button" disabled={busyAction === `delete:${person.id}`} onClick={() => void onDelete(person)} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60">
              {busyAction === `delete:${person.id}` ? 'Eliminando...' : 'Eliminar sin historial'}
            </button>
          )}
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Documentos de usuario</h3>
        <DocumentGrid documents={person.documents} empty="Sin documentos de usuario." />
      </article>

      {person.vehicle && (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Vehiculo</h3>
              <p className="text-sm text-slate-700">{person.vehicle.brand} {person.vehicle.model} {person.vehicle.year}</p>
              <p className="text-sm text-slate-700">Placas: {person.vehicle.plates}</p>
              <p className="text-sm text-slate-700">Asientos: {person.vehicle.seatCount}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getVehicleStatusMeta(person.vehicle.status).className}`}>{getVehicleStatusMeta(person.vehicle.status).label}</span>
          </div>
          <DocumentGrid documents={person.vehicle.documents} empty="Sin documentos de vehiculo." />
        </article>
      )}

      {person.adminNotes && (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Notas admin</h3>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{person.adminNotes}</p>
        </article>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function DocumentGrid({ documents, empty }: { documents: AdminPerson['documents']; empty: string }) {
  if (documents.length === 0) {
    return <p className="mt-3 text-sm text-slate-600">{empty}</p>;
  }

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {documents.map((document) => {
        const statusMeta = getVerificationStatusMeta(document.status);
        const fileUrl = buildApiAssetUrl(document.fileUrl);
        return (
          <article key={document.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{DOCUMENT_LABEL[document.documentType] ?? document.documentType}</p>
                <p className="text-xs text-slate-500">{new Date(document.createdAt).toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
            </div>
            {document.documentNumber && <p className="mt-2 text-sm text-slate-700">Referencia: {document.documentNumber}</p>}
            {document.fileName && <p className="text-sm text-slate-700">Archivo: {document.fileName}</p>}
            {document.notes && <p className="mt-1 text-sm text-slate-600">{document.notes}</p>}
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-600 underline">
                Ver archivo
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}
