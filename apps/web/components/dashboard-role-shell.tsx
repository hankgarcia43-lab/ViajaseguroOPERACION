'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { APP_COMPANY_NAME, APP_SUPPORT_EMAIL, APP_SUPPORT_WHATSAPP } from '@/lib/app-config';
import { ADMIN_DASHBOARD_NAV, DRIVER_DASHBOARD_NAV, PASSENGER_DASHBOARD_NAV, type DashboardNavItem } from '@/lib/dashboard-nav';

interface MeResponse {
  role: 'passenger' | 'driver' | 'admin';
  fullName: string;
}

function isActivePath(currentPath: string, href: string) {
  if (href === '/dashboard') return currentPath === '/dashboard';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function roleCopy(role: MeResponse['role']) {
  if (role === 'driver') {
    return {
      title: 'Panel conductor',
      subtitle: 'Rutas compartidas, solicitudes, pases y seguridad en un solo flujo.'
    };
  }

  if (role === 'admin') {
    return {
      title: 'Panel admin',
      subtitle: 'Control operativo de personas, rutas, solicitudes y pagos de plataforma.'
    };
  }

  return {
    title: 'Panel usuario',
    subtitle: 'Busqueda, solicitudes, pases y seguimiento sin perderte.'
  };
}

export default function DashboardRoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    async function loadRole() {
      const token = getToken();
      if (!token) return;

      try {
        const data = await apiRequest<MeResponse>('/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setMe(data);
      } catch {
        setMe(null);
      }
    }

    void loadRole();
  }, []);

  const navItems = useMemo<DashboardNavItem[]>(() => {
    if (!me) return [];
    if (me.role === 'driver') return DRIVER_DASHBOARD_NAV;
    if (me.role === 'admin') return ADMIN_DASHBOARD_NAV;
    return PASSENGER_DASHBOARD_NAV;
  }, [me]);

  if (!me || navItems.length === 0) {
    return <>{children}</>;
  }

  const copy = roleCopy(me.role);
  const supportCenterHref = me.role === 'admin' ? '/dashboard/admin/incidents' : '/dashboard/incidents';

  return (
    <div className="vs-panel-theme">
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden self-start lg:sticky lg:top-24 lg:block">
          <div className="space-y-4 rounded-[26px] border border-slate-800 bg-[#070f22] p-5 text-white shadow-[0_24px_60px_-36px_rgba(6,10,24,0.95)]">
            <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Navegacion</p>
              <h2 className="mt-2 text-xl font-semibold">{copy.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{copy.subtitle}</p>
              <p className="mt-3 text-xs text-slate-300">{me.fullName}</p>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? 'border-blue-400/40 bg-gradient-to-r from-blue-600/35 to-indigo-600/35 text-white'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
              <p className="font-semibold uppercase tracking-[0.2em] text-blue-200">Soporte</p>
              <p className="mt-2">{APP_COMPANY_NAME}</p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link href={supportCenterHref} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/15">
                  Abrir centro de soporte
                </Link>
                {APP_SUPPORT_EMAIL ? (
                  <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/15">
                    Escribir por correo
                  </a>
                ) : null}
                {APP_SUPPORT_WHATSAPP ? (
                  <a
                    href={`https://wa.me/${APP_SUPPORT_WHATSAPP.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/15"
                  >
                    Contactar por WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <section className="vs-panel-card mb-4 p-3 lg:hidden">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Navegacion rapida</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>

          {children}
        </div>
      </div>
    </div>
  );
}
