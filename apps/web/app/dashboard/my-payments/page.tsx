'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import {
  MERCADO_PAGO_DIRECT_PAYMENT_LINK,
  MERCADO_PAGO_PAYMENT_REFERENCE,
  createMercadoPagoSubscriptionCheckout
} from '@/lib/payments';
import { UserDocument } from '@/lib/user-documents';

interface MeResponse {
  fullName: string;
  role: 'passenger' | 'driver' | 'admin';
  subscription?: {
    status: string;
    planType: string | null;
    trialDaysRemaining: number;
    trialEndsAt: string | null;
    subscriptionExpiresAt: string | null;
    isTrialActive: boolean;
    isActivePaid: boolean;
  };
  access?: { canUsePremiumFeatures: boolean; reason: string | null };
}

type PlanCopy = {
  planType: string;
  name: string;
  badge: string;
  price: string;
  period: string;
  promise: string;
  paymentAmount: string;
  highlights: string[];
  bestFor: string;
};

function publicAmount(raw: string | undefined, fallback: number) {
  const value = Number.parseFloat(String(raw ?? ''));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const fallbackSubscriptionAmount = publicAmount(process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_AMOUNT, 150);
const passengerPlanAmount = publicAmount(process.env.NEXT_PUBLIC_PASSENGER_SUBSCRIPTION_AMOUNT, fallbackSubscriptionAmount);
const driverPlanAmount = publicAmount(process.env.NEXT_PUBLIC_DRIVER_SUBSCRIPTION_AMOUNT, fallbackSubscriptionAmount);

function money(value: number) {
  return `$${value.toFixed(0)}`;
}

function getPlanCopy(role?: MeResponse['role'] | null): PlanCopy {
  if (role === 'driver') {
    return {
      planType: 'driver_weekly',
      name: 'Plan semanal conductor',
      badge: 'Operacion de conductor',
      price: money(driverPlanAmount),
      period: 'MXN por semana',
      paymentAmount: `${driverPlanAmount.toFixed(2)} MXN`,
      promise: 'Mantiene activa tu cuenta para publicar rutas, responder solicitudes y operar durante la prueba piloto.',
      highlights: [
        'Publicar rutas especificas con horario, referencia y cupos reales',
        'Responder solicitudes de apertura de ruta de la comunidad',
        'Ver tus viajes, pasajeros y pases por validar',
        'Usar soporte, reportes y alertas durante la operacion',
        'Mantener visible tu perfil verificado ante usuarios'
      ],
      bestFor: 'Conductores que quieren probar demanda real semana por semana sin compromiso largo.'
    };
  }

  return {
    planType: 'user_monthly',
    name: 'Plan mensual usuario',
    badge: 'Acceso de usuario',
    price: money(passengerPlanAmount),
    period: 'MXN por mes',
    paymentAmount: `${passengerPlanAmount.toFixed(2)} MXN`,
    promise: 'Acceso mensual para buscar rutas, solicitar viajes, pedir apertura de rutas y usar funciones de seguridad.',
    highlights: [
      'Buscar conductores verificados por zona, dias y horario',
      'Solicitar viajes por calendario y ver pases por fecha',
      'Pedir apertura de ruta en tu comunidad',
      'Subir reportes, comentarios y alertas de seguridad',
      'Usar prueba piloto con reglas claras de pago en efectivo diario'
    ],
    bestFor: 'Usuarios que viajaran de forma recurrente y necesitan coordinar rutas con mayor claridad.'
  };
}

const packageNotes = [
  { title: 'Mercado Pago solo para plan', detail: 'El pago digital activa el acceso a la plataforma. Los trayectos se coordinan y pagan en efectivo directamente con el conductor cada dia.' },
  { title: 'Comprobante obligatorio si usas link fijo', detail: 'Sube una captura donde se vea monto, fecha y numero de operacion para que admin pueda validar tu pago.' },
  { title: 'Sin pagos adelantados de viaje', detail: 'Para reducir fraudes, no pagues toda la semana junta por el trayecto. Paga cada dia al abordar.' }
];

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(date);
}

