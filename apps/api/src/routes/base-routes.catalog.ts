export type BaseRouteTemplate = {
  templateKey: string;
  title: string;
  origin: string;
  destination: string;
  stopsText: string;
  weekdays: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  departureTime: string;
  estimatedArrivalTime: string;
  availableSeats: number;
  distanceKm: number;
  recommendedPricePerSeat: number;
};

export const ROUTE_TEST_TARIFF_PER_KM = 3.33;

const WORKDAYS: BaseRouteTemplate['weekdays'] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const WORKDAYS_PLUS_SAT: BaseRouteTemplate['weekdays'] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function fareByKm(distanceKm: number) {
  return Math.round(distanceKm * ROUTE_TEST_TARIFF_PER_KM * 100) / 100;
}

function template(
  templateKey: string,
  title: string,
  origin: string,
  destination: string,
  distanceKm: number,
  departureTime: string,
  estimatedArrivalTime: string,
  weekdays: BaseRouteTemplate['weekdays'] = WORKDAYS_PLUS_SAT,
  stopsText = 'Ruta laboral frecuente. Define abordaje visible y en zona publica para operacion segura.'
): BaseRouteTemplate {
  return {
    templateKey,
    title,
    origin,
    destination,
    stopsText,
    weekdays,
    departureTime,
    estimatedArrivalTime,
    availableSeats: 4,
    distanceKm,
    recommendedPricePerSeat: fareByKm(distanceKm)
  };
}

