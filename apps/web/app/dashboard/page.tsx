'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ContextHelpPanel } from '@/components/context-help-panel';
import { apiRequest, getToken } from '@/lib/api';
import { APP_COMPANY_NAME } from '@/lib/app-config';
import { getVerificationStatusMeta } from '@/lib/status';

interface MeResponse {
  fullName: string;
  email: string;
  role: 'passenger' | 'driver' | 'admin';
  verificationStatus: 'pending' | 'approved' | 'rejected';
  driverProfile: { id: string; status: string } | null;
  passengerProfile: { id: string; status: string } | null;
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        setError('No hay sesion activa. Inicia sesion primero.');
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest<MeResponse>('/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setMe(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return <p className="text-slate-700">Cargando tu panel...</p>;
  }

  if (error) {
    return <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>;
  }

  if (!me) return null;

  const verificationMeta = getVerificationStatusMeta(me.verificationStatus);

  const roleCopy = {
    passenger: {
      title: 'Encuentra una ruta confiable y reserva sin complicaciones',
      subtitle: 'Elige corredor, compara conductor, selecciona dias de viaje y conserva tu boleto en el panel.',
      chips: ['Punto de abordaje claro', 'Reserva semanal disponible', 'Boleto con datos del viaje']
    },
    driver: {
      title: 'Genera ingresos trasladando personas cerca de tu ruta diaria',
      subtitle: 'Si ya manejas hacia una zona de trabajo, toma una ruta compatible, publica tus horarios y llena asientos disponibles con pasajeros verificados.',
      chips: ['Aprovecha tu trayecto', 'Define horarios y referencias', 'Solicita liquidacion semanal']
    },
    admin: {
      title: 'Control total para una operacion ordenada',
      subtitle: `Administra rutas, verificaciones, pagos y liquidaciones desde un tablero central de ${APP_COMPANY_NAME}.`,
      chips: ['Mayor control', 'Aprobaciones seguras', 'Operacion demostrable']
    }
  }[me.role];

  const roleGuide =
    me.role === 'passenger'
      ? {
          subtitle: 'Sigue este orden para evitar bloqueos en el viaje.',
          points: [
            'Completa verificacion con INE frente y reverso.',
            'Reserva viaje y sube comprobante de pago.',
            'Espera validacion admin del pago.',
            'Cuando el pago este aprobado se habilita tu codigo.',
            'Llega a tiempo al punto de abordaje.'
          ],
          nextStep: 'Ir a buscar viajes o revisar tus reservas.',
          ctaHref: '/dashboard/search-trips',
          ctaLabel: 'Buscar viajes'
        }
      : me.role === 'driver'
      ? {
          subtitle: 'Flujo rapido para operar sin friccion.',
          points: [
            'Manten tu verificacion y vehiculo en estado aprobado.',
            'Toma una ruta que coincida con tu trayecto real de trabajo.',
            'Registra horario, dias, asientos y referencia exacta de abordaje.',
            'Inicia viaje y valida a cada pasajero con su codigo numerico.',
            'Consulta tus ganancias y liquidaciones.'
          ],
          nextStep: 'Tomar ruta activa y continuar en Mis viajes.',
          ctaHref: '/dashboard/routes',
          ctaLabel: 'Ir a rutas'
        }
      : {
          subtitle: 'Prioriza estos puntos para mantener la operacion estable.',
          points: [
            'Las rutas base del sistema se sincronizan automaticamente por plantilla.',
            'Aprueba verificaciones de usuario y vehiculo.',
            'Valida pagos para habilitar abordajes.',
            'Supervisa viajes iniciados y reservas.',
            'Cierra la semana con liquidaciones claras.'
          ],
          nextStep: 'Entrar al panel admin y revisar pendientes.',
          ctaHref: '/dashboard/admin',
          ctaLabel: 'Ir a panel admin'
        };

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-[0_30px_90px_-45px_rgba(7,17,31,0.85)] md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(21,184,166,0.25),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_25%)]" />
        <div className="relative space-y-5">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">Panel {me.role}</span>
          <div>
            <h1 className="text-4xl font-semibold leading-tight">{roleCopy.title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200">{roleCopy.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">{me.fullName}</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">{me.email}</span>
            <span className={`rounded-full px-4 py-2 text-sm font-medium ${verificationMeta.className}`}>Verificacion: {verificationMeta.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {roleCopy.chips.map((chip) => (
              <span key={chip} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-slate-100">{chip}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {me.role === 'driver' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <article className="vs-card">
                <p className="vs-kicker">Paso 1</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Verificacion y vehiculo</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Antes de operar, confirma tus aprobaciones para evitar bloqueos.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/verification" className="vs-button-secondary">Verificacion</Link>
                  <Link href="/dashboard/vehicle" className="vs-button-accent">Mi vehiculo</Link>
                </div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Paso 2</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Tomar ruta activa</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Elige una ruta cercana a tu traslado diario. Publica tus horarios, punto de abordaje y asientos disponibles para recibir reservas.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/routes" className="vs-button-accent">Tomar rutas</Link>
                  <Link href="/dashboard/trips" className="vs-button-secondary">Ver mis viajes</Link>
                </div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Paso 3</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Abordaje y liquidacion</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Cuando el pasajero pague y admin valide, veras la reserva. Al completar viajes, solicita tu liquidacion semanal.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/trips" className="vs-button-accent">Mis viajes</Link>
                  <Link href="/dashboard/driver/payouts" className="vs-button-secondary">Mis liquidaciones</Link>
                </div>
              </article>
            </div>
          )}

          {me.role === 'passenger' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <article className="vs-card">
                <p className="vs-kicker">Buscar</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Viaja con horario fijo y tarifa clara</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Consulta viajes disponibles, ocupacion y hora de salida antes de reservar.</p>
                <div className="mt-5 flex flex-wrap gap-2"><Link href="/dashboard/search-trips" className="vs-button-accent">Buscar viajes</Link></div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Reservar</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Sigue tu reserva sin perderte</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Revisa ticket, estado del pago y cuando se habilita tu codigo de abordaje.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/dashboard/my-reservations" className="vs-button-secondary">Mis reservas</Link>
                  <Link href="/dashboard/my-payments" className="vs-button-secondary">Mis pagos</Link>
                </div>
              </article>
              <article className="vs-card">
                <p className="vs-kicker">Confianza</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">Mas orden, mas seguridad</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Completa tu verificacion para evitar bloqueos y mantener el flujo activo.</p>
                <div className="mt-5"><Link href="/dashboard/verification" className="vs-button-secondary">Ir a verificacion</Link></div>
              </article>
            </div>
          )}

          {me.role === 'admin' && (
            <article className="vs-card">
              <p className="vs-kicker">Centro de control</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">Panel operativo del MVP</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Publica rutas, autoriza cuentas, valida pagos y supervisa viajes desde un solo lugar.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/dashboard/admin" className="vs-button-accent">Abrir panel admin</Link>
                <Link href="/dashboard/admin/payments" className="vs-button-secondary">Pagos</Link>
                <Link href="/dashboard/admin/verifications" className="vs-button-secondary">Verificaciones</Link>
              </div>
            </article>
          )}
        </div>

        <ContextHelpPanel
          title="Guia rapida"
          subtitle={roleGuide.subtitle}
          points={roleGuide.points}
          nextStep={roleGuide.nextStep}
          ctaHref={roleGuide.ctaHref}
          ctaLabel={roleGuide.ctaLabel}
        />
      </div>
    </section>
  );
}




