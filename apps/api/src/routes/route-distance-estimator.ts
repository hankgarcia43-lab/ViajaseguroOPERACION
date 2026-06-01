export type RouteDistancePoint = {
  lat: number;
  lng: number;
};

const ROAD_FACTOR = 1.28;
const DEFAULT_INTERCITY_KM = 38;
const DEFAULT_CDMX_KM = 14;
const DEFAULT_EDOMEX_KM = 26;

const POINTS: Record<string, RouteDistancePoint> = {
  'tepexpan - centro / plaza principal': { lat: 19.6136, lng: -98.9361 },
  'tepexpan - carretera mexico-tepexpan / acceso principal': { lat: 19.6162, lng: -98.9412 },
  'ojo de agua - centro / plaza ojo de agua': { lat: 19.6804, lng: -99.0137 },
  'ojo de agua - real del sol / boulevard ojo de agua': { lat: 19.6578, lng: -99.0274 },
  'san cristobal ecatepec - centro / catedral': { lat: 19.6019, lng: -99.0501 },
  'san cristobal ecatepec - palacio municipal': { lat: 19.6015, lng: -99.0505 },
  'acolman - centro / palacio municipal': { lat: 19.6392, lng: -98.9125 },
  'tecamac - centro / palacio municipal': { lat: 19.7129, lng: -98.9687 },
  'tecamac - los heroes tecamac': { lat: 19.6322, lng: -99.0359 },
  'ecatepec - las americas / plaza comercial': { lat: 19.5867, lng: -99.0277 },
  'ecatepec - ciudad azteca / metro linea b': { lat: 19.5345, lng: -99.0277 },
  'coacalco - plaza coacalco': { lat: 19.6332, lng: -99.0954 },
  'tultitlan - centro': { lat: 19.6464, lng: -99.1671 },
  'cuautitlan izcalli - centro urbano': { lat: 19.6469, lng: -99.2117 },
  acolman: { lat: 19.6392, lng: -98.9125 },
  tecamac: { lat: 19.7129, lng: -98.9687 },
  'ecatepec de morelos': { lat: 19.6018, lng: -99.0507 },
  ecatepec: { lat: 19.6018, lng: -99.0507 },
  nezahualcoyotl: { lat: 19.4006, lng: -99.0148 },
  chimalhuacan: { lat: 19.4216, lng: -98.9504 },
  chicoloapan: { lat: 19.4169, lng: -98.9028 },
  'la paz': { lat: 19.3581, lng: -98.9771 },
  naucalpan: { lat: 19.4753, lng: -99.2373 },
  'naucalpan de juarez': { lat: 19.4753, lng: -99.2373 },
  'tlalnepantla de baz': { lat: 19.5405, lng: -99.1954 },
  tlalnepantla: { lat: 19.5405, lng: -99.1954 },
  huixquilucan: { lat: 19.3603, lng: -99.3505 },
  cuautitlan: { lat: 19.6724, lng: -99.1796 },
  tultitlan: { lat: 19.6464, lng: -99.1671 },
  'cuautitlan izcalli': { lat: 19.6469, lng: -99.2117 },
  texcoco: { lat: 19.5119, lng: -98.8829 },
  zumpango: { lat: 19.7971, lng: -99.0998 },
  toluca: { lat: 19.2826, lng: -99.6557 },
  'gustavo a. madero - indios verdes (cetram)': { lat: 19.4954, lng: -99.1196 },
  'gustavo a. madero - martin carrera (metro)': { lat: 19.4849, lng: -99.1041 },
  'gustavo a. madero - la raza (metro/hospital)': { lat: 19.4687, lng: -99.1438 },
  'gustavo a. madero - politecnico (metro)': { lat: 19.5009, lng: -99.1493 },
  'venustiano carranza - pantitlan (cetram)': { lat: 19.4154, lng: -99.0721 },
  'venustiano carranza - san lazaro (metro/tapo)': { lat: 19.4307, lng: -99.1144 },
  'cuauhtemoc - buenavista (suburbano/metrobus)': { lat: 19.4461, lng: -99.1523 },
  'cuauhtemoc - hidalgo (metro)': { lat: 19.4373, lng: -99.1472 },
  'miguel hidalgo - tacuba (metro)': { lat: 19.4596, lng: -99.1898 },
  'miguel hidalgo - chapultepec (metro)': { lat: 19.4207, lng: -99.1766 },
  'azcapotzalco - el rosario (cetram)': { lat: 19.5047, lng: -99.2001 },
  'benito juarez - centro medico (metro/hospital)': { lat: 19.4065, lng: -99.1552 },
  'tlalpan - hospitales (metro)': { lat: 19.2914, lng: -99.1638 },
  'tlalpan - el caminero (cetram)': { lat: 19.2791, lng: -99.1691 },
  'coyoacan - taxquena (cetram)': { lat: 19.3442, lng: -99.1424 },
  'coyoacan - tasquena (cetram)': { lat: 19.3442, lng: -99.1424 },
  'iztapalapa - constitucion de 1917 (cetram)': { lat: 19.3456, lng: -99.0639 },
  'iztapalapa - santa marta (cetram)': { lat: 19.3601, lng: -98.9957 },
  'hospital general de mexico dr. eduardo liceaga': { lat: 19.4135, lng: -99.1505 },
  'centro medico nacional siglo xxi': { lat: 19.4068, lng: -99.1546 },
  'hospital juarez de mexico': { lat: 19.4829, lng: -99.1329 },
  'hospital general la raza imss': { lat: 19.4694, lng: -99.1447 },
  'cuatro caminos': { lat: 19.4593, lng: -99.2159 },
  'buenavista': { lat: 19.4461, lng: -99.1523 },
  'pantitlan': { lat: 19.4154, lng: -99.0721 },
  'indios verdes': { lat: 19.4954, lng: -99.1196 }
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .trim();
}

