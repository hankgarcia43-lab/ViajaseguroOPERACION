import Link from 'next/link';
import { LEGAL_UPDATED_AT } from '@/lib/legal-content';

const legalCards = [
  {
    href: '/legal/aviso-inicial',
    title: 'Aviso inicial',
    detail: 'Confidencialidad, privacidad, seguridad y reglas basicas antes de usar VIAJASEGURO.'
  },
  {
    href: '/legal/terminos-condiciones',
    title: 'Terminos y condiciones',
    detail: 'Reglas completas de uso, naturaleza de la plataforma, planes, rutas, conductores, seguridad y responsabilidades.'
  }
];

export default function LegalIndexPage() {
  return (
    <section className="space-y-6">
      <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Centro legal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Documentos legales de VIAJASEGURO</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Consulta las reglas de uso, confidencialidad, privacidad y seguridad que aplican a usuarios, conductores y administradores dentro de la comunidad.
        </p>
        <p className="mt-4 text-sm font-semibold text-slate-700">Ultima actualizacion: {LEGAL_UPDATED_AT}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {legalCards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
            <h2 className="text-xl font-black text-slate-950">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
          </Link>
        ))}
      </section>
    </section>
  );
}