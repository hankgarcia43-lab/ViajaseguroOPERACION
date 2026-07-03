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
    description: 'Crear rutas compartidas del piloto'
  },
  {
    href: '/dashboard/admin/route-needs',
    label: 'Rutas solicitadas',
    description: 'Necesidades publicadas por usuarios'
  },
  {
    href: '/dashboard/admin/fare-policy',
    label: 'Estimacion por km',
    description: 'Referencia orientativa para rutas'
  },
  {
    href: '/dashboard/admin/payments',
    label: 'Pagos plataforma',
    description: 'Membresias, verificaciones y servicios digitales'
  },
  {
    href: '/dashboard/admin/refunds',
    label: 'Reembolsos legacy',
    description: 'Historial administrativo heredado'
  },
  {
    href: '/dashboard/admin/weekly-payouts',
    label: 'Archivo legacy',
    description: 'Liquidaciones desactivadas para piloto'
  },
  {
    href: '/dashboard/admin/trips',
    label: 'Rutas activas',
    description: 'Vista operativa de salidas compartidas'
  },
  {
    href: '/dashboard/admin/reservations',
    label: 'Solicitudes',
    description: 'Vista operativa de solicitudes de usuarios'
  },
  {
    href: '/dashboard/admin/incidents',
    label: 'Soporte',
    description: 'Comentarios, reportes y alertas'
  }
];
