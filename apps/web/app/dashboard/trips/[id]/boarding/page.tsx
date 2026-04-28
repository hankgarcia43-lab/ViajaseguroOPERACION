'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';
import { Reservation, ValidateBoardingPayload } from '@/lib/reservations';
import { getReservationStatusMeta, getTripStatusMeta } from '@/lib/status';
import { DriverTrip } from '@/lib/trips';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export default function TripBoardingPage() {
  const params = useParams<{ id: string }>();
  const tripId = params?.id;

  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [numericCode, setNumericCode] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [result, setResult] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [qrDetectedSignal, setQrDetectedSignal] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const scannerRunningRef = useRef(false);
  const detectedSignalTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const hasBarcodeDetector = typeof (window as any).BarcodeDetector !== 'undefined';
    setScannerSupported(hasMedia && hasBarcodeDetector);
  }, []);

  useEffect(() => {
    async function loadTrip() {
      const token = getToken();
      if (!token || !tripId) {
        setError('No hay sesion activa o viaje invalido.');
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest<DriverTrip>(`/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setTrip(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el viaje');
      } finally {
        setLoading(false);
      }
    }

    void loadTrip();
  }, [tripId]);

  useEffect(() => {
    return () => {
      stopScanner();
      if (detectedSignalTimeoutRef.current !== null) {
        clearTimeout(detectedSignalTimeoutRef.current);
      }
    };
  }, []);

  function extractQrToken(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('VS-RES:')) {
      const parts = trimmed.split(':');
      if (parts.length >= 3) {
        return parts.slice(2).join(':').trim();
      }
    }

    return trimmed;
  }

  function playBeep() {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;

      oscillator.connect(gain);
      gain.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
      oscillator.onended = () => {
        void audioCtx.close();
      };
    } catch {
      // no-op
    }
  }

  function notifyQrDetected() {
    setQrDetectedSignal(true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 60, 120]);
    }

    playBeep();

    if (detectedSignalTimeoutRef.current !== null) {
      clearTimeout(detectedSignalTimeoutRef.current);
    }

    detectedSignalTimeoutRef.current = window.setTimeout(() => {
      setQrDetectedSignal(false);
    }, 1600);
  }

  function stopScanner() {
    scannerRunningRef.current = false;

    if (scanRafRef.current !== null) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerActive(false);
  }

  async function startScanner() {
    setError(null);
    setSuccess(null);

    if (!scannerSupported) {
      setError('Tu navegador no soporta escaneo QR directo. Usa el codigo numerico o pega el token manual.');
      return;
    }

    try {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector as BarcodeDetectorConstructor;
      detectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        }
      });

      streamRef.current = stream;
      scannerRunningRef.current = true;

      if (!videoRef.current) {
        throw new Error('No se pudo iniciar la vista de camara');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setScannerActive(true);

      const scanLoop = async () => {
        if (!scannerRunningRef.current || !videoRef.current || !detectorRef.current) return;

        try {
          const detections = await detectorRef.current.detect(videoRef.current);
          const rawValue = detections?.[0]?.rawValue;

          if (rawValue) {
            const token = extractQrToken(rawValue);
            if (token) {
              setQrToken(token);
              setSuccess('QR detectado correctamente. Puedes validar abordaje ahora.');
              notifyQrDetected();
              stopScanner();
              return;
            }
          }
        } catch {
          // Ignora errores intermitentes de lectura y continua escaneando.
        }

        scanRafRef.current = requestAnimationFrame(scanLoop);
      };

      scanRafRef.current = requestAnimationFrame(scanLoop);
    } catch (requestError) {
      stopScanner();
      setError(requestError instanceof Error ? requestError.message : 'No se pudo acceder a la camara. Revisa permisos del navegador.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token || !tripId) {
      setError('No hay sesion activa o viaje invalido.');
      return;
    }

    const sanitizedNumericCode = numericCode.replace(/\D/g, '').slice(0, 6).trim();
    const sanitizedQrToken = qrToken.trim();

    if (!sanitizedNumericCode && !sanitizedQrToken) {
      setError('Ingresa el codigo numerico de 6 digitos o, de forma secundaria, un qr token.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setResult(null);

    const payload: ValidateBoardingPayload = {
      tripId,
      numericCode: sanitizedNumericCode || undefined,
      qrToken: sanitizedQrToken || undefined
    };

    try {
      const data = await apiRequest<Reservation>('/reservations/validate-boarding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setResult(data);
      setSuccess(`Abordaje validado correctamente para el codigo ${data.numericCode}.`);
      setNumericCode('');
      setQrToken('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo validar el abordaje');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-slate-700">Cargando viaje...</p>;
  }

  if (!trip) {
    return <p className="rounded-md bg-red-50 p-3 text-red-700">{error ?? 'Viaje no disponible'}</p>;
  }

  const tripStatusMeta = getTripStatusMeta(trip.status);
  const resultStatusMeta = getReservationStatusMeta(result?.status);
  const normalizedError = (error ?? '').toLowerCase();
  const showVerificationLink = normalizedError.includes('verific');
  const showVehicleLink = normalizedError.includes('vehiculo');

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Validar abordaje</h1>
          <p className="text-sm text-slate-600">El flujo principal es ingresar manualmente el codigo numerico de la reserva.</p>
          <p className="mt-1 text-xs text-slate-500">Usa puntos de abordaje publicos y visibles para proteger al pasajero y al conductor.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/trips" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Volver a mis viajes</Link>
        </div>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{trip.route?.title || `${trip.route?.origin || 'Ruta'} -> ${trip.route?.destination || ''}`}</h2>
        <p className="text-sm text-slate-700">Fecha: {new Date(trip.tripDate).toLocaleDateString()}</p>
        <p className="text-sm text-slate-700">Estado del viaje: <span className={`rounded-full px-2 py-1 text-xs font-medium ${tripStatusMeta.className}`}>{tripStatusMeta.label}</span></p>
        <p className="text-sm text-slate-700">Reservas activas: {trip.reservationSummary?.reservationsCount ?? 0}</p>
        <p className="text-sm text-slate-700">Asientos reservados: {trip.reservationSummary?.reservedSeats ?? 0}</p>
        <p className="text-sm text-slate-700">Asientos disponibles: {trip.reservationSummary?.remainingSeats ?? trip.availableSeatsSnapshot}</p>
        <p className="text-sm text-slate-700">Referencia de abordaje: {trip.boardingReference ?? 'Sin definir'}</p>
        <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">Confirma que el encuentro sea en un punto publico, identificado y seguro.</p>
      </article>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-700">Paso principal</p>
          <p className="mt-1 text-sm text-slate-700">Pide al pasajero su codigo numerico y escribelo aqui. El QR se mantiene solo como apoyo.</p>
        </div>

        <label className="block text-sm text-slate-700">
          Codigo numerico
          <input type="text" inputMode="numeric" maxLength={6} value={numericCode} onChange={(event) => setNumericCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-lg tracking-[0.35em]" placeholder="123456" />
        </label>

        <label className="block text-sm text-slate-700">
          QR token (opcional, via secundaria)
          <input type="text" value={qrToken} onChange={(event) => setQrToken(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Pega token si necesitas soporte" />
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Escaneo QR con camara (movil)</p>
          <p className="mt-1 text-xs text-slate-600">Funciona en navegadores compatibles y con permisos de camara. Si no, sigue usando el codigo numerico.</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startScanner()}
              disabled={scannerActive || !scannerSupported}
              className="rounded-md border border-emerald-300 px-3 py-2 text-sm text-emerald-700 disabled:opacity-50"
            >
              {scannerActive ? 'Camara activa' : 'Escanear QR con camara'}
            </button>
            {scannerActive && (
              <button
                type="button"
                onClick={stopScanner}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Detener camara
              </button>
            )}
          </div>

          {!scannerSupported && (
            <p className="mt-2 text-xs text-amber-700">Este navegador no soporta lector QR nativo. Usa codigo numerico o token manual.</p>
          )}

          {qrDetectedSignal && (
            <p className="mt-2 rounded-md bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">QR detectado. Token cargado.</p>
          )}

          {scannerActive && (
            <div className={`mt-3 overflow-hidden rounded-md border ${qrDetectedSignal ? 'border-emerald-400' : 'border-slate-300'} bg-black`}>
              <video ref={videoRef} autoPlay playsInline muted className="h-64 w-full object-cover" />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            {showVerificationLink && <Link href="/dashboard/verification" className="mt-2 inline-block underline">Completar verificacion</Link>}
            {showVehicleLink && <Link href="/dashboard/vehicle" className="mt-2 ml-3 inline-block underline">Registrar o revisar mi vehiculo</Link>}
          </div>
        )}
        {success && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

        <button type="submit" disabled={submitting} className="w-full rounded-md bg-brand-500 px-4 py-2 font-medium text-white disabled:opacity-60">
          {submitting ? 'Validando...' : 'Validar abordaje'}
        </button>
      </form>

      {result && (
        <article className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h3 className="font-semibold text-green-900">Abordaje validado</h3>
          <p className="text-sm text-green-800">Reserva: {result.id}</p>
          <p className="text-sm text-green-800">Codigo: {result.numericCode}</p>
          <p className="text-sm text-green-800">Pasajero titular: {result.passenger?.fullName ?? 'No disponible'}</p>
          <p className="text-sm text-green-800">Asientos pagados: {result.totalSeats}</p>
          <p className="text-sm text-green-800">Estado actual: <span className={resultStatusMeta.className}>{resultStatusMeta.label}</span></p>
          <Link href={`/dashboard/chat/${result.id}`} className="mt-2 inline-block rounded-md border border-emerald-300 px-3 py-1 text-xs text-emerald-800">
            Chat con pasajero
          </Link>
        </article>
      )}
    </section>
  );
}
