export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/dashboard/admin',
    label: 'Resumen',
    description: 'Vista central de operacion, soporte y estadisticas'
  },
  {
    href: '/dashboard/admin/people',
    label: 'Personas',
    description: 'Usuarios, conductores, plan activo y estado operativo'
  },
  {
    href: '/dashboard/admin/verifications',
    label: 'Documentos',
    description: 'Validacion de identidad y documentos pendientes'
  },
  {
    href: '/dashboard/admin/vehicles',
    label: 'Vehiculos',
    description: 'Evidencias y vehiculos de conductores'
  },
  {
    href: '/dashboard/admin/payments',
    label: 'Planes pagados',
    description: 'Pagos de plan semanal, verificaciones y servicios digitales'
  },
  {
    href: '/dashboard/admin/incidents',
    label: 'Soporte',
    description: 'Comentarios, sugerencias, reportes y alertas'
  },
  {
    href: '/dashboard/admin/routes',
    label: 'Rutas',
    description: 'Crear y administrar rutas compartidas del piloto'
  },
  {
    href: '/dashboard/admin/route-needs',
    label: 'Rutas solicitadas',
    description: 'Necesidades publicadas por usuarios'
  },
  {
    href: '/dashboard/admin/fare-policy',
    label: 'Tarifa por km',
    description: 'Referencia orientativa para calculo de rutas'
  },
  {
    href: '/dashboard/admin/trips',
    label: 'Viajes',
    description: 'Vista operativa de salidas compartidas'
  },
  {
    href: '/dashboard/admin/reservations',
    label: 'Solicitudes',
    description: 'Solicitudes, pases y actividad de usuarios'
  }
];