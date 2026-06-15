import { BaseRouteSummary } from './route-offers';

function normalizeRouteText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function splitRouteOrigin(origin: string) {
  const [municipality, ...rest] = origin.split(' - ').map((part) => part.trim()).filter(Boolean);
  const town = rest.join(' - ');

  return {
    municipality: municipality || origin,
    town: town || 'Punto principal'
  };
}

export function routeClusterKey(route: Pick<BaseRouteSummary, 'origin' | 'destination'>) {
  const { municipality } = splitRouteOrigin(route.origin);
  return `${normalizeRouteText(municipality)}|${normalizeRouteText(route.destination)}`;
}

function mergeWeekdays(routes: BaseRouteSummary[]) {
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const seen = new Set(routes.flatMap((route) => route.weekdays ?? []));
  return order.filter((day) => seen.has(day));
}

export function summarizeRouteCluster(routes: BaseRouteSummary[]): BaseRouteSummary | null {
  const [first] = routes;
  if (!first) return null;

  const { municipality } = splitRouteOrigin(first.origin);
  const activeDriversCount = routes.reduce((total, route) => total + (route.activeDriversCount ?? 0), 0);
  const lowestPrice = Math.min(...routes.map((route) => route.pricePerSeat));
  const lowestDistance = Math.min(...routes.map((route) => route.distanceKm));

  const summary: BaseRouteSummary = {
    ...first,
    title: `${municipality} -> ${first.destination}`,
    origin: municipality,
    weekdays: mergeWeekdays(routes),
    distanceKm: Number.isFinite(lowestDistance) ? lowestDistance : first.distanceKm,
    pricePerSeat: Number.isFinite(lowestPrice) ? lowestPrice : first.pricePerSeat,
    stopsText: null,
    activeDriversCount
  };

  return summary;
}

export function groupRoutesByCluster(routes: BaseRouteSummary[]): BaseRouteSummary[] {
  const buckets = new Map<string, BaseRouteSummary[]>();

  for (const route of routes) {
    const key = routeClusterKey(route);
    const current = buckets.get(key) ?? [];
    current.push(route);
    buckets.set(key, current);
  }

  return Array.from(buckets.values()).reduce<BaseRouteSummary[]>((result, items) => {
    const summary = summarizeRouteCluster(items);
    if (summary) result.push(summary);
    return result;
  }, []);
}
