import Link from 'next/link';

const communityPoints = [
  'Conductores verificados publican rutas recurrentes que ya realizan.',
  'Usuarios solicitan unirse y coordinan con el conductor aceptado.',
  'La estimacion de costo es solo orientativa para gastos compartidos.'
];

const quickSteps = [
  'Busca rutas',
  'Solicita unirte',
  'Espera aceptacion',
  'Verifica datos',
  'Usa tu pase'
];

export default function HomePage() {
  return (
    <section className="space-y-10">
      <article className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[#07111f] px-6 py-7 text-white shadow-[0_25px_70px_-35px_rgba(6,10,24,0.9)] md:px-10 md:py-10">
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-600 shadow-[0_12px_30px_-14px_rgba(14,165,233,0.9)]">
                <span className="text-lg font-black">VS</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight">ViajaSeguro</p>
            </div>
            <Link href="/login" className="text-sm font-medium text-slate-100 hover:text-white">
              Iniciar sesion
            </Link>
          </div>

          <div className="mx-auto mt-14 max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">Piloto cerrado de movilidad compartida</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-6xl">Comunidad de rutas compartidas</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              VIAJA SEGURO facilita contacto y coordinacion entre miembros verificados que comparten trayectos recurrentes entre EdoMex y CDMX.
            </p>

            <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              <Link href="/register/passenger" className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3.5 text-base font-semibold text-white shadow-[0_16px_40px_-20px_rgba(14,165,233,0.9)] transition hover:bg-sky-500">
                Solicitar acceso
              </Link>
              <Link href="/register/driver" className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-5 py-3.5 text-base font-semibold text-slate-100 transition hover:bg-white/10">
                Publicar mi ruta
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-4xl">
            <div className="grid gap-2 sm:grid-cols-5">
              {quickSteps.map((step, index) => (
                <div key={step} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center text-xs font-medium text-slate-100">
                  <span className="mr-1 text-sky-300">{index + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <section className="vs-card">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Rutas recurrentes, coordinacion clara y verificacion</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Las rutas publicadas corresponden a trayectos recurrentes que los conductores declaran realizar por cuenta propia. VIAJA SEGURO facilita el contacto y la coordinacion entre miembros verificados de la comunidad.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {communityPoints.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
          <span className="font-semibold">Aviso:</span> VIAJA SEGURO no fija tarifas de transporte, no cobra traslados y no administra pagos entre usuarios y conductores. Los pagos a la plataforma son solo para membresias, verificaciones o servicios digitales.
        </div>
      </section>
    </section>
  );
}
