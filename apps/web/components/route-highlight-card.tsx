interface RouteHighlightCardProps {
  title?: string | null;
  origin: string;
  destination: string;
  weekdays?: string[];
  departureTime: string;
  estimatedArrivalTime: string;
  pricePerSeat: number;
  distanceKm?: number | null;
  stopsText?: string | null;
  activeDriversCount?: number | null;
  badge?: string;
  showTown?: boolean;
  showBoardingReference?: boolean;
  tone?: 'default' | 'priority' | 'owned';
}

const WEEKDAY_SHORT_LABELS: Record<string, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mie',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sab',
  sunday: 'Dom'
};

function splitOrigin(origin: string) {
  const [municipality, ...rest] = origin.split(' - ').map((part) => part.trim()).filter(Boolean);
  const town = rest.join(' - ');

  return {
    municipality: municipality || origin,
    town: town || 'Punto principal'
  };
}

function formatWeekdays(weekdays?: string[]) {
  if (!weekdays?.length) return ['Sin dias'];
  return weekdays.map((weekday) => WEEKDAY_SHORT_LABELS[weekday] ?? weekday);
}

function toneClasses(tone: RouteHighlightCardProps['tone']) {
  if (tone === 'priority') {
    return {
      shell: 'border-brand-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50',
      price: 'bg-brand-700 text-white',
      accent: 'bg-brand-100 text-brand-800'
    };
  }

  if (tone === 'owned') {
    return {
      shell: 'border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-cyan-50',
      price: 'bg-emerald-700 text-white',
      accent: 'bg-emerald-100 text-emerald-800'
    };
  }

  return {
    shell: 'border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50',
    price: 'bg-slate-900 text-white',
    accent: 'bg-cyan-100 text-cyan-900'
  };
}

export function RouteHighlightCard({
  title,
  origin,
  destination,
  weekdays,
  departureTime,
  estimatedArrivalTime,
  pricePerSeat,
  distanceKm,
  stopsText,
  activeDriversCount,
  badge,
  showTown = true,
  showBoardingReference = true,
  tone = 'default'
}: RouteHighlightCardProps) {
  const { municipality, town } = splitOrigin(origin);
  const classes = toneClasses(tone);
  const weekdayLabels = formatWeekdays(weekdays);

  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border ${classes.shell}`}>
      <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_190px]">
        <div className="min-w-0 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`max-w-full rounded-full px-3 py-1 text-xs font-bold uppercase leading-tight ${classes.accent}`}>{badge ?? 'Ruta activa'}</span>
            {typeof activeDriversCount === 'number' && (
              <span className="max-w-full rounded-full bg-white px-3 py-1 text-xs font-semibold leading-tight text-slate-700 shadow-sm">{activeDriversCount} conductores</span>
            )}
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="min-w-0 rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Punto de partida</p>
              <p className="mt-1 break-words text-xl font-bold leading-snug text-slate-950">{municipality}</p>
              {showTown && (
                <>
                  <p className="mt-2 text-xs font-bold uppercase text-slate-500">Poblado / zona</p>
                  <p className="mt-1 break-words text-base font-semibold leading-snug text-cyan-900">{town}</p>
                </>
              )}
            </div>

            <div className="min-w-0 rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Destino</p>
              <p className="mt-1 break-words text-lg font-bold leading-snug text-slate-950">{destination}</p>
              {title && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{title}</p>}
              {typeof distanceKm === 'number' && <p className="mt-2 text-xs font-semibold text-slate-700">Distancia estimada: {distanceKm.toFixed(1)} km</p>}
            </div>
          </div>

          <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0 rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Dias de operacion</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {weekdayLabels.map((label) => (
                  <span key={label} className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-900">{label}</span>
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Horario</p>
              <p className="mt-1 text-lg font-bold leading-tight text-slate-950">{departureTime}</p>
              <p className="text-xs text-slate-500">llega aprox. {estimatedArrivalTime}</p>
            </div>
          </div>

          {showBoardingReference && stopsText && (
            <div className="mt-3 rounded-lg border border-cyan-100 bg-white/80 p-3 text-xs text-slate-700">
              <p className="font-bold text-slate-950">Referencia de abordaje</p>
              <p className="mt-1 line-clamp-3 break-words leading-relaxed">{stopsText}</p>
            </div>
          )}
        </div>

        <div className={`flex min-w-0 flex-col justify-center p-4 text-center ${classes.price}`}>
          <p className="text-xs font-bold uppercase opacity-80">Precio por asiento</p>
          <p className="mt-2 whitespace-nowrap text-2xl font-black 2xl:text-3xl">${pricePerSeat.toFixed(2)}</p>
          <p className="text-xs font-semibold opacity-90">MXN</p>
        </div>
      </div>
    </div>
  );
}
