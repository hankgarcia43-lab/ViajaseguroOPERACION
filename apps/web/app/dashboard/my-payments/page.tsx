'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import {
  MERCADO_PAGO_DIRECT_PAYMENT_LINK,
  MERCADO_PAGO_PAYMENT_REFERENCE,
  createMercadoPagoSubscriptionCheckout
} from '@/lib/payments';

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

const membershipPlans = [
  {
    name: 'Prueba gratis 7 dias',
    detail: 'Publica necesidades de ruta, busca rutas disponibles y solicita unirte durante el periodo de prueba.',
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-950'
  },
  {
    name: 'Usuario miembro',
    detail: 'Acceso para solicitar unirse a rutas compartidas durante el piloto cerrado.',
    tone: 'border-sky-200 bg-sky-50 text-sky-950'
  },
  {
    name: 'Conductor verificado',
    detail: 'Revision operativa para publicar rutas recurrentes y recibir solicitudes.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950'
  },
  {
    name: 'Ruta destacada',
    detail: 'Servicio digital futuro para dar mayor visibilidad a rutas compartidas aprobadas.',
    tone: 'border-amber-200 bg-amber-50 text-amber-950'
  }
];

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(date);
}

export default function MyPaymentsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
      const planType = me?.role === 'driver' ? 'driver_monthly' : 'user_monthly';
      const checkout = await createMercadoPagoSubscriptionCheckout(token, planType);
      const checkoutUrl = checkout.checkoutUrl ?? checkout.initPoint ?? checkout.sandboxInitPoint;

      if (!checkoutUrl) {
        throw new Error('Mercado Pago no devolvio un link de checkout.');
      }

      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      setCheckoutMessage(
        `Se abrio Mercado Pago para tu acceso ${checkout.planType}. Monto: $${checkout.amount.toFixed(2)} ${checkout.currency}. Cuando Mercado Pago confirme el pago, tu acceso se activa automaticamente.`
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear el checkout automatico.';
      setCheckoutError(`${message} Puedes usar el link manual y pedir activacion al admin.`);
    } finally {
      setCheckoutBusy(false);
    }
  }

  const subscription = me?.subscription;
  const isActive = Boolean(subscription?.isActivePaid);
  const isTrial = Boolean(subscription?.isTrialActive);
  const statusLabel = isActive
    ? 'Acceso activo'
    : isTrial
      ? `Prueba gratis: ${subscription?.trialDaysRemaining ?? 0} dia(s) restantes`
      : 'Prueba vencida o sin acceso activo';
  const statusTone = isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
    : isTrial
      ? 'border-sky-200 bg-sky-50 text-sky-950'
      : 'border-rose-200 bg-rose-50 text-rose-950';

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Acceso de plataforma</p>
          <h1 className="text-2xl font-semibold text-slate-900">Mi acceso VIAJASEGURO</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            El acceso habilita funciones digitales de la comunidad, como publicar rutas, solicitar unirse y recibir respuestas. No representa el pago de un traslado.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/routes/request" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Necesito una ruta</Link>
          <Link href="/dashboard/search-trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Buscar rutas</Link>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-600">Cargando acceso...</p> : profileError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{profileError}</p>
      ) : (
        <article className={`rounded-2xl border p-5 shadow-sm ${statusTone}`}>
          <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">Estado actual</p>
          <h2 className="mt-1 text-2xl font-black">{statusLabel}</h2>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <p><span className="font-bold">Plan:</span> {subscription?.planType ?? 'Piloto / trial'}</p>
            <p><span className="font-bold">Fin de prueba:</span> {formatDate(subscription?.trialEndsAt)}</p>
            <p><span className="font-bold">Fin de acceso:</span> {formatDate(subscription?.subscriptionExpiresAt)}</p>
          </div>
          {!me?.access?.canUsePremiumFeatures && (
            <p className="mt-3 rounded-xl border border-white/80 bg-white p-3 text-sm font-semibold text-rose-800">
              Tu acceso premium esta bloqueado. Activa una membresia de plataforma para volver a publicar o solicitar rutas.
            </p>
          )}
        </article>
      )}

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 shadow-sm">
        <p className="font-bold">Importante para el piloto cerrado</p>
        <p className="mt-1">
          Mercado Pago se usa solo para accesos, verificaciones o servicios digitales de VIAJASEGURO. No pagues traslados desde la app; cualquier aportacion de ruta se coordina directamente en efectivo entre miembros verificados.
        </p>
      </article>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {membershipPlans.map((plan) => (
          <article key={plan.name} className={`rounded-2xl border p-5 shadow-sm ${plan.tone}`}>
            <h2 className="text-lg font-black text-slate-950">{plan.name}</h2>
            <p className="mt-2 text-sm leading-6">{plan.detail}</p>
          </article>
        ))}
      </section>

      <article className="rounded-3xl border border-sky-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Checkout automatico</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">Activar acceso con Mercado Pago</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Este boton genera un checkout de acceso con referencia interna. Si Mercado Pago confirma el pago por webhook, tu acceso se activa automaticamente.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={checkoutBusy || loading || me?.role === 'admin'}
            onClick={() => void startSubscriptionCheckout()}
            className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {checkoutBusy ? 'Creando checkout...' : 'Activar acceso'}
          </button>
          <a href={MERCADO_PAGO_DIRECT_PAYMENT_LINK} target="_blank" rel="noreferrer" className="inline-flex rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Usar link manual
          </a>
        </div>
        {checkoutMessage && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{checkoutMessage}</p>}
        {checkoutError && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{checkoutError}</p>}
        <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
          <li>Para activacion automatica, usa el boton de checkout.</li>
          <li>Si usas el link manual, ingresa el monto indicado por admin.</li>
          <li>Usa la referencia: <span className="font-semibold text-slate-950">{MERCADO_PAGO_PAYMENT_REFERENCE}</span>.</li>
          <li>Regresa a la app y revisa tu estado de acceso.</li>
        </ol>
      </article>
    </section>
  );
}
