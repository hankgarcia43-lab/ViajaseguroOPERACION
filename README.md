# Viaja Seguro - MVP Operativo

MVP de transporte programado con tres roles: pasajero, conductor y admin.

## Stack actual

- Monorepo con npm workspaces.
- Frontend: Next.js App Router, TypeScript y Tailwind en `apps/web`.
- Backend/API: NestJS y TypeScript en `apps/api`.
- Base de datos: Prisma con datasource PostgreSQL.
- Auth: JWT con roles `passenger`, `driver` y `admin`.
- Pagos: link fijo de Mercado Pago + comprobante manual + validacion admin.
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

## Flujo operativo conservado

1. Admin gestiona rutas especificas del piloto.
2. Conductor toma rutas o viajes disponibles.
3. Pasajero reserva.
4. Pasajero paga con link fijo de Mercado Pago o flujo manual.
5. Pasajero sube comprobante.
6. Admin valida pago.
7. Se habilita codigo/QR de abordaje.
8. Conductor valida abordaje.
9. Admin supervisa pagos, usuarios, vehiculos, reportes y liquidaciones.

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

Nunca subas `.env`, `.env.local`, secretos JWT, tokens de Mercado Pago ni datos bancarios reales.

## Mercado Pago MVP

El MVP usa un link fijo configurable:

```bash
NEXT_PUBLIC_MP_PAYMENT_LINK=https://link.mercadopago.com.mx/viajaseguro2026
NEXT_PUBLIC_MP_PAYMENT_REFERENCE=VIAJA SEGURO
```

El usuario debe ver el monto exacto en la app, abrir Mercado Pago, ingresar manualmente ese monto, subir comprobante y esperar validacion admin. No se requiere Checkout Pro ni webhooks para esta fase.

## Deploy

La guia minima esta en `docs/deploy.md`.

Resumen:

- Vercel: frontend Next.js desde `apps/web`.
- Render: API NestJS con Docker y PostgreSQL.
- Produccion requiere variables seguras en dashboard, no archivos `.env` reales.

## Estado de base de datos

El schema Prisma actual usa PostgreSQL y el flujo activo usa un baseline PostgreSQL en `apps/api/prisma/migrations/20260527000000_postgresql_baseline`. Las migraciones SQLite historicas se conservan archivadas en `apps/api/prisma/migrations_sqlite_archive` solo como referencia. Para produccion usa `npm run prisma:deploy`; la base de datos inicial debe estar vacia o preparada con una estrategia de migracion de datos.
