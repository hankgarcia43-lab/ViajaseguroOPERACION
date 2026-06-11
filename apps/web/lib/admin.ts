export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/dashboard/admin',
    label: 'Resumen',
    description: 'Vista central del panel admin'
  },
  {
    href: '/dashboard/admin/people',
    label: 'Personas',
    description: 'Usuarios, conductores, documentos y estado operativo'
  },
  {
    href: '/dashboard/admin/verifications',
    label: 'Verificaciones',
    description: 'Usuarios pendientes y documentos'
  },
  {
    href: '/dashboard/admin/vehicles',
    label: 'Vehiculos',
    description: 'Vehiculos pendientes y evidencias'
  },
  {
    href: '/dashboard/admin/routes',
    label: 'Rutas',
    description: 'Crear rutas especificas del piloto'
  },
  {
    href: '/dashboard/admin/fare-policy',
    label: 'Tarifa por km',
    description: 'Politica comercial para rutas y precios'
  },
  {
    href: '/dashboard/admin/payments',
    label: 'Pagos',
    description: 'Pagos, proveedor y referencias'
  },
  {
    href: '/dashboard/admin/refunds',
    label: 'Refunds',
    description: 'Refunds manuales e historial'
  },
  {
    href: '/dashboard/admin/weekly-payouts',
    label: 'Liquidaciones',
    description: 'Payouts internos por periodo'
  },
  {
    href: '/dashboard/admin/trips',
    label: 'Viajes',
    description: 'Vista operativa de viajes y salidas'
  },
  {
    href: '/dashboard/admin/reservations',
    label: 'Reservas',
    description: 'Vista operativa de reservations'
  },
  {
    href: '/dashboard/admin/incidents',
    label: 'Soporte',
    description: 'Comentarios, reportes y alertas'
  }
];
