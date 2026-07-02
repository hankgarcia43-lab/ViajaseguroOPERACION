export interface RouteCorridor {
  id: string;
  name: string;
  municipalities: string;
  destinationHub: string;
  description: string;
  tagline: string;
  routeTypeLabel: string;
  order: number;
  keywords: string[];
  primaryTemplateKey: string;
  passengerHint: string;
  driverHint: string;
}

export interface CorridorTemplate {
  title: string;
  origin: string;
  destination: string;
  stopsText: string;
}

export const ROUTE_CORRIDORS: RouteCorridor[] = [
  {
    id: 'norte-indios-verdes',
    name: 'Corredor Norte -> Indios Verdes',
    municipalities: 'Tepexpan, Acolman, Ojo de Agua, San Cristobal, Ecatepec, Tecamac',
    destinationHub: 'Indios Verdes (CETRAM)',
    description:
      'Embudo principal del norte metropolitano para trabajadores con transbordo rapido hacia CDMX.',
    tagline: 'Ruta laboral frecuente',
    routeTypeLabel: 'Troncal metropolitana',
    order: 1,
    keywords: ['tepexpan', 'acolman', 'san cristobal', 'ecatepec', 'tecamac', 'ojo de agua', 'zumpango', 'indios verdes', 'mexibus l4', 'mexicable l2'],
    primaryTemplateKey: 'corredor-norte-indios-verdes',
    passengerHint: 'Elige esta troncal si quieres llegar a Indios Verdes y luego transbordar rapido a Metro, Metrobus o rutas hacia CDMX.',
    driverHint: 'Toma esta troncal si pasas por municipios del norte y puedes recoger usuarios en puntos visibles rumbo a Indios Verdes.'
  },
  {
    id: 'oriente-pantitlan',
    name: 'Corredor Oriente -> Pantitlan',
    municipalities: 'Nezahualcoyotl, Chimalhuacan, Chicoloapan, La Paz',
    destinationHub: 'Pantitlan (CETRAM)',
    description:
      'Megaconector del oriente para movilidad laboral con enlace estrategico a Metro y corredores de alta demanda.',
    tagline: 'Conector masivo de oriente',
    routeTypeLabel: 'Troncal intermunicipal',
    order: 2,
    keywords: ['neza', 'nezahualcoyotl', 'chimalhuacan', 'chicoloapan', 'la paz', 'pantitlan', 'linea a', 'mexibus l3'],
    primaryTemplateKey: 'corredor-oriente-pantitlan',
    passengerHint: 'Elige esta troncal si tu destino conecta con Pantitlan, Metro o viajes laborales del oriente hacia CDMX.',
    driverHint: 'Toma esta troncal si ya cruzas Neza, Chimalhuacan, Chicoloapan o La Paz rumbo a Pantitlan.'
  },
  {
    id: 'norponiente-cuatro-caminos',
    name: 'Corredor Norponiente -> Cuatro Caminos',
    municipalities: 'Naucalpan, Tlalnepantla, Huixquilucan',
    destinationHub: 'Cuatro Caminos / Toreo',
    description:
      'Puerta de entrada del norponiente con alta afluencia de transporte concesionado y destinos laborales.',
    tagline: 'Acceso operativo al norponiente',
    routeTypeLabel: 'Troncal urbana',
    order: 3,
    keywords: ['naucalpan', 'tlalnepantla', 'huixquilucan', 'cuatro caminos', 'toreo'],
    primaryTemplateKey: 'corredor-norponiente-cuatro-caminos',
    passengerHint: 'Elige esta troncal si buscas llegar al Toreo, Cuatro Caminos o enlaces laborales del norponiente.',
    driverHint: 'Toma esta troncal si tu recorrido cruza Naucalpan, Tlalnepantla o Huixquilucan hacia Toreo/Cuatro Caminos.'
  },
  {
    id: 'suburbano-buenavista',
    name: 'Corredor Suburbano -> Buenavista',
    municipalities: 'Cuautitlan, Tultitlan, Tlalnepantla, Cuautitlan Izcalli',
    destinationHub: 'Buenavista',
    description:
      'Corredor de enlace laboral con nodos de tren y transbordo de alta frecuencia hacia CDMX.',
    tagline: 'Flujo recurrente de trabajo',
    routeTypeLabel: 'Troncal suburbana',
    order: 4,
    keywords: ['cuautitlan', 'tultitlan', 'tlalnepantla', 'izcalli', 'buenavista', 'suburbano'],
    primaryTemplateKey: 'corredor-suburbano-buenavista',
    passengerHint: 'Elige esta troncal si conectas con Buenavista, Tren Suburbano o nodos de transbordo al centro.',
    driverHint: 'Toma esta troncal si tu viaje cruza Cuautitlan, Tultitlan, Tlalnepantla o Izcalli rumbo a Buenavista.'
  },
  {
    id: 'ecatepec-ciudad-azteca',
    name: 'Corredor Ecatepec -> Ciudad Azteca',
    municipalities: 'Ecatepec, Tecamac',
    destinationHub: 'Ciudad Azteca',
    description:
      'Corredor de alto flujo para conectar con Metro Linea B y facilitar traslados de entrada a CDMX.',
    tagline: 'Conexion directa de alto flujo',
    routeTypeLabel: 'Troncal de conexion',
    order: 5,
    keywords: ['ecatepec', 'tecamac', 'ciudad azteca', 'linea b', 'mexibus l1'],
    primaryTemplateKey: 'corredor-ecatepec-ciudad-azteca',
    passengerHint: 'Elige esta troncal si necesitas conectar con Ciudad Azteca, Metro Linea B o Mexibus.',
    driverHint: 'Toma esta troncal si operas entre Ecatepec/Tecamac y puedes dejar usuarios cerca de Ciudad Azteca.'
  },
  {
    id: 'nodos-laborales-cdmx',
    name: 'Corredor a nodos laborales CDMX',
    municipalities: 'Municipios clave del EdoMex',
    destinationHub: 'Centro, zonas hospitalarias y terminales',
    description:
      'Rutas orientadas a nodos metropolitanos de trabajo para operacion semanal clara y estable.',
    tagline: 'Destino laboral estrategico',
    routeTypeLabel: 'Corredor de nodos',
    order: 6,
    keywords: ['centro', 'hospital', 'terminal', 'indios verdes', 'pantitlan', 'buenavista', 'cdmx'],
    primaryTemplateKey: 'corredor-nodos-laborales-cdmx',
    passengerHint: 'Elige esta troncal si tu viaje termina en Centro, hospitales, terminales o zonas laborales de CDMX.',
    driverHint: 'Toma esta troncal si tu destino final es un nodo laboral de CDMX y quieres publicar abordajes recurrentes.'
  }
];

