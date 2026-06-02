# Deploy VIAJA SEGURO

Esta guia prepara el MVP para frontend en Vercel y backend/API en Render sin subir secretos al repositorio.

## Vercel - Frontend

Aplicacion: `apps/web`.

Configuracion recomendada en Vercel:

- Framework: Next.js
- Install command: `npm ci`
- Build command: `npm run build --workspace @viajaseguro/web`
- Development command: `npm run dev:web`
- Node.js: 20+

Variables requeridas:

```bash
NEXT_PUBLIC_API_URL=https://TU-BACKEND-RENDER.onrender.com/api
NEXT_PUBLIC_MP_PAYMENT_LINK=https://link.mercadopago.com.mx/viajaseguro2026
NEXT_PUBLIC_MP_PAYMENT_REFERENCE=VIAJA SEGURO
NEXT_PUBLIC_ENABLE_DEV_PAYMENT_SIMULATION=false
NEXT_PUBLIC_COMPANY_NAME=VIAJA SEGURO
NEXT_PUBLIC_SUPPORT_EMAIL=soporte@viajaseguro.mx
NEXT_PUBLIC_SUPPORT_WHATSAPP=+525500000000
NEXT_PUBLIC_DEFAULT_CURRENCY=MXN
NEXT_PUBLIC_DEFAULT_LOCALE=es-MX
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Notas:

- Solo usa `NEXT_PUBLIC_*` para datos que pueden vivir en el navegador.
- No pongas JWT secrets, tokens privados ni datos bancarios sensibles en Vercel como public env.
- Configura `NEXT_PUBLIC_API_URL` con la URL real de Render cuando exista.

## Render - Backend/API

Aplicacion: `apps/api`.

El repo incluye `render.yaml` para un servicio web Docker y una base PostgreSQL.

Render usara:

- Runtime: Docker
- Dockerfile: `./Dockerfile`
- Health check: `/api/health`
- Puerto: `process.env.PORT`
- Base de datos: PostgreSQL gestionado por Render
- Arranque: `npm run prisma:deploy --workspace @viajaseguro/api && npm run start --workspace @viajaseguro/api`

Variables requeridas en Render:

```bash
PORT=4000
NODE_ENV=production
DATABASE_URL=<Render PostgreSQL connection string>
JWT_SECRET=<valor largo y aleatorio>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://TU-FRONTEND.vercel.app
ADMIN_SUPERUSER_MODE=false
AUTO_APPROVE_DRIVERS=false
ENABLE_DEV_DRIVER_AUTO_APPROVE_BYPASS=false
ALLOW_DEV_PAYMENT_SIMULATION=false
MERCADOPAGO_PAYMENT_LINK=https://link.mercadopago.com.mx/viajaseguro2026
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_USE_SANDBOX=false
MANUAL_PAYMENT_PROCESSOR_LABEL=Mercado Pago
MANUAL_PAYMENT_REFERENCE=VIAJA SEGURO
```

## Prisma y base de datos

Comandos utiles:

```bash
npm run prisma:generate
npm run prisma:deploy
```

Estado actual:

- `schema.prisma` apunta a PostgreSQL.
- `apps/api/prisma/migrations` contiene el baseline PostgreSQL activo.
- `apps/api/prisma/migrations_sqlite_archive` conserva las migraciones SQLite historicas solo como referencia.
- Produccion debe usar `prisma migrate deploy`, no `db push`.

Antes del primer deploy:

1. Confirma que la base PostgreSQL de Render este vacia.
2. Si ya existen datos productivos, no apliques el baseline directo: primero hay que planear migracion de datos.
3. Mantener `prisma migrate deploy` como flujo unico de produccion.
4. No usar `db push` en produccion.

## Checklist previo a deploy

```bash
npm ci
npm run typecheck
npm run lint
npm run build:web
npm run build:api
npm run prisma:generate
npm run prisma:deploy
```

Pruebas manuales minimas:

- Login pasajero.
- Login conductor.
- Login admin.
- Crear/ver ruta base.
- Conductor toma ruta.
- Pasajero reserva.
- Pasajero ve monto exacto.
- Pasajero abre Mercado Pago con link fijo.
- Pasajero sube comprobante.
- Admin aprueba pago.
- Pasajero ve ticket/codigo.
- Conductor valida abordaje.
