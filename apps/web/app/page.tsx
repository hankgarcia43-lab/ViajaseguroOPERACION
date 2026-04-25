import Link from 'next/link';

const benefits = [
  'Precio justo y claro',
  'Conductores verificados',
  'Rutas fijas diarias'
];

const quickSteps = [
  'Registrate',
  'Valida tu cuenta',
  'Reserva o publica',
  'Realiza tu pago',
  'Aborda con codigo'
];

export default function HomePage() {
  return (
    <section className="space-y-10">
      <article className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[#070f22] px-6 py-7 text-white shadow-[0_25px_70px_-35px_rgba(6,10,24,0.9)] md:px-10 md:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(71,106,235,0.45),transparent_35%),radial-gradient(circle_at_bottom,rgba(15,42,100,0.45),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-black/35" />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_12px_30px_-14px_rgba(59,130,246,0.9)]">
                <span className="text-lg">VS</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight">ViajaSeguro</p>
            </div>
            <Link href="/login" className="text-sm font-medium text-slate-100 hover:text-white">
              Iniciar sesion
            </Link>
          </div>

          <div className="mx-auto mt-14 max-w-3xl text-center">
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Viaja seguro.
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Viaja economico.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              De EdoMex a CDMX con precio claro. Sin sorpresas en tu reserva.
            </p>

            <div className="mx-auto mt-8 grid max-w-xl gap-3">
              <Link href="/register/passenger" className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-base font-semibold text-white shadow-[0_16px_40px_-20px_rgba(79,70,229,0.9)] transition hover:from-blue-500 hover:to-indigo-500">
                Viaja ahora
              </Link>
              <Link href="/register/driver" className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-5 py-3.5 text-base font-semibold text-slate-100 transition hover:bg-white/10">
                Gana dinero
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-4xl">
            <div className="grid gap-2 sm:grid-cols-5">
              {quickSteps.map((step, index) => (
                <div key={step} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center text-xs font-medium text-slate-100">
                  <span className="mr-1 text-blue-300">{index + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <section className="vs-card">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Por que elegir ViajaSeguro</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Una experiencia simple, profesional y pensada para operacion real.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {benefits.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
          <span className="font-semibold">Importante:</span> usa correo y contrasena nuevos para esta plataforma. No reutilices credenciales de cuentas personales.
        </div>
      </section>
    </section>
  );
}