export const DEFAULT_ROUTE_CORRIDOR: RouteCorridor = {
  id: 'metropolitano-general',
  name: 'Corredor metropolitano general',
  municipalities: 'EdoMex - CDMX',
  destinationHub: 'Nodo metropolitano',
  description: 'Ruta operativa para movilidad de trabajo recurrente.',
  tagline: 'Ruta laboral frecuente',
  routeTypeLabel: 'Corredor base',
  order: 999,
  keywords: [],
  primaryTemplateKey: 'metropolitano-general',
  passengerHint: 'Usa esta ruta si no encuentras un corredor exacto para tu viaje.',
  driverHint: 'Crea o toma esta ruta cuando tu viaje no encaje en una troncal especifica.'
};

export const ROUTE_CORRIDOR_TEMPLATES: CorridorTemplate[] = [
  {
    title: 'Acolman / Teotihuacan / Otumba -> CDMX Norte',
    origin: 'Acolman / Teotihuacan / Otumba',
    destination: 'CDMX Norte',
    stopsText:
      'Paradas sugeridas: acceso principal en Acolman, punto central Teotihuacan, salida Otumba. Ruta laboral frecuente.'
  },
  {
    title: 'Tecamac / Ojo de Agua / Ecatepec -> Indios Verdes',
    origin: 'Tecamac / Ojo de Agua / Ecatepec',
    destination: 'Indios Verdes',
    stopsText:
      'Paradas sugeridas: Ojo de Agua centro, vialidades principales de Ecatepec y llegada a CETRAM Indios Verdes.'
  },
  {
    title: 'Nezahualcoyotl / Chimalhuacan / Chicoloapan / La Paz -> Pantitlan',
    origin: 'Nezahualcoyotl / Chimalhuacan / Chicoloapan / La Paz',
    destination: 'Pantitlan',
    stopsText:
      'Paradas sugeridas: puntos publicos visibles en corredor oriente y llegada ordenada a Pantitlan.'
  },
  {
    title: 'Naucalpan / Tlalnepantla / Huixquilucan -> Cuatro Caminos',
    origin: 'Naucalpan / Tlalnepantla / Huixquilucan',
    destination: 'Cuatro Caminos / Toreo',
    stopsText: 'Paradas sugeridas: zonas comerciales y avenidas principales con buena visibilidad y seguridad.'
  },
  {
    title: 'Cuautitlan / Tultitlan / Tlalnepantla -> Buenavista',
    origin: 'Cuautitlan / Tultitlan / Tlalnepantla',
    destination: 'Buenavista',
    stopsText:
      'Paradas sugeridas: nodos de transbordo y puntos iluminados para traslado laboral recurrente.'
  },
  {
    title: 'Ecatepec / Tecamac -> Ciudad Azteca',
    origin: 'Ecatepec / Tecamac',
    destination: 'Ciudad Azteca',
    stopsText:
      'Paradas sugeridas: vialidades de alto flujo en Ecatepec/Tecamac con llegada a nodo Ciudad Azteca.'
  }
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function inferRouteCorridor(route: { title?: string | null; origin: string; destination: string }): RouteCorridor {
  const haystack = normalize(`${route.title ?? ''} ${route.origin} ${route.destination}`);

  const match = ROUTE_CORRIDORS.find((corridor) =>
    corridor.keywords.some((keyword) => haystack.includes(normalize(keyword)))
  );

  return match ?? DEFAULT_ROUTE_CORRIDOR;
}
