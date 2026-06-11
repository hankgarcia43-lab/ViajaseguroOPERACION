'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { getVerificationStatusMeta } from '@/lib/status';
import { UserDocument } from '@/lib/user-documents';

interface MeResponse {
  id: string;
  fullName: string;
  email: string;
  role: 'passenger' | 'driver' | 'admin';
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
}

async function uploadDocument(token: string, payload: { documentType: string; documentNumber?: string; notes?: string; file: File }) {
  const formData = new FormData();
  formData.append('documentType', payload.documentType);
  if (payload.documentNumber?.trim()) formData.append('documentNumber', payload.documentNumber.trim());
  if (payload.notes?.trim()) formData.append('notes', payload.notes.trim());
  formData.append('file', payload.file);

  return apiRequest<UserDocument>('/user-documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
}

function documentTypeLabel(document: UserDocument) {
  if (document.documentType === 'identity_document_front') return 'INE frente';
  if (document.documentType === 'identity_document_back') return 'INE reverso';

  const notes = (document.notes ?? '').toLowerCase();
  if (notes.includes('frente') || notes.includes('front')) return 'INE frente';
  if (notes.includes('reverso') || notes.includes('back')) return 'INE reverso';
  return 'INE';
}

export default function VerificationPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentNumber, setDocumentNumber] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const verificationMeta = getVerificationStatusMeta(me?.verificationStatus);
  const isPassenger = me?.role === 'passenger';
  const isDriver = me?.role === 'driver';

  async function loadData() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const [profile, docs] = await Promise.all([
        apiRequest<MeResponse>('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
        apiRequest<UserDocument[]>('/user-documents/my-documents', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setMe(profile);
      setDocuments(docs);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la verificacion');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [documents]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getToken();
    if (!token || !me) {
      setError('No hay sesion activa.');
      return;
    }

    if (!isPassenger && !isDriver) {
      setError('Solo pasajeros y conductores pueden enviar verificacion.');
      return;
    }

    if (!frontFile || !backFile) {
      setError('Debes subir la foto frontal y la foto reversa de tu INE.');
      return;
    }

    setSaving(true);

    try {
      await uploadDocument(token, {
        documentType: 'identity_document_front',
        documentNumber,
        notes: 'INE frente',
        file: frontFile
      });

      await uploadDocument(token, {
        documentType: 'identity_document_back',
        documentNumber,
        notes: 'INE reverso',
        file: backFile
      });

      setFrontFile(null);
      setBackFile(null);
      setDocumentNumber('');
      setSuccess('Tus documentos INE frente y reverso fueron enviados a revision.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo enviar el documento');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando verificacion...</p>;
  }

  if (!me) {
    return <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error ?? 'No se pudo cargar el usuario'}</p>;
  }

  return (
    <section className="space-y-5">
      <header className="vs-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="vs-kicker">Verificacion de cuenta</p>
            <h1 className="text-3xl font-semibold text-slate-950">Mas orden, mas seguridad</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Para {isPassenger ? 'pasajero' : isDriver ? 'conductor' : 'usuario'}, en esta etapa solo se solicita INE frente y reverso. Sin verificacion aprobada no podras realizar acciones operativas clave.
            </p>
          </div>
          <Link href="/dashboard" className="vs-button-secondary">Volver al dashboard</Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <span className="vs-chip">{me.fullName}</span>
          <span className="vs-chip">{me.email}</span>
          <span className={`rounded-full px-3 py-2 text-sm font-medium ${verificationMeta.className}`}>
            Estado: {verificationMeta.label}
          </span>
        </div>
      </header>

      <form onSubmit={onSubmit} className="vs-card space-y-4">
        <div>
          <p className="vs-kicker">Carga de documentos</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Sube tu INE en minutos</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-700 md:col-span-2">
            Numero de INE o referencia (opcional)
            <input
              value={documentNumber}
              onChange={(event) => setDocumentNumber(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="block text-sm text-slate-700">
            INE frente
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(event) => setFrontFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="block text-sm text-slate-700">
            INE reverso
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(event) => setBackFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
        </div>

        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

        <button type="submit" disabled={saving} className="vs-button-accent">
          {saving ? 'Enviando...' : 'Enviar INE frente y reverso'}
        </button>
      </form>

      <section className="space-y-3">
        <div>
          <p className="vs-kicker">Historial</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Tus documentos enviados</h2>
        </div>

        {sortedDocuments.length === 0 ? (
          <p className="vs-card text-slate-700">Aun no has subido documentos.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedDocuments.map((document) => {
              const statusMeta = getVerificationStatusMeta(document.status);
              const fileUrl = buildApiAssetUrl(document.fileUrl);

              return (
                <article key={document.id} className="vs-card-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{documentTypeLabel(document)}</h3>
                      <p className="text-sm text-slate-600">Subido: {new Date(document.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>

                  {document.documentNumber && <p className="mt-3 text-sm text-slate-700">Referencia: {document.documentNumber}</p>}
                  {document.fileName && <p className="text-sm text-slate-700">Archivo: {document.fileName}</p>}
                  {document.notes && <p className="text-sm text-slate-700">Notas: {document.notes}</p>}
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-cyan-700 underline">
                      Ver archivo
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
