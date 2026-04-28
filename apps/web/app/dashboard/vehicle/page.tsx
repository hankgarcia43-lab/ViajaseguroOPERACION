'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { getVehicleStatusMeta, getVerificationStatusMeta } from '@/lib/status';
import { Vehicle, VehicleDocument, VehicleDocumentType, VehiclePayload } from '@/lib/vehicles';

interface MeResponse {
  id: string;
  fullName: string;
  email: string;
  role: 'driver';
  verificationStatus: 'pending' | 'approved' | 'rejected';
}

interface VehicleFormState {
  plates: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  seatCount: string;
}

const INITIAL_FORM: VehicleFormState = {
  plates: '',
  brand: '',
  model: '',
  year: '',
  color: '',
  seatCount: ''
};

const EVIDENCE_FIELDS: Array<{ type: VehicleDocumentType; title: string; hint: string }> = [
  {
    type: 'insurance_policy',
    title: 'Poliza de seguro (obligatoria)',
    hint: 'Sube una imagen o PDF legible y vigente de la poliza.'
  },
  {
    type: 'vehicle_registration',
    title: 'Tarjeta de circulacion (obligatoria)',
    hint: 'Sube ambos datos claros del documento oficial.'
  },
  {
    type: 'vehicle_photo',
    title: 'Foto del vehiculo (obligatoria)',
    hint: 'Muestra el auto completo en un lugar iluminado.'
  },
  {
    type: 'driver_photo',
    title: 'Foto del conductor (obligatoria)',
    hint: 'Foto reciente y clara del conductor.'
  }
];

const INITIAL_FILES: Record<VehicleDocumentType, File | null> = {
  insurance_policy: null,
  vehicle_registration: null,
  vehicle_photo: null,
  driver_photo: null
};

