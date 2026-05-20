# Viaja Seguro - MVP Operativo

MVP para transporte programado con tres roles: pasajero, conductor y admin.

## Stack
- Monorepo npm workspaces
- Frontend: Next.js + TypeScript + Tailwind
- Backend: NestJS + TypeScript
- DB local: SQLite + Prisma
- Auth: JWT con roles (`passenger`, `driver`, `admin`)
- Pagos: flujo manual validado por admin + integracion inicial de Mercado Pago

## Reglas clave actuales
- Precio por asiento: minimo 1 MXN y maximo 500 MXN.
- No se aplica tarifa por km en esta fase.
- Codigo de abordaje y QR se habilitan solo con pago `approved`.
- Solo admin puede aprobar/rechazar pagos y verificaciones.

## Variables de entorno

### Backend (`apps/api/.env`)
```bash
PORT=4000
NODE_ENV=development
DATABASE_URL="file:./dev_local.db"
JWT_SECRET="super-secret-key"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:3000"

# Seguridad admin MVP
ADMIN_SUPERUSER_MODE=false

# Pagos manuales del negocio
MANUAL_PAYMENT_METHOD_LABEL="Transferencia bancaria empresarial"
MANUAL_PAYMENT_BENEFICIARY="NOMBRE COMERCIAL O RAZON SOCIAL"
MANUAL_PAYMENT_BUSINESS_ACCOUNT="CLABE_O_CUENTA_DEL_NEGOCIO"
MANUAL_PAYMENT_PROCESSOR_LABEL="VIAJA SEGURO"
MANUAL_PAYMENT_REFERENCE="VS-RESERVA"
MANUAL_PAYMENT_INSTRUCTIONS="Beneficiario comercial: ...\nMetodo o banco: ...\nCuenta o CLABE del negocio: ...\nReferencia: ...\nSube tu comprobante para validacion manual del admin."

# Mercado Pago Checkout Pro (backend)
MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_WEBHOOK_SECRET=""
MERCADOPAGO_WEBHOOK_URL="http://localhost:4000/api/webhooks/mercadopago"
MERCADOPAGO_USE_SANDBOX=true
```

### Frontend (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_ENABLE_DEV_PAYMENT_SIMULATION=true
```

## Seguridad de cuenta admin (paso a paso)
1. Cambia password del admin (minimo 12 caracteres):
```bash
npm run admin:reset-password --workspace @viajaseguro/api -- admin@viajaseguro.com TU_PASSWORD_SEGURO
```
2. Confirma que en `apps/api/.env` exista solo una linea:
```bash
ADMIN_SUPERUSER_MODE=false
```
3. Reinicia la API e inicia sesion con el nuevo password.

## Configuracion de datos bancarios para piloto
1. Edita `apps/api/.env` con datos reales del negocio (no personales):
- `MANUAL_PAYMENT_BENEFICIARY`
- `MANUAL_PAYMENT_BUSINESS_ACCOUNT`
- `MANUAL_PAYMENT_METHOD_LABEL`
- `MANUAL_PAYMENT_REFERENCE`
- `MANUAL_PAYMENT_INSTRUCTIONS`
2. Reinicia API.
3. Verifica en web (`/dashboard/my-payments` o ticket) que se muestren esos datos.

## Prisma local
```bash
npm run prisma:generate
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run prisma:seed
```

## Ejecutar local
```bash
npm run dev
```

## Rutas admin
- Listado: `/dashboard/admin/routes`
- Crear ruta: admin define punto de inicio, destino, precio por asiento y descripcion.
- Borrado individual: boton `Eliminar` en cada tarjeta.
- Borrado multiple: seleccionar rutas y usar `Eliminar seleccionadas`.
- El borrado se bloquea automaticamente si hay dependencias activas (reservas/viajes no eliminables).

## Endpoints admin de rutas
- `GET /api/admin/routes`
- `POST /api/admin/routes`
- `DELETE /api/admin/routes/:id`
- `POST /api/admin/routes/bulk-delete`

## Flujo operativo corto
1. Admin crea rutas base.
2. Conductor toma ruta y publica su operacion (referencia, horario, asientos).
3. Pasajero reserva.
4. Pasajero sube comprobante.
5. Admin aprueba pago.
6. Se habilita codigo/QR para abordaje.

## Nota de produccion
- SQLite es solo para local/demo.
- Para piloto en linea, mover DB y secretos a entorno seguro.
