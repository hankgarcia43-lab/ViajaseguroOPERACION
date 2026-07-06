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
            Revisa tu actividad, solicitudes y rutas cerradas sin saturar el panel principal. La informacion administrativa se mantiene separada para no confundir a usuarios.
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

      <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700 shadow-sm">
        <p className="font-bold text-slate-950">Nota administrativa discreta</p>
        <p className="mt-1">
          VIAJASEGURO no administra pagos de traslados ni promete ganancias. Cualquier aportacion de ruta, si existe, se acuerda directamente entre miembros verificados. Las reglas internas de planes, porcentajes o servicios digitales se comunican por administracion y no aparecen en el flujo principal del usuario.
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