export const BASE_ROUTE_TEMPLATES: BaseRouteTemplate[] = [
  template(
    'corredor-norte-indios-verdes',
    'Corredor Norte -> Indios Verdes',
    'Tepexpan / Acolman / Ojo de Agua / San Cristobal / Ecatepec / Tecamac',
    'Indios Verdes (CETRAM)',
    32,
    '06:00',
    '07:10',
    WORKDAYS_PLUS_SAT,
    'Corredor troncal metropolitano. Municipios sugeridos: Tepexpan, Acolman, Ojo de Agua, San Cristobal, Ecatepec y Tecamac. Destino fuerte: Indios Verdes CETRAM. Chofer: publica el punto exacto donde pasas y confirma abordaje en zona publica, visible e iluminada.'
  ),
  template(
    'corredor-oriente-pantitlan',
    'Corredor Oriente -> Pantitlan',
    'Nezahualcoyotl / Chimalhuacan / Chicoloapan / La Paz',
    'Pantitlan (CETRAM)',
    20,
    '06:00',
    '06:55',
    WORKDAYS_PLUS_SAT,
    'Corredor troncal intermunicipal. Municipios sugeridos: Nezahualcoyotl, Chimalhuacan, Chicoloapan y La Paz. Destino fuerte: Pantitlan CETRAM. Pensado para movilidad laboral con enlace a Metro y corredores de alta demanda.'
  ),
  template(
    'corredor-norponiente-cuatro-caminos',
    'Corredor Norponiente -> Cuatro Caminos',
    'Naucalpan / Tlalnepantla / Huixquilucan',
    'Cuatro Caminos / Toreo',
    14,
    '06:15',
    '07:00',
    WORKDAYS_PLUS_SAT,
    'Corredor troncal urbana. Municipios sugeridos: Naucalpan, Tlalnepantla y Huixquilucan. Destino fuerte: Cuatro Caminos / Toreo. Ideal para publicar viajes con puntos de encuentro en avenidas principales o zonas comerciales visibles.'
  ),
  template(
    'corredor-suburbano-buenavista',
    'Corredor Suburbano -> Buenavista',
    'Cuautitlan / Tultitlan / Tlalnepantla / Cuautitlan Izcalli',
    'Buenavista',
    34,
    '05:55',
    '07:20',
    WORKDAYS_PLUS_SAT,
    'Corredor troncal suburbana. Municipios sugeridos: Cuautitlan, Tultitlan, Tlalnepantla y Cuautitlan Izcalli. Destino fuerte: Buenavista. Enlace laboral con nodos de tren y transbordo hacia CDMX.'
  ),
  template(
    'corredor-ecatepec-ciudad-azteca',
    'Corredor Ecatepec -> Ciudad Azteca',
    'Ecatepec / Tecamac',
    'Ciudad Azteca',
    18,
    '06:10',
    '06:50',
    WORKDAYS_PLUS_SAT,
    'Corredor troncal de conexion. Municipios sugeridos: Ecatepec y Tecamac. Destino fuerte: Ciudad Azteca. Conecta con Metro Linea B y facilita traslados de entrada a CDMX.'
  ),
  template(
    'corredor-nodos-laborales-cdmx',
    'Corredor a nodos laborales CDMX',
    'Municipios clave del EdoMex',
    'Centro, zonas hospitalarias y terminales CDMX',
    28,
    '06:00',
    '07:15',
    WORKDAYS,
    'Corredor de nodos laborales. Origen flexible desde municipios clave del EdoMex hacia Centro, zonas hospitalarias y terminales. Chofer: usa esta ruta cuando tu destino final sea un nodo laboral y publica el punto exacto de abordaje.'
  ),
  template(
    'ruta-prioritaria-tepexpan-indios-verdes',
    'Tepexpan centro -> Indios Verdes CETRAM',
    'Tepexpan - Centro / Plaza principal',
    'Gustavo A. Madero - Indios Verdes (CETRAM)',
    34,
    '05:45',
    '07:00',
    WORKDAYS_PLUS_SAT,
    'Abordaje sugerido: Plaza principal de Tepexpan, Oxxo del centro o acceso sobre Carretera Mexico-Tepexpan. Referencia para chofer: confirmar punto publico, iluminado y con espacio para detenerse. Llegada: CETRAM Indios Verdes, zona Metro/Metrobus.'
  ),
  template(
    'ruta-prioritaria-ojo-agua-indios-verdes',
    'Ojo de Agua -> Indios Verdes CETRAM',
    'Ojo de Agua - Centro / Plaza Ojo de Agua',
    'Gustavo A. Madero - Indios Verdes (CETRAM)',
    28,
    '06:00',
    '07:05',
    WORKDAYS_PLUS_SAT,
    'Abordaje sugerido: Plaza Ojo de Agua, Boulevard Ojo de Agua o Real del Sol. Referencia para chofer: elegir punto visible y facil de ubicar por pasajeros. Llegada: CETRAM Indios Verdes, acceso Metro/Metrobus.'
  ),
  template(
    'ruta-prioritaria-san-cristobal-indios-verdes',
    'San Cristobal Ecatepec -> Indios Verdes CETRAM',
    'San Cristobal Ecatepec - Centro / Catedral',
    'Gustavo A. Madero - Indios Verdes (CETRAM)',
    18,
    '06:15',
    '06:55',
    WORKDAYS_PLUS_SAT,
    'Abordaje sugerido: Catedral de San Cristobal, Palacio Municipal o punto visible del centro. Referencia para chofer: evitar calles cerradas y definir direccion exacta. Llegada: CETRAM Indios Verdes, zona de ascenso/descenso segura.'
  ),
  template(
    'ruta-prioritaria-acolman-indios-verdes',
    'Acolman centro -> Indios Verdes CETRAM',
    'Acolman - Centro / Palacio Municipal',
    'Gustavo A. Madero - Indios Verdes (CETRAM)',
    32,
    '05:50',
    '07:00',
    WORKDAYS_PLUS_SAT,
    'Abordaje sugerido: Palacio Municipal de Acolman, acceso a carretera o punto central seguro. Referencia para chofer: confirmar punto con espacio para abordar sin bloquear vialidad. Llegada: Indios Verdes CETRAM.'
  ),
  template(
    'ruta-prioritaria-tecamac-indios-verdes',
    'Tecamac centro -> Indios Verdes CETRAM',
    'Tecamac - Centro / Palacio Municipal',
    'Gustavo A. Madero - Indios Verdes (CETRAM)',
    31,
    '06:00',
    '07:10',
    WORKDAYS_PLUS_SAT,
    'Abordaje sugerido: Palacio Municipal de Tecamac, Los Heroes Tecamac o avenida principal acordada. Referencia para chofer: publicar direccion exacta y punto visible. Llegada: Indios Verdes CETRAM.'
  ),
  template(
    'ruta-prioritaria-ecatepec-americas-indios-verdes',
    'Ecatepec Las Americas -> Indios Verdes CETRAM',
    'Ecatepec - Las Americas / Plaza comercial',
    'Gustavo A. Madero - Indios Verdes (CETRAM)',
    22,
    '06:10',
    '07:00',
    WORKDAYS_PLUS_SAT,
    'Abordaje sugerido: Plaza Las Americas, avenida central o punto publico de alto flujo. Referencia para chofer: usar punto seguro y facil de reconocer. Llegada: Indios Verdes CETRAM.'
  ),

  template('corredor-norte-ecatepec-indios-verdes', 'Corredor Norte: Ecatepec -> Indios Verdes', 'Ecatepec de Morelos', 'Indios Verdes', 23, '06:20', '07:10'),
  template('corredor-norte-acolman-indios-verdes', 'Corredor Norte: Acolman -> Indios Verdes', 'Acolman', 'Indios Verdes', 31.3, '05:55', '07:00'),
  template('corredor-norte-teotihuacan-indios-verdes', 'Corredor Norte: Teotihuacan -> Indios Verdes', 'Teotihuacan', 'Indios Verdes', 40, '05:40', '07:10', WORKDAYS),
  template('corredor-norte-otumba-indios-verdes', 'Corredor Norte: Otumba -> Indios Verdes', 'Otumba', 'Indios Verdes', 51, '05:20', '07:20', WORKDAYS),
  template('corredor-norte-tecamac-indios-verdes', 'Corredor Norte: Tecamac -> Indios Verdes', 'Tecamac', 'Indios Verdes', 31, '06:00', '07:10'),
  template('corredor-norte-zumpango-indios-verdes', 'Corredor Norte: Zumpango -> Indios Verdes', 'Zumpango', 'Indios Verdes', 47, '05:15', '07:15', WORKDAYS),
  template('corredor-norte-coacalco-indios-verdes', 'Corredor Norte: Coacalco -> Indios Verdes', 'Coacalco de Berriozabal', 'Indios Verdes', 23.7, '06:10', '07:00'),
  template('corredor-norte-tlalnepantla-indios-verdes', 'Corredor Norte: Tlalnepantla -> Indios Verdes', 'Tlalnepantla de Baz', 'Indios Verdes', 16, '06:25', '07:00'),

  template('corredor-suburbano-tultitlan-buenavista', 'Corredor Suburbano: Tultitlan -> Buenavista', 'Tultitlan', 'Buenavista', 30, '06:05', '07:20'),
  template('corredor-suburbano-cuautitlan-buenavista', 'Corredor Suburbano: Cuautitlan -> Buenavista', 'Cuautitlan', 'Buenavista', 39, '05:55', '07:20'),
  template('corredor-norponiente-izcalli-cuatro-caminos', 'Corredor Norponiente: Cuautitlan Izcalli -> Cuatro Caminos', 'Cuautitlan Izcalli', 'Cuatro Caminos', 27, '06:10', '07:20'),
  template('corredor-norponiente-naucalpan-cuatro-caminos', 'Corredor Norponiente: Naucalpan -> Cuatro Caminos', 'Naucalpan de Juarez', 'Cuatro Caminos', 5, '06:30', '06:50'),
  template('corredor-norponiente-atizapan-cuatro-caminos', 'Corredor Norponiente: Atizapan -> Cuatro Caminos', 'Atizapan de Zaragoza', 'Cuatro Caminos', 18, '06:20', '07:10'),

  template('corredor-oriente-neza-pantitlan', 'Corredor Oriente: Nezahualcoyotl -> Pantitlan', 'Nezahualcoyotl', 'Pantitlan', 14, '06:15', '06:55'),
  template('corredor-oriente-chimalhuacan-pantitlan', 'Corredor Oriente: Chimalhuacan -> Pantitlan', 'Chimalhuacan', 'Pantitlan', 14.7, '06:00', '06:50'),
  template('corredor-oriente-chicoloapan-pantitlan', 'Corredor Oriente: Chicoloapan -> Pantitlan', 'Chicoloapan', 'Pantitlan', 24, '05:45', '06:50'),
  template('corredor-oriente-ixtapaluca-pantitlan', 'Corredor Oriente: Ixtapaluca -> Pantitlan', 'Ixtapaluca', 'Pantitlan', 32, '05:35', '06:55', WORKDAYS),
  template('corredor-oriente-la-paz-pantitlan', 'Corredor Oriente: La Paz -> Pantitlan', 'La Paz', 'Pantitlan', 14, '06:20', '06:55'),

  template('corredor-oriente-texcoco-san-lazaro', 'Corredor Oriente: Texcoco -> San Lazaro', 'Texcoco', 'San Lazaro', 31, '05:50', '07:10', WORKDAYS),
  template('corredor-poniente-toluca-observatorio', 'Corredor Poniente: Toluca -> Observatorio', 'Toluca', 'Observatorio', 58, '05:10', '06:50', WORKDAYS)
];