function findPoint(value?: string | null) {
  const normalized = normalize(value ?? '');
  if (!normalized) return null;
  if (POINTS[normalized]) return POINTS[normalized];

  const match = Object.entries(POINTS).find(([key]) => normalized.includes(key) || key.includes(normalized));
  return match?.[1] ?? null;
}

function haversineKm(a: RouteDistancePoint, b: RouteDistancePoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function looksLikeCdmx(value?: string | null) {
  const normalized = normalize(value ?? '');
  return /metro|cetram|hospital|cuauhtemoc|gustavo|venustiano|benito|tlalpan|coyoacan|iztapalapa|miguel hidalgo|azcapotzalco|cdmx/.test(normalized);
}

export function estimateRouteDistanceKm(input: {
  origin?: string | null;
  destination?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
}) {
  const coordinateOrigin = Number.isFinite(input.originLat) && Number.isFinite(input.originLng) ? { lat: Number(input.originLat), lng: Number(input.originLng) } : null;
  const coordinateDestination = Number.isFinite(input.destinationLat) && Number.isFinite(input.destinationLng) ? { lat: Number(input.destinationLat), lng: Number(input.destinationLng) } : null;
  const originPoint = coordinateOrigin ?? findPoint(input.origin);
  const destinationPoint = coordinateDestination ?? findPoint(input.destination);

  if (originPoint && destinationPoint) {
    return Math.max(1, Math.round(haversineKm(originPoint, destinationPoint) * ROAD_FACTOR * 10) / 10);
  }

  const originCdmx = looksLikeCdmx(input.origin);
  const destinationCdmx = looksLikeCdmx(input.destination);
  if (originCdmx && destinationCdmx) return DEFAULT_CDMX_KM;
  if (!originCdmx && !destinationCdmx) return DEFAULT_EDOMEX_KM;
  return DEFAULT_INTERCITY_KM;
}