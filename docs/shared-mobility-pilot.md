# VIAJA SEGURO - piloto de movilidad compartida

## Concepto operativo

VIAJA SEGURO funciona como comunidad de movilidad compartida: conductores verificados publican rutas recurrentes que declaran realizar por cuenta propia, y usuarios verificados solicitan unirse para coordinarse directamente.

La plataforma facilita contacto, verificacion, pases de ruta, reportes e incidentes. VIAJA SEGURO no fija tarifas de transporte, no cobra traslados y no administra pagos entre usuarios y conductores.

## Pagos permitidos

Mercado Pago queda limitado a pagos de plataforma:

- membresias de usuario,
- verificacion de conductor,
- suscripciones o planes de publicacion,
- rutas destacadas o servicios digitales futuros.

No se debe usar Mercado Pago para pagar rutas compartidas, reservas, boletos, comisiones por trayecto, liquidaciones o pagos a conductores.

## Flujo activo

1. Usuario busca rutas compartidas.
2. Usuario revisa conductor, horario, referencia y estimacion orientativa.
3. Usuario solicita unirse uno o varios dias.
4. La solicitud nace en estado `pending`.
5. Conductor acepta o rechaza desde su panel.
6. Si acepta, el usuario ve su pase/codigo por fecha.
7. Conductor inicia ruta y valida el pase del dia.
8. Al terminar, la ruta pasa a historial/archivo.

## Estados de solicitud

Estados nuevos usados sin migracion destructiva:

- `pending`
- `accepted`
- `rejected`
- `cancelled_by_user`
- `cancelled_by_driver`
- `reported`
- `boarded`
- `completed`

Estados heredados que aun pueden existir por datos anteriores:

- `confirmed`
- `paid`
- `cancelled`
- `refunded`
- `no_show`

## Deuda tecnica controlada

Para evitar una migracion grande antes del piloto, se conservan tablas y campos heredados como `reservations`, `trips`, `payments`, `pricePerSeat` y `farePolicy`. En UI y API se reinterpretan asi:

- `Reservation` = solicitud para unirse / pase de ruta.
- `Trip` = instancia operativa de una ruta compartida por fecha.
- `pricePerSeat` = estimacion orientativa de costo compartido.
- `Payment` = solo pagos de plataforma o pagos heredados archivables.

Migracion futura recomendada:

- `route_requests`
- `platform_payments`
- `memberships`
- `driver_plans`
- renombrar campos de precio a `estimatedSharedCost` / `suggestedContribution`.

## Piloto cerrado

Variables sugeridas:

```bash
CLOSED_PILOT_MODE=true
INVITE_ONLY=true
PUBLIC_REGISTRATION_ENABLED=false
MAX_ACTIVE_DRIVERS=20
MAX_ACTIVE_USERS=100
ALLOWED_MUNICIPALITIES=acolman,ecatepec,tecamac,texcoco,teotihuacan
ALLOWED_DESTINATIONS=indios-verdes,pantitlan,buenavista,ciudad-azteca
```

La UI debe comunicar: VIAJA SEGURO se encuentra en piloto cerrado con acceso limitado a zonas y miembros autorizados.
## Flujo nuevo: ruta solicitada por usuario

1. Usuario entra a `Necesito una ruta` y publica origen, destino, dias, horario y lugares necesarios.
2. La solicitud se guarda en `requested_routes` con estado `open`.
3. Conductores verificados y con acceso digital vigente pueden verla en `Rutas solicitadas`.
4. El conductor responde con horario, punto de abordaje, referencia visual, cupos y aportacion sugerida en efectivo.
5. El usuario acepta o rechaza la propuesta desde su panel.
6. Si acepta, la ruta solicitada queda `confirmed` y la propuesta `accepted_by_user`.

Texto operativo obligatorio: la aportacion sugerida es en efectivo, acordada directamente entre usuario y conductor. VIAJASEGURO no cobra traslados ni administra pagos entre las partes.

## Trial y suscripcion

- Todo usuario nuevo recibe `TRIAL_DAYS=15` por defecto.
- El backend expone `subscription` y `access` en `/api/auth/me`.
- Al vencer trial o suscripcion, el usuario puede iniciar sesion y ver informacion, pero el backend bloquea nuevas solicitudes/publicaciones premium.
- Durante el piloto, Mercado Pago funciona con link fijo para membresias, verificaciones o servicios digitales.
- Admin puede activar manualmente una suscripcion piloto por 30 dias desde `Admin > Personas` despues de verificar el pago.

Migraciones agregadas:

- `20260702000000_user_trial_subscription`
- `20260702001000_requested_routes`
