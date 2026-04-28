# Checklist Operacion

## Repositorio unico
- El remoto activo debe ser `origin` apuntando a `hankgarcia43-lab/ViajaseguroOPERACION`.
- No usar mirrors ni repositorios auxiliares para despliegue.
- Antes de desplegar, confirmar `git remote -v` y `git status` limpios.

## Render API
- `DATABASE_URL` configurada con Neon en produccion.
- `JWT_SECRET` configurado.
- `CORS_ORIGIN` configurado con el dominio real de Vercel.
- Verificar `https://viajasegurooperacion.onrender.com/api/health` en cada cambio importante.

## Vercel Web
- `NEXT_PUBLIC_API_URL=https://viajasegurooperacion.onrender.com/api`
- Root del proyecto alineado con el monorepo.
- Redeploy sin cache cuando cambie configuracion de build o variables.

## Calidad antes de piloto
- Login pasajero funcional.
- Login conductor funcional.
- Login admin funcional.
- Feed de rutas carga sin errores.
- Crear y tomar ruta sin errores.
- Reserva y pantalla de pago cargan.
- Dashboard admin abre pagos, verificaciones y rutas.

## Ruido que no debe subirse
- Bases SQLite locales.
- Logs `.log`, `.out.log`, `.err.log`.
- `tsbuildinfo`.
- Archivos generados de Prisma como `seed.js`, `seed.js.map`, `seed.d.ts`.