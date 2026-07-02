type StatusMeta = {
  label: string;
  className: string;
};

const DEFAULT_META: StatusMeta = {
  label: 'Desconocido',
  className: 'bg-slate-100 text-slate-700'
};

function getMeta(map: Record<string, StatusMeta>, rawStatus: string | null | undefined): StatusMeta {
  if (!rawStatus) return DEFAULT_META;
  return map[rawStatus] ?? { label: rawStatus, className: 'bg-slate-100 text-slate-700' };
}

const routeStatusMap: Record<string, StatusMeta> = {
  active: { label: 'Activa', className: 'bg-emerald-100 text-emerald-700' },
  paused: { label: 'Pausada', className: 'bg-amber-100 text-amber-700' }
};

const tripStatusMap: Record<string, StatusMeta> = {
  scheduled: { label: 'Programado', className: 'bg-blue-100 text-blue-700' },
  started: { label: 'En curso', className: 'bg-emerald-100 text-emerald-700' },
  finished: { label: 'Finalizado', className: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-700' }
};

const reservationStatusMap: Record<string, StatusMeta> = {
  pending: { label: 'Solicitud pendiente', className: 'bg-amber-100 text-amber-700' },
  accepted: { label: 'Solicitud aceptada', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Solicitud rechazada', className: 'bg-red-100 text-red-700' },
  cancelled_by_user: { label: 'Cancelada por usuario', className: 'bg-red-100 text-red-700' },
  cancelled_by_driver: { label: 'Cancelada por conductor', className: 'bg-red-100 text-red-700' },
  reported: { label: 'Reportada', className: 'bg-rose-100 text-rose-700' },
  confirmed: { label: 'Confirmada heredada', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pagada', className: 'bg-emerald-100 text-emerald-700' },
  boarded: { label: 'Abordada', className: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Completada', className: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  no_show: { label: 'No show', className: 'bg-amber-100 text-amber-700' },
  refunded: { label: 'Reembolsada', className: 'bg-rose-100 text-rose-700' }
};

const paymentStatusMap: Record<string, StatusMeta> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  submitted: { label: 'Enviado', className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Validado', className: 'bg-emerald-100 text-emerald-700' },
  paid: { label: 'Validado', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-700' },
  failed: { label: 'Rechazado', className: 'bg-red-100 text-red-700' },
  refunded: { label: 'Reembolsado', className: 'bg-rose-100 text-rose-700' }
};

const payoutStatusMap: Record<string, StatusMeta> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  requested: { label: 'Solicitado', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pagado', className: 'bg-emerald-100 text-emerald-700' }
};

const verificationStatusMap: Record<string, StatusMeta> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobada', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-700' },
  suspended: { label: 'Suspendida', className: 'bg-zinc-200 text-zinc-800' }
};

export function getRouteStatusMeta(status: string | null | undefined) {
  return getMeta(routeStatusMap, status);
}

export function getTripStatusMeta(status: string | null | undefined) {
  return getMeta(tripStatusMap, status);
}

export function getReservationStatusMeta(status: string | null | undefined) {
  return getMeta(reservationStatusMap, status);
}

export function getPaymentStatusMeta(status: string | null | undefined) {
  return getMeta(paymentStatusMap, status);
}

export function getPayoutStatusMeta(status: string | null | undefined) {
  return getMeta(payoutStatusMap, status);
}

export function getVerificationStatusMeta(status: string | null | undefined) {
  return getMeta(verificationStatusMap, status);
}

export function getVehicleStatusMeta(status: string | null | undefined) {
  return getMeta(verificationStatusMap, status);
}
