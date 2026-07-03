import Link from 'next/link';
import { MERCADO_PAGO_DIRECT_PAYMENT_LINK, MERCADO_PAGO_PAYMENT_REFERENCE } from '@/lib/payments';

const membershipPlans = [
  {
    name: 'Prueba gratis 15 dias',
    detail: 'Publica necesidades de ruta, busca rutas disponibles y solicita unirte durante el periodo de prueba.',
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-950'
  },
  {
    name: 'Usuario miembro',
    detail: 'Acceso para solicitar unirse a rutas compartidas durante el piloto cerrado.',
    tone: 'border-sky-200 bg-sky-50 text-sky-950'
  },
  {
    name: 'Conductor verificado',
    detail: 'Revision operativa para publicar rutas recurrentes y recibir solicitudes.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950'
  },
  {
    name: 'Ruta destacada',
    detail: 'Servicio digital futuro para dar mayor visibilidad a rutas compartidas aprobadas.',
    tone: 'border-amber-200 bg-amber-50 text-amber-950'
  }
];

export default function MyPaymentsPage() {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Pagos de plataforma</p>
          <h1 className="text-2xl font-semibold text-slate-900">Membresia y servicios VIAJA SEGURO</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Los pagos realizados a VIAJA SEGURO corresponden unicamente a membresias, verificaciones, suscripciones o servicios digitales de la plataforma. VIAJA SEGURO no cobra rutas ni realiza pagos a conductores.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/my-reservations" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Mis solicitudes
          </Link>
          <Link href="/dashboard/routes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Buscar rutas
          </Link>
        </div>
      </div>

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 shadow-sm">
        <p className="font-bold">Importante para el piloto cerrado</p>
        <p className="mt-1">
          Este link no debe usarse para pagar traslados. Cualquier apoyo economico relacionado con gasolina, casetas o mantenimiento se acuerda directamente entre miembros verificados, fuera de VIAJA SEGURO.
        </p>
      </article>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {membershipPlans.map((plan) => (
          <article key={plan.name} className={`rounded-2xl border p-5 shadow-sm ${plan.tone}`}>
            <h2 className="text-lg font-black text-slate-950">{plan.name}</h2>
            <p className="mt-2 text-sm leading-6">{plan.detail}</p>
          </article>
        ))}
      </section>

      <article className="rounded-3xl border border-sky-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Link oficial</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">Mercado Pago VIAJA SEGURO</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Usa este link solo para activar una membresia, verificacion o servicio digital de VIAJASEGURO. No lo uses para pagar rutas, traslados ni aportaciones en efectivo. Referencia sugerida: <span className="font-semibold text-slate-950">{MERCADO_PAGO_PAYMENT_REFERENCE}</span>.
        </p>
        <a href={MERCADO_PAGO_DIRECT_PAYMENT_LINK} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-600">
          Activar membresia con Mercado Pago
        </a>
      </article>
    </section>
  );
}
