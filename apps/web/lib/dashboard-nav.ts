export type DashboardNavItem = {
  href: string;
  label: string;
};

export const PASSENGER_DASHBOARD_NAV: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/routes/request', label: 'Necesito una ruta' },
  { href: '/dashboard/search-trips', label: 'Buscar rutas' },
  { href: '/dashboard/my-reservations', label: 'Mis solicitudes' },
  { href: '/dashboard/my-payments', label: 'Mi acceso' }
];

export const DRIVER_DASHBOARD_NAV: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/routes/create', label: 'Publicar ruta' },
  { href: '/dashboard/route-needs', label: 'Rutas solicitadas' },
  { href: '/dashboard/trips', label: 'Mis rutas activas' },
  { href: '/dashboard/verification', label: 'Verificacion / plan' }
];

export const ADMIN_DASHBOARD_NAV: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/admin', label: 'Panel admin' },
  { href: '/dashboard/admin/verifications', label: 'Verificaciones' },
  { href: '/dashboard/admin/people', label: 'Usuarios' },
  { href: '/dashboard/admin/routes', label: 'Rutas' },
  { href: '/dashboard/admin/payments', label: 'Accesos internos' },
  { href: '/dashboard/admin/reservations', label: 'Solicitudes' },
  { href: '/dashboard/admin/incidents', label: 'Reportes' }
];
