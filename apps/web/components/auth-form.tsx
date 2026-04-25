'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { apiRequest, AuthResponse, saveSession } from '@/lib/api';

type RegisterMode = 'passenger' | 'driver';

interface AuthFormProps {
  mode: 'login' | RegisterMode;
}

const COPY = {
  login: {
    title: 'Bienvenido a ViajaSeguro',
    subtitle: 'Accede a tu panel para continuar con reservas, rutas o supervision.',
    icon: 'VS',
    accent: 'from-blue-600 to-indigo-600',
    bullets: ['Rutas fijas diarias', 'Conductores verificados', 'Precio transparente'],
    button: 'Iniciar sesion',
    secondaryHref: '/register/passenger',
    secondaryText: 'No tienes cuenta? Registrate gratis'
  },
  passenger: {
    title: 'Bienvenido, Pasajero',
    subtitle: 'Viaja seguro y economico de EdoMex a CDMX',
    icon: 'VS',
    accent: 'from-blue-600 to-indigo-600',
    bullets: ['Rutas fijas diarias', 'Conductores verificados', 'Precio transparente'],
    button: 'Crear cuenta de pasajero',
    secondaryHref: '/login',
    secondaryText: 'Ya tienes cuenta? Inicia sesion'
  },
  driver: {
    title: 'Bienvenido, Conductor',
    subtitle: 'Gana dinero manejando con comision operativa clara',
    icon: 'VS',
    accent: 'from-indigo-600 to-violet-600',
    bullets: ['Comision operativa visible', 'Verificacion confiable', 'Define tus horarios'],
    button: 'Crear cuenta de conductor',
    secondaryHref: '/login',
    secondaryText: 'Ya tienes cuenta? Inicia sesion'
  }
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';
  const copy = COPY[mode];

  const submitLabel = useMemo(() => {
    if (loading) {
      return 'Procesando...';
    }

    if (isLogin) {
      return copy.button;
    }

    return copy.button;
  }, [copy.button, isLogin, loading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? '')
    };

    if (!isLogin) {
      payload.fullName = String(formData.get('fullName') ?? '').trim();
      payload.phone = String(formData.get('phone') ?? '').trim();
      payload.emergencyContactName = String(formData.get('emergencyContactName') ?? '').trim();
      payload.emergencyContactPhone = String(formData.get('emergencyContactPhone') ?? '').trim();
    }

    try {
      const endpoint = isLogin ? '/auth/login' : `/auth/register/${mode}`;
      const data = await apiRequest<AuthResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      saveSession(data.accessToken, data.user.role, data.user.fullName);
      router.push('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo completar la operacion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl rounded-[30px] border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.35)] md:p-8">
      <div className="mx-auto grid w-full max-w-md gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.35)] md:max-w-xl md:p-8">
        <div className="space-y-4 text-center">
          <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${copy.accent} text-2xl text-white shadow-[0_16px_30px_-18px_rgba(79,70,229,0.85)]`}>
            <span>{copy.icon}</span>
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{copy.title}</h1>
            <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-600">{copy.subtitle}</p>
          </div>
        </div>

        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {copy.bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-blue-600">*</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <form className="space-y-4" onSubmit={onSubmit}>
          {!isLogin && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-slate-700 md:col-span-2">
                Nombre completo
                <input required name="fullName" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="block text-sm text-slate-700">
                Telefono
                <input required name="phone" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="block text-sm text-slate-700">
                Contacto de emergencia
                <input name="emergencyContactName" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
              </label>
              <label className="block text-sm text-slate-700 md:col-span-2">
                Telefono de emergencia
                <input name="emergencyContactPhone" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
              </label>
            </div>
          )}

          <label className="block text-sm text-slate-700">
            Correo electronico
            <input required type="email" name="email" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          <label className="block text-sm text-slate-700">
            Contrasena
            <input required type="password" minLength={8} name="password" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
          </label>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={loading} className={`inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r ${copy.accent} px-4 py-3 text-base font-semibold text-white shadow-[0_16px_35px_-18px_rgba(79,70,229,0.8)] transition hover:opacity-95 disabled:opacity-65`}>
            {submitLabel}
          </button>
        </form>

        <div className="text-center text-sm text-slate-600">
          <Link href={copy.secondaryHref} className="font-semibold text-indigo-600 hover:text-indigo-700">
            {copy.secondaryText}
          </Link>
        </div>

        {mode === 'driver' && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
            Importante: necesitas subir INE, licencia y documentos del vehiculo para completar verificacion.
          </p>
        )}

        <div className="text-center text-sm">
          <Link href="/" className="text-slate-500 hover:text-slate-700">
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}