async function uploadPlanProof(token: string, payload: { reference: string; notes: string; file: File }) {
  const formData = new FormData();
  formData.append('documentType', 'subscription_payment_proof');
  formData.append('documentNumber', payload.reference.trim());
  formData.append('notes', payload.notes.trim());
  formData.append('file', payload.file);

  return apiRequest<UserDocument>('/user-documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
}

export default function MyPaymentsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [proofReference, setProofReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofMessage, setProofMessage] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        setProfileError('No hay sesion activa.');
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest<MeResponse>('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        setMe(data);
      } catch (requestError) {
        setProfileError(requestError instanceof Error ? requestError.message : 'No se pudo cargar tu acceso.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const plan = useMemo(() => getPlanCopy(me?.role), [me?.role]);

  async function startSubscriptionCheckout() {
    const token = getToken();
    if (!token) {
      setCheckoutError('No hay sesion activa. Inicia sesion nuevamente.');
      return;
    }

    setCheckoutBusy(true);
    setCheckoutMessage(null);
    setCheckoutError(null);

    try {
      const checkout = await createMercadoPagoSubscriptionCheckout(token, plan.planType);
      const checkoutUrl = checkout.checkoutUrl ?? checkout.initPoint ?? checkout.sandboxInitPoint;

      if (!checkoutUrl) {
        throw new Error('Mercado Pago no devolvio un link de checkout.');
      }

      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      setCheckoutMessage(
        `Se abrio Mercado Pago para ${plan.name}. Monto: $${checkout.amount.toFixed(2)} ${checkout.currency}. Si no se activa automaticamente, sube captura del pago con numero de referencia.`
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear el checkout automatico.';
      setCheckoutError(`${message} Usa el link fijo de Mercado Pago y sube comprobante para revision admin.`);
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || !me) {
      setProofError('No hay sesion activa.');
      return;
    }

    if (!proofReference.trim()) {
      setProofError('Escribe el numero de referencia u operacion de Mercado Pago.');
      return;
    }

    if (!proofFile) {
      setProofError('Sube una captura de pantalla o PDF del pago.');
      return;
    }

    setProofBusy(true);
    setProofMessage(null);
    setProofError(null);

    try {
      await uploadPlanProof(token, {
        reference: proofReference,
        notes: `${plan.name}; monto esperado ${plan.paymentAmount}; referencia visible ${MERCADO_PAGO_PAYMENT_REFERENCE}; rol ${me.role}`,
        file: proofFile
      });
      setProofReference('');
      setProofFile(null);
      setProofMessage('Comprobante enviado. Admin revisara la captura y activara el plan si el pago coincide.');
    } catch (requestError) {
      setProofError(requestError instanceof Error ? requestError.message : 'No se pudo subir el comprobante.');
    } finally {
      setProofBusy(false);
    }
  }

  const subscription = me?.subscription;
  const isActive = Boolean(subscription?.isActivePaid);
  const isTrial = Boolean(subscription?.isTrialActive);
  const statusLabel = isActive
    ? 'Plan activo'
    : isTrial
      ? `Prueba gratis: ${subscription?.trialDaysRemaining ?? 0} dia(s) restantes`
      : 'Prueba vencida o sin plan activo';
  const statusTone = isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
    : isTrial
      ? 'border-sky-200 bg-sky-50 text-sky-950'
      : 'border-rose-200 bg-rose-50 text-rose-950';

  return (
    <section className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Paquetes de acceso</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Paga tu plan y mantente activo</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Usuarios operan con plan mensual. Conductores operan con plan semanal. El pago digital es solo por acceso a la plataforma; los viajes se pagan en efectivo cada dia directamente con el conductor.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard/routes/request" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Solicitar apertura de ruta</Link>
              <Link href="/dashboard/search-trips" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Buscar rutas</Link>
            </div>
          </div>
          <div className="bg-slate-950 p-6 text-white md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Estado actual</p>
            {loading ? (
              <p className="mt-3 text-sm text-slate-300">Cargando acceso...</p>
            ) : profileError ? (
              <p className="mt-3 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm font-semibold text-red-100">{profileError}</p>
            ) : (
              <div className="mt-3 space-y-3">
                <h2 className="text-2xl font-black">{statusLabel}</h2>
                <div className={`rounded-2xl border p-4 text-sm ${statusTone}`}>
                  <p><span className="font-bold">Plan:</span> {subscription?.planType ?? 'Piloto / trial'}</p>
                  <p className="mt-1"><span className="font-bold">Fin de prueba:</span> {formatDate(subscription?.trialEndsAt)}</p>
                  <p className="mt-1"><span className="font-bold">Fin de plan:</span> {formatDate(subscription?.subscriptionExpiresAt)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <article className="relative overflow-hidden rounded-[30px] border border-emerald-200 bg-slate-950 text-white shadow-[0_28px_80px_-44px_rgba(15,23,42,0.9)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 md:p-8">
            <span className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-950">{plan.badge}</span>
            <h2 className="mt-5 text-3xl font-black tracking-tight md:text-4xl">{plan.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{plan.promise}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {plan.highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-50">{plan.bestFor}</p>
          </div>
          <aside className="border-t border-white/10 bg-white p-6 text-slate-950 lg:border-l lg:border-t-0 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Monto del plan</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-6xl font-black tracking-tight">{plan.price}</span>
              <span className="pb-2 text-sm font-bold text-slate-500">{plan.period}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Paga desde Mercado Pago. Si usas el link fijo, captura pantalla del pago y sube el comprobante para validacion manual.</p>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={checkoutBusy || loading || me?.role === 'admin'}
                onClick={() => void startSubscriptionCheckout()}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {checkoutBusy ? 'Abriendo Mercado Pago...' : 'Pagar por Mercado Pago'}
              </button>
              <a href={MERCADO_PAGO_DIRECT_PAYMENT_LINK} target="_blank" rel="noreferrer" className="flex w-full justify-center rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                Abrir link fijo de Mercado Pago
              </a>
            </div>
            {checkoutMessage && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{checkoutMessage}</p>}
            {checkoutError && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{checkoutError}</p>}
            <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Ingresa el monto exacto del plan: <span className="font-semibold text-slate-950">{plan.paymentAmount}</span>.</li>
              <li>Usa la referencia visible: <span className="font-semibold text-slate-950">{MERCADO_PAGO_PAYMENT_REFERENCE}</span>.</li>
              <li>Toma captura donde se vea monto, fecha y numero de operacion.</li>
              <li>Regresa a la app y sube el comprobante para validacion admin.</li>
            </ol>
          </aside>
        </div>
      </article>

      <form onSubmit={submitProof} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Comprobante de pago</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Subir captura para validacion</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Sube una captura de pantalla o PDF del pago de Mercado Pago. Debe verse el monto, la fecha y el numero de referencia u operacion.</p>
          </div>
          <Link href="/dashboard/admin/payments" className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Admin pagos</Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block text-sm font-semibold text-slate-700">
            Numero de referencia u operacion
            <input
              value={proofReference}
              onChange={(event) => setProofReference(event.target.value)}
              placeholder="Ej. numero de operacion de Mercado Pago"
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Captura o PDF del pago
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          El comprobante es para activar tu plan de plataforma. No subas pagos de viaje: los trayectos se pagan en efectivo cada dia directamente con el conductor.
        </div>
        {proofMessage && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{proofMessage}</p>}
        {proofError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{proofError}</p>}
        <button type="submit" disabled={proofBusy || me?.role === 'admin'} className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
          {proofBusy ? 'Subiendo comprobante...' : 'Subir comprobante'}
        </button>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        {packageNotes.map((note) => (
          <article key={note.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">{note.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{note.detail}</p>
          </article>
        ))}
      </section>

      {!me?.access?.canUsePremiumFeatures && !loading && !profileError && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          Tu acceso premium esta bloqueado. Paga tu plan por Mercado Pago y sube comprobante si necesitas validacion manual.
        </p>
      )}
    </section>
  );
}