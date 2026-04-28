'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/login', label: 'Entrar' },
  { href: '/register/passenger', label: 'Pasajero' },
  { href: '/register/driver', label: 'Conductor' },
  { href: '/dashboard', label: 'Mi panel' }
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[rgba(247,251,253,0.86)] backdrop-blur-xl">
      <nav className="mx-auto w-full max-w-7xl px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 md:h-11 md:w-11">
              <Image src="/LOGOVJ.png" alt="Logo Viaja Seguro" width={44} height={44} className="h-full w-full object-cover" priority />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-slate-950 md:text-lg">Viaja Seguro</span>
              <span className="hidden text-xs text-slate-500 sm:block">Tu asiento seguro, a tiempo</span>
            </span>
          </Link>

          <span className="hidden rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 sm:inline-flex">
            Demo lista para piloto
          </span>
        </div>

        <ul className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-sm md:mt-4 md:flex-wrap md:overflow-visible md:pb-0">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  className={`inline-flex whitespace-nowrap rounded-full px-4 py-2.5 font-medium transition ${
                    active
                      ? 'bg-slate-950 text-white shadow-md shadow-slate-900/15'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}