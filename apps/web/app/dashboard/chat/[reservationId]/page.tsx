'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, getSessionRole, getToken } from '@/lib/api';
import { ReservationChatResponse, TripChatMessage } from '@/lib/chat';

export default function ReservationChatPage() {
  const params = useParams<{ reservationId: string }>();
  const reservationId = String(params?.reservationId ?? '').trim();

  const [messages, setMessages] = useState<TripChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'driver' | 'passenger' | 'admin' | null>(null);

  useEffect(() => {
    const currentRole = getSessionRole();
    if (currentRole === 'driver' || currentRole === 'passenger' || currentRole === 'admin') {
      setRole(currentRole);
    }
  }, []);

  async function loadMessages() {
    const token = getToken();
    if (!token || !reservationId) {
      setError('No hay sesion activa o reserva invalida.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest<ReservationChatResponse>(`/chat/reservations/${reservationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.messages ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el chat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMessages();
  }, [reservationId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token) {
      setError('No hay sesion activa.');
      return;
    }

    const message = text.trim();
    if (!message) {
      setError('Escribe un mensaje para enviarlo.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiRequest(`/chat/reservations/${reservationId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message })
      });
      setText('');
      await loadMessages();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(() => {
    if (role === 'driver') return 'Chat con pasajero';
    if (role === 'passenger') return 'Chat con conductor';
    return 'Chat de reserva';
  }, [role]);

  if (loading) {
    return <p className="text-slate-700">Cargando chat...</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">Reserva #{reservationId}</p>
        <p className="text-xs text-slate-500">Usa este chat para dudas operativas del abordaje y horario.</p>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-600">Aun no hay mensajes. Inicia la conversacion con datos claros del abordaje.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <article key={message.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  {message.sender?.fullName ?? 'Usuario'} · {new Date(message.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-slate-800">{message.message}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      {role !== 'admin' && (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm text-slate-700">
            Mensaje
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              maxLength={800}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Ej. Ya estoy en el punto de abordaje frente a la salida principal"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Enviando...' : 'Enviar mensaje'}
            </button>
            <Link href={role === 'driver' ? '/dashboard/trips' : '/dashboard/my-reservations'} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Volver
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
