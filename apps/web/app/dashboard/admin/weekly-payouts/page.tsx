import Link from 'next/link';

const ACTIONS = [
  { href: '/dashboard/admin/trips', label: 'Revisar rutas activas', helper: 'Consulta salidas, estados y actividad de conductores.' },
  { href: '/dashboard/admin/reservations', label: 'Revisar solicitudes', helper: 'Audita solicitudes aceptadas, pendientes o canceladas.' },
  { href: '/dashboard/admin/payments', label: 'Planes pagados', helper: 'Solo planes semanales, verificaciones o servicios digitales.' }
];

export default function AdminWeeklyPayoutsPage() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modulo legacy</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Liquidaciones desactivadas para piloto</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          VIAJA SEGURO no administra ganancias, comisiones, cuentas bancarias ni pagos a conductores por rutas compartidas. Esta pantalla queda como aviso operativo para evitar usar el flujo anterior durante la prueba piloto.
        </p>
      </header>

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
        <p className="font-semibold">Regla del modelo actual</p>
        <p className="mt-2 text-sm leading-6">
          Los pagos en Mercado Pago se reservan para planes semanales, verificaciones o servicios digitales de la plataforma. Las rutas compartidas se coordinan entre miembros verificados y solo muestran una estimacion orientativa.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        {ACTIONS.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow">
            <span className="block font-semibold text-slate-900">{item.label}</span>
            <span className="mt-2 block text-sm leading-6 text-slate-600">{item.helper}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
