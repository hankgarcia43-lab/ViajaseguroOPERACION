import Link from 'next/link';

const activityItems = [
  'Solicitudes recibidas por tus rutas compartidas.',
  'Usuarios aceptados o pendientes por fecha.',
  'Rutas activas, pausadas o archivadas.',
  'Incidentes o reportes enviados al admin.'
];

export default function DriverPayoutsPage() {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Actividad de ruta</p>
          <h1 className="text-2xl font-semibold text-slate-900">Resumen operativo del conductor</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            VIAJA SEGURO no administra ganancias, comisiones ni pagos a conductores por rutas compartidas. Este espacio se mantiene como panel operativo para revisar actividad y preparar mejoras de estadisticas.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mis rutas compartidas
          </Link>
          <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Publicar ruta
          </Link>
        </div>
      </div>

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 shadow-sm">
        <p className="font-bold">Sin pagos de traslado en plataforma</p>
        <p className="mt-1">
          El conductor puede compartir gastos directamente con usuarios de su ruta cuando ambas partes lo acuerden. VIAJA SEGURO solo facilita contacto, verificacion, coordinacion y seguridad operativa dentro del piloto.
        </p>
      </article>

      <section className="grid gap-4 md:grid-cols-2">
        {activityItems.map((item) => (
          <article key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{item}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