export default function VehiclePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleFormState>(INITIAL_FORM);
  const [documentNotes, setDocumentNotes] = useState('');
  const [filesByType, setFilesByType] = useState<Record<VehicleDocumentType, File | null>>(INITIAL_FILES);
  const [loading, setLoading] = useState(true);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const verificationMeta = getVerificationStatusMeta(me?.verificationStatus);
  const vehicleMeta = getVehicleStatusMeta(vehicle?.status);
  const canUploadDocuments = useMemo(() => Boolean(vehicle), [vehicle]);
  const allRequiredFilesSelected = useMemo(
    () => EVIDENCE_FIELDS.every((field) => Boolean(filesByType[field.type])),
    [filesByType]
  );

  function syncForm(nextVehicle: Vehicle | null) {
    if (!nextVehicle) {
      setForm(INITIAL_FORM);
      return;
    }

    setForm({
      plates: nextVehicle.plates,
      brand: nextVehicle.brand,
      model: nextVehicle.model,
      year: String(nextVehicle.year),
      color: nextVehicle.color ?? '',
      seatCount: String(nextVehicle.seatCount)
    });
  }

  async function loadData() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const profile = await apiRequest<MeResponse>('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      setMe(profile);

      try {
        const myVehicle = await apiRequest<Vehicle>('/vehicles/my-vehicle', { headers: { Authorization: `Bearer ${token}` } });
        setVehicle(myVehicle);
        syncForm(myVehicle);
      } catch (vehicleError) {
        const message = vehicleError instanceof Error ? vehicleError.message : 'No se pudo cargar el vehiculo';
        if (message.toLowerCase().includes('aun no has registrado un vehiculo')) {
          setVehicle(null);
          syncForm(null);
        } else {
          throw vehicleError;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el flujo de vehiculo');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function updateField<K extends keyof VehicleFormState>(field: K, value: VehicleFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateEvidenceFile(type: VehicleDocumentType, file: File | null) {
    setFilesByType((prev) => ({ ...prev, [type]: file }));
  }

  function validateVehiclePayload(): { payload: VehiclePayload | null; validationError: string | null } {
    const plates = form.plates.trim().toUpperCase();
    const brand = form.brand.trim();
    const model = form.model.trim();
    const year = Number.parseInt(form.year, 10);
    const seatCount = Number.parseInt(form.seatCount, 10);

    if (!plates) return { payload: null, validationError: 'Las placas son obligatorias.' };
    if (!brand) return { payload: null, validationError: 'La marca es obligatoria.' };
    if (!model) return { payload: null, validationError: 'El modelo es obligatorio.' };
    if (!form.color.trim()) return { payload: null, validationError: 'El color es obligatorio.' };
    if (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear() + 1) return { payload: null, validationError: 'El anio debe ser valido.' };
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 20) return { payload: null, validationError: 'La cantidad de asientos debe estar entre 1 y 20.' };

    return {
      payload: {
        plates,
        brand,
        model,
        year,
        color: form.color.trim(),
        seatCount
      },
      validationError: null
    };
  }

  async function onSaveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    const { payload, validationError } = validateVehiclePayload();
    if (!payload) {
      setError(validationError);
      return;
    }

    setSavingVehicle(true);

    try {
      const saved = await apiRequest<Vehicle>(vehicle ? '/vehicles/my-vehicle' : '/vehicles', {
        method: vehicle ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      setVehicle(saved);
      syncForm(saved);
      setSuccess(vehicle ? 'Vehiculo actualizado correctamente.' : 'Vehiculo registrado y enviado a revision.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el vehiculo');
    } finally {
      setSavingVehicle(false);
    }
  }

  async function uploadSingleEvidence(token: string, type: VehicleDocumentType, file: File, notes: string) {
    const formData = new FormData();
    formData.append('documentType', type);
    if (notes.trim()) formData.append('notes', notes.trim());
    formData.append('file', file);

    await apiRequest<VehicleDocument>('/vehicles/my-vehicle/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
  }

  async function onUploadDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!vehicle) {
      setError('Primero registra el vehiculo.');
      return;
    }

    const missing = EVIDENCE_FIELDS.filter((field) => !filesByType[field.type]);
    if (missing.length > 0) {
      setError(`Completa los 4 apartados obligatorios antes de subir. Faltan: ${missing.map((item) => item.title).join(', ')}.`);
      return;
    }

    setSavingDocument(true);

    try {
      for (const field of EVIDENCE_FIELDS) {
        await uploadSingleEvidence(token, field.type, filesByType[field.type] as File, documentNotes);
      }

      setSuccess('Las 4 evidencias se enviaron correctamente para revision.');
      setDocumentNotes('');
      setFilesByType(INITIAL_FILES);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron subir las evidencias del vehiculo');
    } finally {
      setSavingDocument(false);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando vehiculo...</p>;
  }

  return (
    <section className="space-y-5">
      <header className="vs-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="vs-kicker">Unidad del conductor</p>
            <h1 className="text-3xl font-semibold text-slate-950">Tu vehiculo, listo para operar</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Registra tu unidad y sube evidencias claras para que el equipo admin valide tu operacion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/routes" className="vs-button-secondary">Tomar ruta</Link>
            <Link href="/dashboard" className="vs-button-secondary">Volver al dashboard</Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <span className={`rounded-full px-3 py-2 text-sm font-medium ${verificationMeta.className}`}>
            Verificacion conductor: {verificationMeta.label}
          </span>
          <span className={`rounded-full px-3 py-2 text-sm font-medium ${vehicle ? vehicleMeta.className : 'bg-slate-100 text-slate-700'}`}>
            Vehiculo: {vehicle ? vehicleMeta.label : 'Sin registrar'}
          </span>
        </div>
      </header>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      {success && <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">{success}</p>}

      <form onSubmit={onSaveVehicle} className="vs-card space-y-4">
        <div>
          <p className="vs-kicker">Datos principales</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">{vehicle ? 'Actualiza tu unidad' : 'Registra tu vehiculo'}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-700">Placas<input value={form.plates} onChange={(event) => updateField('plates', event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
          <label className="block text-sm text-slate-700">Marca<input value={form.brand} onChange={(event) => updateField('brand', event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
          <label className="block text-sm text-slate-700">Modelo<input value={form.model} onChange={(event) => updateField('model', event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
          <label className="block text-sm text-slate-700">Anio<input type="number" value={form.year} onChange={(event) => updateField('year', event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
          <label className="block text-sm text-slate-700">Color<input value={form.color} onChange={(event) => updateField('color', event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
          <label className="block text-sm text-slate-700">Cantidad de asientos<input type="number" min={1} max={20} value={form.seatCount} onChange={(event) => updateField('seatCount', event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3" /></label>
        </div>

        {vehicle?.status === 'rejected' && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
            Tu vehiculo fue rechazado. Corrige los datos y vuelve a subir evidencias para pasar a revision.
          </p>
        )}

        <button type="submit" disabled={savingVehicle} className="vs-button-accent">
          {savingVehicle ? 'Guardando...' : vehicle ? 'Actualizar vehiculo' : 'Registrar vehiculo'}
        </button>
      </form>

      <form onSubmit={onUploadDocuments} className="vs-card space-y-4">
        <div>
          <p className="vs-kicker">Evidencias</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Sube el respaldo de tu unidad</h2>
          <p className="mt-2 text-sm text-slate-600">
            Esta seccion requiere 4 archivos obligatorios. Carga cada apartado y luego envia todo en un solo paso.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Revisa que cada archivo sea legible y vigente.</li>
            <li>Evita fotos borrosas, oscuras o incompletas.</li>
            <li>Formatos permitidos: JPG, PNG o PDF (maximo 5 MB por archivo).</li>
            <li>Si no cumples estos requisitos, el vehiculo no sera aceptado.</li>
          </ul>
        </div>

        {!canUploadDocuments && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Primero registra el vehiculo para poder adjuntar evidencias.</p>
        )}

        {vehicle?.requiredDocuments && (
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-2">
            <p>- Poliza: {vehicle.requiredDocuments.insurance_policy ? 'OK' : 'Falta'}</p>
            <p>- Tarjeta de circulacion: {vehicle.requiredDocuments.vehicle_registration ? 'OK' : 'Falta'}</p>
            <p>- Foto del vehiculo: {vehicle.requiredDocuments.vehicle_photo ? 'OK' : 'Falta'}</p>
            <p>- Foto del conductor: {vehicle.requiredDocuments.driver_photo ? 'OK' : 'Falta'}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {EVIDENCE_FIELDS.map((field) => (
            <label key={field.type} className="block text-sm text-slate-700">
              {field.title}
              <p className="mt-1 text-xs text-slate-500">{field.hint}</p>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(event) => updateEvidenceFile(field.type, event.target.files?.[0] ?? null)}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {filesByType[field.type] ? `Archivo seleccionado: ${filesByType[field.type]?.name}` : 'Sin archivo seleccionado'}
              </span>
            </label>
          ))}

          <label className="block text-sm text-slate-700 md:col-span-2">
            Notas para revision (opcional)
            <textarea
              rows={3}
              value={documentNotes}
              onChange={(event) => setDocumentNotes(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Ej. Documentos actualizados en abril"
            />
          </label>
        </div>

        <button type="submit" disabled={savingDocument || !canUploadDocuments || !allRequiredFilesSelected} className="vs-button-secondary">
          {savingDocument ? 'Subiendo evidencias...' : 'Subir las 4 evidencias'}
        </button>
      </form>

      <section className="space-y-3">
        <div>
          <p className="vs-kicker">Historial</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Documentos del vehiculo</h2>
        </div>
        {!vehicle || vehicle.documents.length === 0 ? (
          <p className="vs-card text-slate-700">Aun no has subido documentos del vehiculo.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {vehicle.documents.map((document) => {
              const fileUrl = buildApiAssetUrl(document.fileUrl);
              const statusMeta = getVehicleStatusMeta(document.status);
              const typeLabel = EVIDENCE_FIELDS.find((item) => item.type === document.documentType)?.title ?? document.documentType;

              return (
                <article key={document.id} className="vs-card-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{typeLabel}</h3>
                      <p className="text-sm text-slate-600">Subido: {new Date(document.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>
                  {document.notes && <p className="mt-3 text-sm text-slate-700">Notas: {document.notes}</p>}
                  {document.fileName && <p className="text-sm text-slate-700">Archivo: {document.fileName}</p>}
                  {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-cyan-700 underline">Ver archivo</a>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

