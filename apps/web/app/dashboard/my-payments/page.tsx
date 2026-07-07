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

const primaryPackage = {
  name: 'Plan piloto semanal',
  badge: 'Primer paquete disponible',
  price: '$150',
  period: 'MXN por semana',
  promise: 'Acceso sencillo para probar, operar y coordinar rutas compartidas durante el piloto.',
  highlights: [
    'Publicar o solicitar rutas dentro de la comunidad',
    'Buscar rutas disponibles por zona, horario y conductor',
    'Ver panel personal con solicitudes, pases y estado de acceso',
    'Soporte operativo desde comentarios, reportes y alertas',
    'Validacion de documentos para usar la plataforma con mayor confianza',
    'Acceso a mejoras del piloto conforme se liberen nuevas funciones'
  ],
  bestFor: 'Usuarios y conductores que quieren iniciar en VIAJASEGURO sin compromisos largos.'
};

const packageNotes = [
  { title: 'No cobra traslados', detail: 'El plan es por uso digital de la plataforma. Las rutas compartidas no se cobran desde este panel.' },
  { title: 'Control admin', detail: 'Si pagas por link manual, el admin valida el pago y activa tu plan.' },
  { title: 'Piloto flexible', detail: 'Este es el primer paquete; despues se podran agregar planes nuevos sin cambiar el flujo base.' }
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
      const checkout = await createMercadoPagoSubscriptionCheckout(token, 'pilot_weekly');
      const checkoutUrl = checkout.checkoutUrl ?? checkout.initPoint ?? checkout.sandboxInitPoint;

      if (!checkoutUrl) {
        throw new Error('Mercado Pago no devolvio un link de checkout.');
      }

      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      setCheckoutMessage(
        `Se abrio Mercado Pago para ${primaryPackage.name}. Monto: $${checkout.amount.toFixed(2)} ${checkout.currency}. Cuando Mercado Pago confirme el pago, tu acceso se activa automaticamente.`
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
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Paquetes de suscripcion</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Elige tu acceso para operar en VIAJASEGURO</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              El plan semanal mantiene activa tu cuenta para publicar, buscar y coordinar rutas dentro del piloto. Es simple, claro y pensado para empezar sin friccion.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard/routes/request" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Necesito una ruta</Link>
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
            <span className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-950">{primaryPackage.badge}</span>
            <h2 className="mt-5 text-3xl font-black tracking-tight md:text-4xl">{primaryPackage.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{primaryPackage.promise}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {primaryPackage.highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-50">{primaryPackage.bestFor}</p>
          </div>
          <aside className="border-t border-white/10 bg-white p-6 text-slate-950 lg:border-l lg:border-t-0 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Inversion inicial</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-6xl font-black tracking-tight">{primaryPackage.price}</span>
              <span className="pb-2 text-sm font-bold text-slate-500">{primaryPackage.period}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Ideal para iniciar la operacion piloto, validar demanda real y mantener tu cuenta activa semana por semana.</p>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={checkoutBusy || loading || me?.role === 'admin'}
                onClick={() => void startSubscriptionCheckout()}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {checkoutBusy ? 'Creando checkout...' : 'Activar paquete semanal'}
              </button>
              <a href={MERCADO_PAGO_DIRECT_PAYMENT_LINK} target="_blank" rel="noreferrer" className="flex w-full justify-center rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                Pagar con link manual
              </a>
            </div>
            {checkoutMessage && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{checkoutMessage}</p>}
            {checkoutError && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{checkoutError}</p>}
            <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Usa checkout para activacion automatica si esta disponible.</li>
              <li>Si pagas por link manual, ingresa $150 MXN.</li>
              <li>Usa la referencia: <span className="font-semibold text-slate-950">{MERCADO_PAGO_PAYMENT_REFERENCE}</span>.</li>
              <li>Regresa a la app; el admin puede validar el pago y activar tu plan.</li>
            </ol>
          </aside>
        </div>
      </article>

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
          Tu acceso premium esta bloqueado. Activa el paquete semanal para volver a publicar o solicitar rutas.
        </p>
      )}
    </section>
  );
}
