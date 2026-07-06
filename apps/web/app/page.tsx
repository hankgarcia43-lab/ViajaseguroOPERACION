import Link from 'next/link';

const steps = [
  { title: 'Publica o encuentra ruta', detail: 'Elige origen, destino, dias y horario sin vueltas.' },
  { title: 'Confirma datos antes de abordar', detail: 'Revisa conductor, vehiculo, placas y punto de encuentro.' },
  { title: 'Viaja con seguimiento claro', detail: 'Manten tus solicitudes, pases y reportes en un solo panel.' }
];

const safetyCards = [
  {
    title: '7 dias de prueba',
    detail: 'Prueba la comunidad con rutas reales de tu zona antes de activar tu acceso digital.'
  },
  {
    title: 'Conductores verificados',
    detail: 'Aborda solo si los datos coinciden con lo que ves en VIAJASEGURO.'
  },
  {
    title: 'Puntos visibles',
    detail: 'Coordina abordajes en lugares publicos, iluminados y faciles de reconocer.'
  }
];

export default function HomePage() {
  return (
    <section className="space-y-8">
      <article className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.7)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="p-6 md:p-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
                  <span className="text-lg font-black">VS</span>
                </div>
                <p className="text-2xl font-black tracking-tight text-slate-950">VIAJASEGURO</p>
              </div>
              <Link href="/login" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Iniciar sesion</Link>
            </div>

            <div className="mt-12 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Comunidad digital de movilidad compartida</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-slate-950 md:text-6xl">
                Rutas compartidas con datos claros antes de abordar
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Publica la ruta que necesitas o encuentra conductores verificados que ya se mueven hacia tu zona. VIAJASEGURO te ayuda a coordinar mejor, con referencias visibles y reglas simples de seguridad.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register/passenger" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-slate-800">Necesito una ruta</Link>
                <Link href="/register/driver" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700">Soy conductor</Link>
                <Link href="/login" className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50">Ver rutas disponibles</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 md:p-8">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl">
              <div className="rounded-3xl bg-white p-4 text-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Ruta sugerida</p>
                    <p className="mt-1 text-xl font-black">Acolman a Indios Verdes</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Verificada</span>
                </div>
                <div className="mt-4 grid gap-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">Antes de abordar</p>
                    <p className="mt-1 text-sm font-semibold">Confirma conductor, vehiculo y placas.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">Punto de encuentro</p>
                    <p className="mt-1 text-sm font-semibold">Referencia publica y visible.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-3 text-white">
                    <p className="text-xs font-bold text-emerald-200">Seguridad activa</p>
                    <p className="mt-1 text-sm font-semibold">Reporta cualquier dato que no coincida.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Como funciona</p>
            <div className="mt-4 space-y-3">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-black text-emerald-200">Paso {index + 1}</p>
                  <p className="mt-1 text-base font-bold text-white">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <section className="grid gap-4 md:grid-cols-3">
        {safetyCards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
