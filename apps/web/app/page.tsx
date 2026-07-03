import Link from 'next/link';

const steps = [
  'Publica o busca una ruta.',
  'Coordina con un conductor verificado.',
  'Sigue usando VIAJASEGURO con tu suscripcion.'
];

export default function HomePage() {
  return (
    <section className="space-y-8">
      <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.7)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6 md:p-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">
                  <span className="text-lg font-black">VS</span>
                </div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950">VIAJASEGURO</p>
              </div>
              <Link href="/login" className="text-sm font-bold text-slate-700 hover:text-slate-950">Iniciar sesion</Link>
            </div>

            <div className="mt-12 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">Comunidad digital de movilidad compartida</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-slate-950 md:text-6xl">
                Encuentra rutas compartidas hacia tu trabajo, escuela o zona de destino
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Publica la ruta que necesitas o unete a rutas de conductores verificados de tu zona. VIAJASEGURO facilita la conexion y coordinacion; no cobra traslados ni administra pagos entre las partes.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register/passenger" className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-sky-800">Necesito una ruta</Link>
                <Link href="/register/driver" className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-800">Soy conductor</Link>
                <Link href="/login" className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50">Ver rutas disponibles</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Como funciona</p>
            <div className="mt-5 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-black text-sky-200">Paso {index + 1}</p>
                  <p className="mt-1 text-lg font-bold text-white">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
              La aportacion economica del trayecto, si existe, se acuerda directamente en efectivo entre usuario y conductor. VIAJASEGURO no cobra, procesa ni garantiza pagos por traslados.
            </div>
          </div>
        </div>
      </article>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">15 dias de prueba</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Todo usuario nuevo puede probar la comunidad antes de activar suscripcion.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Conductores verificados</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Antes de abordar, verifica conductor, vehiculo y placas. Si algo no coincide, no abordes y reportalo.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Suscripcion digital</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">La suscripcion habilita funciones digitales como publicar rutas, solicitar unirse y recibir respuestas. No representa el pago de un traslado.</p>
        </article>
      </section>
    </section>
  );
}
