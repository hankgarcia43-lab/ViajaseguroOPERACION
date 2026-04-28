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