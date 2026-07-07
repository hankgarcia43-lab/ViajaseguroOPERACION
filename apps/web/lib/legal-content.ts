export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export const LEGAL_UPDATED_AT = '7 de julio de 2026';

export const INITIAL_NOTICE: LegalSection[] = [
  {
    title: 'Aviso inicial de confidencialidad, privacidad y seguridad',
    paragraphs: [
      'Bienvenido a VIAJASEGURO.',
      'VIAJASEGURO es una comunidad digital de movilidad compartida que facilita el contacto y coordinacion entre usuarios y conductores verificados con rutas compatibles. VIAJASEGURO no presta servicios de transporte, no opera como taxi, no cobra traslados, no fija tarifas obligatorias y no administra pagos entre usuarios y conductores.',
      'Al ingresar, registrarte o utilizar esta plataforma, aceptas que la informacion, rutas, perfiles, documentos, referencias de abordaje, datos de contacto, ubicaciones, placas, vehiculos, conversaciones, solicitudes y cualquier informacion mostrada dentro de VIAJASEGURO tiene caracter confidencial y de uso exclusivo para la coordinacion segura dentro de la comunidad.',
      'Queda prohibido copiar, divulgar, publicar, vender, distribuir, capturar, compartir en redes sociales, reenviar a terceros o utilizar fuera de VIAJASEGURO cualquier informacion de usuarios, conductores, vehiculos, rutas, documentos, ubicaciones, precios sugeridos, referencias de abordaje o funcionamiento interno de la plataforma.',
      'Cada usuario y conductor es responsable del uso que haga de la informacion recibida. El mal uso de datos, rutas, fotografias, documentos, telefonos, ubicaciones o informacion de otros miembros podra causar suspension inmediata, cancelacion de cuenta y, en su caso, reporte ante las autoridades competentes.',
      'VIAJASEGURO podra conservar y proporcionar informacion registrada dentro de la plataforma cuando sea necesario para atender incidentes, reportes de seguridad, reclamaciones, investigaciones, solicitudes de autoridad competente o cumplimiento de obligaciones legales.',
      'Antes de abordar cualquier ruta, verifica que el conductor, vehiculo y placas coincidan con la informacion mostrada en la plataforma. No abordes si algun dato no coincide.',
      'El monto mostrado en una ruta, si aparece, es unicamente una aportacion sugerida en efectivo acordada directamente entre usuario y conductor. VIAJASEGURO no cobra, procesa, garantiza ni administra pagos por traslados.',
      'Al continuar, declaras que has leido y aceptas este Aviso Inicial, los Terminos y Condiciones, las Reglas de Seguridad y el Aviso de Privacidad de VIAJASEGURO.'
    ]
  }
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Introduccion y aceptacion',
    paragraphs: [
      'Estos Terminos y Condiciones regulan el acceso y uso de la plataforma digital denominada VIAJASEGURO, incluyendo su sitio web, aplicacion, paneles, formularios, perfiles, rutas, solicitudes, herramientas de coordinacion, planes, verificaciones y cualquier servicio digital relacionado.',
      'Al registrarte, navegar, crear una cuenta, publicar una ruta, solicitar unirte a una ruta, activar un plan, subir documentos o utilizar cualquier funcion de VIAJASEGURO, aceptas expresamente estos Terminos y Condiciones.',
      'Si no estas de acuerdo con estos terminos, no deberas utilizar VIAJASEGURO.'
    ]
  },
  {
    title: '1. Identidad del responsable',
    paragraphs: [
      'VIAJASEGURO es un nombre comercial operado por el titular que administre la plataforma. Los datos legales completos del responsable, RFC, correo y domicilio de contacto deberan mantenerse actualizados dentro de la documentacion interna o medios oficiales de contacto de VIAJASEGURO.',
      'En caso de que VIAJASEGURO sea posteriormente operado por una persona moral, sociedad, filial, cesionario, licenciatario o nuevo titular, el usuario acepta que la operacion, administracion y derechos de la plataforma podran ser transferidos, siempre que se respeten los derechos aplicables de los usuarios y la legislacion vigente.'
    ]
  },
  {
    title: '2. Naturaleza de VIAJASEGURO',
    paragraphs: [
      'VIAJASEGURO es una comunidad digital de movilidad compartida. Su finalidad es facilitar el contacto, publicacion, busqueda y coordinacion entre personas que tienen rutas compatibles, particularmente trayectos recurrentes hacia zonas de trabajo, escuela, actividades personales o puntos concurridos.',
      'VIAJASEGURO no es una empresa de transporte, no presta directamente servicios de traslado, no opera unidades, no emplea conductores para prestar transporte, no garantiza viajes, no vende boletos, no cobra traslados, no administra pagos entre usuarios y conductores, no fija tarifas obligatorias y no se ostenta como taxi, aplicacion de transporte privado con chofer ni transporte publico.',
      'El uso de VIAJASEGURO no crea por si mismo una relacion de transporte, mandato, agencia, sociedad, asociacion, relacion laboral, intermediacion financiera, relacion de consumo de transporte ni relacion contractual de traslado entre VIAJASEGURO y los usuarios.'
    ]
  },
  {
    title: '3. Definiciones',
    items: [
      'VIAJASEGURO: plataforma digital, comunidad, sitio web, aplicacion, marca, sistema y servicios digitales de coordinacion.',
      'Usuario o miembro: persona registrada que busca, publica o solicita rutas compartidas.',
      'Conductor verificado: persona que registra un perfil de conductor, proporciona documentacion para revision y publica o responde rutas dentro de la comunidad.',
      'Ruta compartida: trayecto publicado o solicitado dentro de VIAJASEGURO para fines de coordinacion entre miembros.',
      'Ruta solicitada: necesidad de ruta publicada por un usuario.',
      'Solicitud para unirse: peticion enviada por un usuario para integrarse o coordinarse respecto de una ruta.',
      'Aportacion sugerida: referencia economica orientativa que puede acordarse directamente entre usuario y conductor, normalmente relacionada con gasolina, casetas, mantenimiento u otros gastos del trayecto.',
      'Plan o suscripcion: pago realizado a VIAJASEGURO por acceso a funciones digitales de la comunidad, no por transporte.'
    ]
  },
  {
    title: '4. Aceptacion de los terminos',
    paragraphs: [
      'El usuario declara que tiene capacidad legal para aceptar estos Terminos y Condiciones. Para utilizar VIAJASEGURO, el usuario debe ser mayor de edad o contar con autorizacion suficiente conforme a la legislacion aplicable.',
      'VIAJASEGURO podra restringir, suspender o cancelar cuentas cuando detecte uso indebido, informacion falsa, riesgo de seguridad, incumplimiento de estos terminos o actividad sospechosa.',
      'El usuario acepta que el uso de la plataforma implica aceptacion de estos terminos, del Aviso de Privacidad, reglas de seguridad, politicas de plan, politicas de verificacion, politicas de comunidad y cualquier actualizacion publicada por VIAJASEGURO.'
    ]
  },
  {
    title: '5. Servicios digitales de VIAJASEGURO',
    paragraphs: ['VIAJASEGURO puede ofrecer, modificar, suspender, limitar, mejorar o retirar funciones en cualquier momento por razones operativas, legales, comerciales, tecnicas o de seguridad.'],
    items: [
      'Registro de usuarios y conductores.',
      'Revision documental de conductores y vehiculos.',
      'Publicacion de rutas compartidas y necesidades de ruta.',
      'Solicitudes para unirse a rutas y respuestas de conductores.',
      'Herramientas de coordinacion, referencias de abordaje e informacion basica de seguridad.',
      'Reporte de incidentes, notificaciones internas y panel de administracion.',
      'Planes digitales, verificaciones, rutas destacadas o funciones de piloto cerrado.'
    ]
  },
  {
    title: '6. VIAJASEGURO no presta servicio de transporte',
    paragraphs: [
      'El usuario reconoce y acepta que VIAJASEGURO no presta servicios de transporte, no conduce vehiculos, no opera flotillas, no tiene control fisico sobre unidades, no garantiza disponibilidad de rutas, no garantiza llegada, no garantiza tiempos, no garantiza cupos y no garantiza que una ruta se realice.',
      'Los conductores actuan por cuenta propia. La publicacion de una ruta no convierte a VIAJASEGURO en transportista, concesionario, permisionario, patron, aseguradora, aval, fiador, agente de transito, autoridad, intermediario de pago del traslado ni responsable directo del trayecto.',
      'Cualquier traslado, abordaje, aportacion economica, punto de encuentro, horario, tolerancia, cambio de ruta o acuerdo operativo relacionado con el trayecto se realiza directamente entre usuario y conductor bajo su propia responsabilidad.'
    ]
  },
  {
    title: '7. Pagos entre usuario y conductor',
    paragraphs: [
      'VIAJASEGURO no cobra traslados, no recibe dinero por viajes, no retiene dinero del conductor, no realiza liquidaciones a conductores, no administra pagos en efectivo, no procesa pagos del trayecto, no garantiza pagos entre usuarios y conductores y no participa en acuerdos economicos directos entre ellos.',
      'Cualquier aportacion economica por gasolina, casetas, mantenimiento, cooperacion o gastos del trayecto debera acordarse directamente entre usuario y conductor, en efectivo o por el medio que ambas partes decidan, sin intervencion de VIAJASEGURO.',
      'El monto mostrado en la plataforma, si existe, es unicamente una aportacion sugerida o referencia orientativa. No constituye tarifa obligatoria, precio de transporte, boleto, cargo de plataforma ni contraprestacion cobrada por VIAJASEGURO.',
      'VIAJASEGURO no sera responsable por desacuerdos, falta de pago, pago incompleto, pago excesivo, cambio de monto, cobros indebidos, cancelaciones, reclamaciones o conflictos economicos entre usuarios y conductores.'
    ]
  },
  {
    title: '8. Planes, suscripciones y pagos a VIAJASEGURO',
    paragraphs: [
      'Los pagos realizados a VIAJASEGURO corresponden unicamente a servicios digitales de la plataforma, tales como planes semanales, verificacion de conductor, publicacion de rutas, rutas destacadas, acceso premium, herramientas de coordinacion o funcionalidades de comunidad.',
      'Ningun pago realizado a VIAJASEGURO representa el pago de un traslado, transporte, boleto, asiento, servicio de chofer o ruta especifica.',
      'VIAJASEGURO podra ofrecer periodos de prueba gratuitos, promociones, descuentos, planes semanales, planes para usuarios, planes para conductores o funciones premium.',
      'Al finalizar un periodo de prueba, el usuario podra perder acceso a funciones premium hasta activar un plan vigente.',
      'VIAJASEGURO podra modificar precios, planes, duracion de pruebas, beneficios y condiciones comerciales, informandolo dentro de la plataforma o por medios electronicos.',
      'Salvo que se indique expresamente lo contrario, los pagos por plan, verificacion, publicacion o servicios digitales son independientes de que el usuario encuentre o no una ruta, de que un conductor acepte o no una solicitud, o de que una ruta se realice o no.'
    ]
  },
  {
    title: '9. Cuentas de usuario',
    paragraphs: [
      'El usuario se obliga a proporcionar informacion veraz, actualizada, completa y propia.',
      'Queda prohibido crear cuentas falsas, suplantar identidad, utilizar datos de terceros sin autorizacion, crear multiples cuentas para evadir restricciones, vender cuentas, compartir accesos o utilizar la plataforma con fines ilegales, enganosos, comerciales no autorizados o contrarios a la seguridad de la comunidad.',
      'El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de toda actividad realizada desde su cuenta.',
      'VIAJASEGURO podra suspender, bloquear o cancelar cuentas cuando detecte incumplimiento, informacion falsa, reportes graves, riesgo para la comunidad, fraude, uso indebido o requerimiento de autoridad competente.'
    ]
  },
  {
    title: '10. Obligaciones de los usuarios',
    items: [
      'Utilizar VIAJASEGURO de buena fe y proporcionar informacion real.',
      'Respetar a conductores, usuarios, administradores y terceros.',
      'Verificar conductor, vehiculo y placas antes de abordar.',
      'No abordar si los datos no coinciden.',
      'No compartir informacion de otros miembros fuera de la plataforma.',
      'No acosar, amenazar, discriminar, insultar o agredir.',
      'No realizar actividades ilegales ni usar la plataforma para delitos, fraude, robo, extorsion, acoso o actividades no autorizadas.',
      'Reportar incidentes de forma honesta y cumplir las reglas de seguridad.',
      'Asumir responsabilidad por sus acuerdos directos con conductores.'
    ]
  },
  {
    title: '11. Obligaciones de los conductores',
    items: [
      'Proporcionar informacion real y actualizada.',
      'Contar con licencia de conducir, documentacion del vehiculo y seguro vigente.',
      'Mantener el vehiculo en condiciones adecuadas de circulacion.',
      'Publicar unicamente rutas reales o compatibles con trayectos que pueda realizar.',
      'No presentarse con vehiculo distinto al registrado sin actualizar informacion.',
      'No permitir que otra persona conduzca usando su perfil.',
      'No cobrar a nombre de VIAJASEGURO ni afirmar que trabaja para VIAJASEGURO como empleado, chofer o representante legal.',
      'No usar la plataforma para transporte ilegal, actividades delictivas o servicios no autorizados.',
      'Respetar puntos, horarios y referencias de abordaje cuando acepte una ruta.',
      'Informar cambios, cancelaciones o riesgos de seguridad y tratar con respeto a los usuarios.',
      'Cumplir leyes, reglamentos de transito, obligaciones de seguro y normativa aplicable.'
    ],
    paragraphs: ['La verificacion de un conductor no constituye garantia absoluta de seguridad, solvencia, conducta futura, cumplimiento legal, cobertura de seguro, calidad de manejo ni ausencia de riesgo.']
  },
  {
    title: '12. Documentacion y verificacion',
    paragraphs: [
      'VIAJASEGURO podra solicitar documentos a conductores y usuarios, tales como identificacion, licencia, tarjeta de circulacion, seguro, placas, fotografias del vehiculo, comprobantes, constancias o cualquier documento necesario para evaluacion interna de seguridad.',
      'VIAJASEGURO podra aceptar, rechazar, suspender, volver a revisar o solicitar actualizacion de documentos.',
      'La revision documental es una medida interna de seguridad comunitaria. No equivale a certificacion oficial, autorizacion gubernamental, permiso de transporte, dictamen legal, garantia de cobertura de seguro ni validacion absoluta de identidad o antecedentes.',
      'El conductor es responsable de que sus documentos sean reales, vigentes y suficientes para la actividad que realiza por cuenta propia.',
      'VIAJASEGURO podra conservar registros de verificacion, fechas de vencimiento, estatus de revision, observaciones y evidencias necesarias para seguridad, cumplimiento, incidentes o requerimientos legales.'
    ]
  },
  {
    title: '13. Confidencialidad',
    paragraphs: [
      'Toda informacion obtenida dentro de VIAJASEGURO se considera confidencial y de uso exclusivo para la coordinacion segura dentro de la comunidad.',
      'Queda prohibido copiar, capturar, publicar, vender, divulgar, compartir, transferir, extraer, descargar masivamente o utilizar fuera de la plataforma datos de usuarios, conductores, rutas, documentos, vehiculos, placas, telefonos, ubicaciones, referencias de abordaje, solicitudes, precios sugeridos, conversaciones, reportes o funcionamiento interno de VIAJASEGURO.',
      'La obligacion de confidencialidad subsiste incluso despues de cancelar la cuenta.',
      'El incumplimiento de esta obligacion podra causar suspension inmediata, cancelacion definitiva, reclamacion de danos y perjuicios, denuncia o reporte ante autoridad competente cuando proceda.'
    ]
  },
  {
    title: '14. Privacidad y datos personales',
    paragraphs: [
      'VIAJASEGURO tratara los datos personales conforme a su Aviso de Privacidad.',
      'Al utilizar la plataforma, el usuario reconoce que VIAJASEGURO podra recabar datos necesarios para registro, verificacion, seguridad, operacion de rutas, contacto, planes, soporte, reportes, cumplimiento legal e investigacion de incidentes.',
      'Los usuarios y conductores se obligan a no usar datos personales de otros miembros para fines distintos a la coordinacion autorizada dentro de la plataforma.',
      'VIAJASEGURO podra compartir informacion con autoridades competentes, asesores legales, proveedores tecnologicos, procesadores de pago, servicios de seguridad, aseguradoras o partes involucradas cuando sea necesario para atender incidentes, reportes, obligaciones legales, procedimientos, reclamaciones o proteccion de derechos.'
    ]
  },
  {
    title: '15. Rutas, solicitudes y coordinacion',
    paragraphs: [
      'Las rutas publicadas pueden ser creadas por conductores o solicitadas por usuarios. La aceptacion de una ruta, solicitud o propuesta no garantiza que el trayecto se realice.',
      'Los miembros deberan coordinarse directamente, confirmar detalles, verificar identidad, revisar referencias y actuar con precaucion.',
      'VIAJASEGURO podra moderar, ocultar, rechazar, pausar o eliminar rutas cuando considere que existe informacion falsa, riesgo, incumplimiento, reporte, sospecha de uso indebido o necesidad operativa.',
      'Los usuarios y conductores reconocen que pueden existir cambios de horario, trafico, cancelaciones, retrasos, falta de disponibilidad, errores de ubicacion, problemas de comunicacion o circunstancias ajenas a VIAJASEGURO.'
    ]
  },
  {
    title: '16. Seguridad y reglas de abordaje',
    paragraphs: ['Antes de abordar, el usuario debera verificar que el nombre del conductor, vehiculo, placas, punto de abordaje, horario e informacion dentro de la plataforma coincidan con la persona presente. Si cualquier dato no coincide, el usuario no debera abordar y debera reportarlo a VIAJASEGURO.'],
    items: [
      'Verifica conductor, vehiculo y placas antes de abordar.',
      'Usa puntos publicos, visibles y razonables.',
      'No compartas codigos, datos de otros miembros ni referencias fuera de la plataforma.',
      'Reporta cualquier dato que no coincida o situacion sospechosa.',
      'En emergencia real, contacta directamente a las autoridades competentes.'
    ]
  },
  {
    title: '17. Incidentes, reportes y cooperacion',
    paragraphs: [
      'En caso de incidente, accidente, conflicto, conducta indebida, amenaza, acoso, robo, choque, dano, incumplimiento, cobro abusivo, suplantacion, vehiculo distinto o cualquier situacion de riesgo, el usuario debera reportarlo de inmediato a VIAJASEGURO y, cuando corresponda, a las autoridades competentes.',
      'VIAJASEGURO podra revisar informacion registrada dentro de la plataforma, suspender cuentas, pausar rutas, solicitar evidencia, contactar a las partes involucradas y proporcionar informacion disponible a autoridades competentes, aseguradoras, asesores legales o partes afectadas cuando sea legalmente procedente.',
      'VIAJASEGURO no sustituye a servicios de emergencia, policia, aseguradoras, autoridades de transito, hospitales, Ministerio Publico ni autoridades administrativas.'
    ]
  },
  {
    title: '18. Limitacion de responsabilidad',
    paragraphs: [
      'En la maxima medida permitida por la legislacion aplicable, VIAJASEGURO no sera responsable por accidentes de transito, lesiones, danos materiales o morales derivados de trayectos, robos, perdidas, conducta de usuarios o conductores, incumplimiento de acuerdos directos, pagos en efectivo, cancelaciones, retrasos, informacion falsa, falta de cobertura de aseguradoras, infracciones, fallas mecanicas, decisiones de abordar o no abordar, uso indebido de datos por otros miembros, hechos de terceros, caso fortuito, fuerza mayor o fallas temporales de internet, hosting, proveedores externos o servicios tecnologicos.',
      'VIAJASEGURO unicamente facilita herramientas digitales de contacto, publicacion, coordinacion, verificacion comunitaria y seguridad informativa.',
      'Ninguna disposicion de estos terminos pretende excluir responsabilidades que por ley no puedan limitarse, especialmente en casos de dolo, mala fe, culpa grave, violaciones directas a derechos irrenunciables o incumplimientos legales imputables directamente a VIAJASEGURO.'
    ]
  },
  {
    title: '19. Indemnidad',
    paragraphs: ['El usuario y el conductor aceptan sacar en paz y a salvo a VIAJASEGURO, sus titulares, administradores, colaboradores, proveedores, aliados, representantes y personal de cualquier reclamacion, denuncia, queja, procedimiento, dano, gasto, multa, sancion o responsabilidad derivada del uso indebido de la plataforma, informacion falsa, incumplimiento de estos terminos, incumplimiento legal, acuerdos directos, trayectos fuera de la plataforma, pagos en efectivo, danos causados a terceros, incidentes derivados de conducta propia o uso no autorizado de datos personales de otros miembros.']
  },
  {
    title: '20. Suspension y cancelacion de cuentas',
    paragraphs: ['VIAJASEGURO podra suspender, limitar o cancelar cuentas sin previo aviso cuando detecte riesgo para la comunidad, documentos falsos o vencidos, suplantacion de identidad, uso indebido de informacion, reportes graves, conducta violenta, amenazante, discriminatoria o ilegal, intento de fraude, cobros a nombre de VIAJASEGURO, compartir datos confidenciales, incumplimiento de reglas de seguridad, solicitud de autoridad competente o cualquier conducta contraria a estos terminos.', 'La suspension o cancelacion no genera automaticamente derecho a reembolso, salvo que la legislacion aplicable indique lo contrario o VIAJASEGURO lo determine expresamente.']
  },
  {
    title: '21. Prohibiciones',
    items: [
      'Usar VIAJASEGURO para cometer delitos.',
      'Utilizar datos de otros miembros fuera de la finalidad autorizada.',
      'Compartir capturas de perfiles, placas, rutas o ubicaciones.',
      'Cobrar en nombre de VIAJASEGURO o prometer transporte garantizado.',
      'Hacerse pasar por empleado o representante de VIAJASEGURO.',
      'Crear cuentas falsas, alterar documentos o usar vehiculos no registrados.',
      'Permitir que otra persona use el perfil de conductor.',
      'Acosar, amenazar, discriminar o transportar sustancias, armas, objetos prohibidos o mercancias ilicitas.',
      'Usar bots, scraping, extraccion masiva de datos, ingenieria inversa o intentar acceder sin autorizacion a sistemas de VIAJASEGURO.'
    ]
  },
  {
    title: '22. Propiedad intelectual',
    paragraphs: [
      'La marca, nombre comercial, diseno, textos, estructura, logotipos, software, base de datos, flujos, interfaz, funcionalidades, contenidos, documentos internos y elementos de VIAJASEGURO pertenecen a su titular o se usan bajo autorizacion.',
      'El uso de la plataforma no otorga derechos de propiedad intelectual sobre VIAJASEGURO. Queda prohibido copiar, imitar, reproducir, modificar, distribuir, vender, explotar, registrar, descompilar o utilizar elementos de VIAJASEGURO sin autorizacion previa y por escrito.'
    ]
  },
  {
    title: '23. Disponibilidad de la plataforma',
    paragraphs: ['VIAJASEGURO buscara mantener la plataforma disponible, pero no garantiza operacion ininterrumpida, libre de errores, libre de ataques, libre de caidas, libre de mantenimiento o compatible con todos los dispositivos. VIAJASEGURO podra realizar mantenimiento, mejoras, suspensiones, actualizaciones o cambios tecnicos sin responsabilidad por interrupciones razonables del servicio.']
  },
  {
    title: '24. Modificaciones a los terminos',
    paragraphs: ['VIAJASEGURO podra modificar estos Terminos y Condiciones en cualquier momento. Las modificaciones seran publicadas dentro de la plataforma o notificadas por medios electronicos. El uso continuado de VIAJASEGURO despues de la publicacion de cambios implica aceptacion de la version actualizada.']
  },
  {
    title: '25. Legislacion y jurisdiccion',
    paragraphs: ['Estos Terminos y Condiciones se regiran por las leyes aplicables de los Estados Unidos Mexicanos. Para la interpretacion y cumplimiento de estos terminos, las partes se someten a las autoridades y tribunales competentes que correspondan conforme a la legislacion aplicable, salvo que exista una competencia distinta o irrenunciable.']
  },
  {
    title: '26. Contacto',
    paragraphs: ['Para soporte, reportes, aclaraciones, privacidad, seguridad o asuntos relacionados con estos terminos, VIAJASEGURO podra ser contactado por los medios de soporte publicados dentro de la plataforma o los canales oficiales que el titular mantenga vigentes.']
  },
  {
    title: '27. Aceptacion final',
    items: [
      'El usuario declara que leyo estos Terminos y Condiciones.',
      'Entiende que VIAJASEGURO es una comunidad digital de movilidad compartida.',
      'Entiende que VIAJASEGURO no cobra traslados y no presta servicio de transporte.',
      'Entiende que cualquier aportacion economica se acuerda directamente entre usuario y conductor.',
      'Acepta cumplir las reglas de seguridad.',
      'Acepta el tratamiento de sus datos conforme al Aviso de Privacidad.',
      'Acepta la politica de confidencialidad.',
      'Acepta usar la plataforma bajo su propia responsabilidad y conforme a la ley.'
    ]
  }
];