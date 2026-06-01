'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { Payment } from '@/lib/payments';
import { ManualRefundPayload, Refund } from '@/lib/refunds';

export default function AdminRefundsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      setLoading(false);
      return;
    }

    try {
      const [paymentsData, refundsData] = await Promise.all([
        apiRequest<Payment[]>('/payments?includeArchived=true', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        apiRequest<Refund[]>('/refunds', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setPayments(paymentsData);
      setRefunds(refundsData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la informacion de refunds');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const refundablePayments = useMemo(() => payments.filter((payment) => payment.status === 'approved'), [payments]);

  const filteredRefunds = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return refunds;

    return refunds.filter((refund) => {
      const tokens = [
        refund.id,
        refund.paymentId,
        refund.reservationId,
        String(refund.reservation?.publicId ?? ''),
        String(refund.reservation?.trip?.publicId ?? ''),
        String(refund.reservation?.trip?.route?.publicId ?? ''),
        refund.adminUser?.fullName ?? ''
      ]
        .join(' ')
        .toLowerCase();

      return tokens.includes(normalizedSearch);
    });
  }, [refunds, searchTerm]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    if (!paymentId) {
      setError('Debes seleccionar un payment validado para refund manual.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload: ManualRefundPayload = {
      amount: amount ? Number(amount) : undefined,
      reason: reason.trim() || undefined
    };

    try {
      await apiRequest(`/refunds/${paymentId}/manual-refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setAmount('');
      setReason('');
      setPaymentId('');
      setSuccess('Refund manual registrado correctamente.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo registrar el refund manual');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {

    return <p className="text-slate-700">Cargando refunds...</p>;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin - Refunds manuales</h1>
        <p className="mt-2 text-sm text-slate-600">Gestiona reembolsos manuales sobre pagos validados y revisa el historial registrado.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm text-slate-700">
          Payment a refund
          <select
            value={paymentId}
            onChange={(event) => setPaymentId(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Selecciona un payment validado</option>
            {refundablePayments.map((payment) => (
              <option key={payment.id} value={payment.id}>
                Reserva #{payment.reservation?.publicId ?? '-'} | Viaje #{payment.reservation?.trip?.publicId ?? '-'} | ${payment.amount.toFixed(2)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm text-slate-700">
            Monto (opcional)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Si se omite, usa monto total del payment"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Motivo (opcional)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={3}
            />
          </label>
        </div>

        {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        {success && <p className="rounded-md bg-emerald-50 p-3 text-emerald-700">{success}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Procesando...' : 'Registrar refund manual'}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-700">
          Buscar refund por folio
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ej. reserva #20, viaje #12, ruta #5"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      {filteredRefunds.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Todavia no hay refunds registrados.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRefunds.map((refund) => (
            <article key={refund.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Refund {refund.id.slice(0, 8)}</p>
              <p className="mt-1 text-xs text-slate-500">Reserva # {refund.reservation?.publicId ?? '-'} | Viaje # {refund.reservation?.trip?.publicId ?? '-'} | Ruta # {refund.reservation?.trip?.route?.publicId ?? '-'}</p>
              <p className="mt-2 text-sm text-slate-700">Payment: {refund.paymentId}</p>
              <p className="text-sm text-slate-700">Monto: ${refund.amount.toFixed(2)} MXN</p>
              <p className="text-sm text-slate-700">Estado: {refund.status}</p>
              <p className="text-sm text-slate-700">Motivo: {refund.reason ?? 'N/A'}</p>
              <p className="text-sm text-slate-700">Reserva UUID: {refund.reservationId}</p>
              <p className="text-xs text-slate-500">Creado: {new Date(refund.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}







