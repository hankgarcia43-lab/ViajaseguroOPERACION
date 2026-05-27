# Migraciones SQLite archivadas

Estas migraciones fueron generadas cuando el proyecto usaba SQLite local. Se conservan como referencia historica, pero Prisma no debe aplicarlas al datasource PostgreSQL actual.

El flujo activo de produccion esta en `../migrations/20260527000000_postgresql_baseline` y usa `provider = "postgresql"`.
