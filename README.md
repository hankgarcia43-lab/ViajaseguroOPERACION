# Viaja Seguro - Comunidad de rutas compartidas

VIAJA SEGURO es un MVP operativo para coordinar rutas compartidas recurrentes entre miembros verificados: usuario, conductor y admin.

## Stack actual

- Monorepo con npm workspaces.
- Frontend: Next.js App Router, TypeScript y Tailwind en `apps/web`.
- Backend/API: NestJS y TypeScript en `apps/api`.
- Base de datos: Prisma con datasource PostgreSQL.
- Auth: JWT con roles `passenger`, `driver` y `admin`.
- Modelo piloto: solicitudes de usuarios, aceptacion del conductor y pase/codigo de abordaje.
- Pagos: Mercado Pago solo para membresias, verificaciones, suscripciones o servicios digitales de la plataforma.
- E2E: Playwright en `tests/e2e`.

## Estructura

```text
apps/
  api/        NestJS API, Prisma, modulos de negocio
  web/        Next.js frontend
packages/
  shared/     Tipos/utilidades compartidas
docs/         QA, operacion y despliegue
tests/e2e/    Pruebas Playwright
```

## Flujo operativo piloto

1. Admin crea rutas compartidas especificas del piloto.
2. Conductor verificado publica o toma una ruta compatible con su traslado.
3. Usuario solicita unirse uno o varios dias.
4. La app muestra una estimacion orientativa, no un cobro de traslado.
5. Conductor acepta o rechaza la solicitud.
6. Si la solicitud es aceptada, se habilita pase/codigo por fecha.
7. Conductor valida el pase del dia correspondiente.
8. Admin supervisa personas, documentos, vehiculos, rutas, solicitudes, reportes y pagos de plataforma.

## Regla legal y operativa

VIAJA SEGURO no debe procesar pagos de viajes, reservas, comisiones por trayecto, liquidaciones a conductores ni cuentas bancarias de usuarios. El link de Mercado Pago se usa solo para servicios de plataforma como membresias, verificaciones, suscripciones o servicios digitales.

## Desarrollo local

```bash
npm install
npm run prisma:generate
npm run dev
```

Servicios esperados:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Health API: `http://localhost:4000/api/health`

Para PostgreSQL local puedes usar `docker-compose.yml`:

```bash
docker compose up -d postgres
```

Luego usa una URL como:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/viaja_seguro?schema=public"
```

## Validacion tecnica

```bash
npm run typecheck
npm run lint
npm run build:web
npm run build:api
npm run prisma:generate
npm run prisma:deploy
```

Nota: por ahora `lint` ejecuta typecheck. ESLint real queda como mejora posterior porque el repo no tenia configuracion ESLint valida.

## Variables de entorno

Usa los ejemplos seguros:

- Raiz: `.env.example`
- API: `apps/api/.env.example`
- Web: `apps/web/.env.example`
- Web local: `apps/web/.env.local.example`

Nunca subas `.env`, `.env.local`, secretos JWT, tokens privados de Mercado Pago ni datos bancarios reales.

## Mercado Pago piloto

El link fijo configurable queda reservado para pagos de plataforma:

```bash
NEXT_PUBLIC_MP_PAYMENT_LINK=https://link.mercadopago.com.mx/viajaseguro2026
NEXT_PUBLIC_MP_PAYMENT_REFERENCE=VIAJA SEGURO
```

No se usa para cobrar rutas compartidas ni para validar pases de traslado.

## Deploy

La guia minima esta en `docs/deploy.md`.

Resumen:

- Vercel: frontend Next.js desde `apps/web`.
- Render: API NestJS con Docker y PostgreSQL.
- Produccion requiere variables seguras en dashboard, no archivos `.env` reales.

## Estado de base de datos

El schema Prisma actual usa PostgreSQL y conserva campos historicos de reservas, pagos y liquidaciones del MVP anterior. Para este pivot no se hizo migracion destructiva: la capa de aplicacion deja de crear pagos de traslado nuevos y reinterpreta el flujo como solicitudes/pases. La deuda tecnica esta documentada en `docs/shared-mobility-pilot.md`.
## Ruta solicitada por usuario y trial

- Usuario: `Dashboard -> Necesito una ruta` publica origen, destino, dias, horario y lugares.
- Conductor: `Dashboard -> Rutas solicitadas` responde con horario, punto de abordaje, referencia, cupos y aportacion sugerida en efectivo.
- Usuario: acepta o rechaza la propuesta desde sus solicitudes.
- Admin: `Dashboard admin -> Rutas solicitadas` supervisa necesidades y propuestas.
- Todo usuario nuevo recibe prueba gratis de 15 dias (`TRIAL_DAYS=15`).
- Admin puede activar suscripcion piloto por 30 dias desde `Admin -> Personas` despues de verificar un pago de plataforma.

Mercado Pago se mantiene solo para membresias, verificaciones, suscripciones o servicios digitales. No se usa para cobrar rutas ni traslados.
