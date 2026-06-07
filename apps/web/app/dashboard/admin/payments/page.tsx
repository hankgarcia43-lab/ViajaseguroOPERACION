'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, buildApiAssetUrl, getToken } from '@/lib/api';
import { getPaymentCheckoutUrl, Payment } from '@/lib/payments';
import { getPaymentStatusMeta } from '@/lib/status';

const FILTERS = [
  { value: 'active', label: 'Activos' },
  { value: 'submitted', label: 'Pendientes revision' },
  { value: 'pending', label: 'Pendientes pago' },
  { value: 'approved', label: 'Validados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'archived', label: 'Archivados' },
  { value: 'all', label: 'Todos' }
] as const;

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingReview, setPendingReview] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]['value']>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [allPayments, pendingReviewData] = await Promise.all([
        apiRequest<Payment[]>('/payments?includeArchived=true', { headers }),
        apiRequest<Payment[]>('/admin/payments/pending-review', { headers })
      ]);
      setPayments(allPayments);
      setPendingReview(pendingReviewData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los pagos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function reviewPayment(paymentId: string, action: 'approve' | 'reject') {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    setBusyPaymentId(paymentId);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest(`/admin/payments/${paymentId}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reviewNotes: reviewNotes[paymentId]?.trim() || undefined })
      });
      setSuccess(action === 'approve' ? 'Pago validado correctamente.' : 'Pago rechazado correctamente.');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo revisar el pago');
    } finally {
      setBusyPaymentId(null);
    }
  }

  const filteredPayments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !payment.archivedAt) ||
        (statusFilter === 'archived' && Boolean(payment.archivedAt)) ||
        payment.status === statusFilter;
      if (!matchesStatus) return false;
      if (!normalizedSearch) return true;

      const tokens = [
        payment.id,
        payment.reservationId,
        String(payment.reservation?.publicId ?? ''),
        String(payment.reservation?.trip?.publicId ?? ''),
        String(payment.reservation?.trip?.route?.publicId ?? ''),
        payment.reservation?.passenger?.fullName ?? '',
        payment.reservation?.passenger?.email ?? ''
      ]
        .join(' ')
        .toLowerCase();

      return tokens.includes(normalizedSearch);
    });
  }, [payments, statusFilter, searchTerm]);

  if (loading) {
    return <p className="text-slate-700">Cargando pagos...</p>;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin - Pagos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Revisa comprobantes enviados por pasajeros o valida manualmente un pago para continuar con la operacion.
        </p>
      </header>
{error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Pendientes por revisar: {pendingReview.length}</p>
        <p className="mt-1 text-sm text-slate-600">Pagos aprobados archivados: {payments.filter((payment) => payment.archivedAt).length}</p>
        <p className="mt-1 text-sm text-slate-600">
          Si el pasajero ya pago fuera de la app, puedes marcarlo manualmente como validado incluso si aun no hay comprobante cargado.
        </p>
      </article>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-700">
          Buscar por folio o usuario
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ej. #15, ruta #4, viaje #8, nombre o email"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-full px-3 py-2 text-sm ${statusFilter === filter.value ? 'bg-brand-500 text-white' : 'border border-slate-300 text-slate-700'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredPayments.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">No hay pagos para este filtro.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredPayments.map((payment) => {
            const status = getPaymentStatusMeta(payment.status);
            const proofUrl = buildApiAssetUrl(payment.proofFileUrl);
            const isBusy = busyPaymentId === payment.id;
            const checkoutUrl = getPaymentCheckoutUrl(payment);
            const canApprove = ['pending', 'submitted', 'rejected'].includes(payment.status);
            const canReject = ['pending', 'submitted'].includes(payment.status);

            return (
              <article key={payment.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Reserva # {payment.reservation?.publicId ?? '-'}</p>
                    <p className="text-xs text-slate-500">Viaje # {payment.reservation?.trip?.publicId ?? '-'} | Ruta # {payment.reservation?.trip?.route?.publicId ?? '-'}</p>
                    <p className="text-xs text-slate-500">UUID payment: {payment.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                    {payment.archivedAt && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Archivado</span>}
                  </div>
                </div>

                <p className="mt-3 text-lg font-semibold text-slate-900">${payment.amount.toFixed(2)} MXN</p>
                <p className="mt-2 text-sm text-slate-700">Pasajero: {payment.reservation?.passenger?.fullName ?? 'N/A'}</p>
                <p className="text-sm text-slate-700">Email: {payment.reservation?.passenger?.email ?? 'N/A'}</p>
                <p className="text-sm text-slate-700">Proveedor: {payment.provider || 'mercadopago_link'}</p>
                <p className="text-sm text-slate-700">Metodo: {payment.paymentMethodLabel ?? 'Mercado Pago'}</p>
                <p className="text-sm text-slate-700">Referencia proveedor: {payment.providerReference ?? 'Sin referencia'}</p>
                <p className="text-sm text-slate-700">Preferencia MP: {payment.providerPreferenceId ?? 'Sin preferencia'}</p>
                {checkoutUrl ? (
                  <a href={checkoutUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-emerald-700 underline">
                    Abrir link de pago
                  </a>
                ) : (
                  <p className="text-sm text-amber-700">Sin link de checkout generado.</p>
                )}
                <p className="whitespace-pre-line text-xs text-slate-600">{payment.paymentInstructions}</p>

                {payment.reservation?.trip?.route && (
                  <p className="mt-2 text-sm text-slate-600">
                    {payment.reservation.trip.route.origin} {'->'} {payment.reservation.trip.route.destination}
                  </p>
                )}

                {proofUrl ? (
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brand-600 underline">
                    Ver comprobante
                  </a>
                ) : (
                  <p className="mt-3 text-sm text-amber-700">Aun no se ha subido comprobante.</p>
                )}

                {payment.reviewNotes && <p className="mt-2 text-sm text-slate-700">Revision: {payment.reviewNotes}</p>}
                {payment.reviewedByAdmin && <p className="text-xs text-slate-500">Revisado por: {payment.reviewedByAdmin.fullName}</p>}

                {(canApprove || canReject) && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      rows={3}
                      value={reviewNotes[payment.id] ?? ''}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        setReviewNotes((prev) => ({ ...prev, [payment.id]: event.target.value }))
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Notas de revision (opcional)"
                    />
                    <div className="flex flex-wrap gap-2">
                      {canApprove && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => reviewPayment(payment.id, 'approve')}
                          className="rounded-md border border-emerald-300 px-3 py-2 text-sm text-emerald-700 disabled:opacity-50"
                        >
                          {isBusy ? 'Procesando...' : payment.status === 'pending' ? 'Cobro manual / validar' : 'Aprobar pago'}
                        </button>
                      )}

                      {canReject && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => reviewPayment(payment.id, 'reject')}
                          className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                        >
                          {isBusy ? 'Procesando...' : payment.status === 'pending' ? 'Marcar rechazado' : 'Rechazar comprobante'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
