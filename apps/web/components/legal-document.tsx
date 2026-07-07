import Link from 'next/link';
import { LegalSection } from '@/lib/legal-content';

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function LegalDocument({ eyebrow, title, description, updatedAt, sections }: LegalDocumentProps) {
  return (
    <section className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <aside className="bg-slate-950 p-6 text-white md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Ultima actualizacion</p>
            <p className="mt-3 text-2xl font-black">{updatedAt}</p>
            <Link href="/legal" className="mt-5 inline-flex rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-400">
              Ver centro legal
            </Link>
          </aside>
        </div>
      </header>

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 shadow-sm">
        <p className="font-bold">Nota importante</p>
        <p className="mt-1">Este documento debe ser revisado por un asesor legal antes de operar a mayor escala. La version publicada aqui sirve como base operativa del piloto.</p>
      </article>

      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-700">{paragraph}</p>
            ))}
            {section.items && (
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}