export function getPaymentFlowMessage(status?: string) {
  switch (status) {
    case 'approved':
      return 'Pago de plataforma validado.';
    case 'submitted':
      return 'Pago de plataforma en revision administrativa.';
    case 'rejected':
      return 'El pago de plataforma fue rechazado. Revisa las notas de admin.';
    case 'refunded':
      return 'Pago de plataforma marcado como reembolsado.';
    default:
      return 'Los pagos se usan solo para planes semanales, verificaciones o servicios digitales de VIAJA SEGURO.';
  }
}

export const PAYMENT_RETENTION_NOTICE =
  'VIAJA SEGURO no procesa pagos de rutas compartidas ni liquidaciones a conductores. El link de Mercado Pago queda reservado para servicios de plataforma.';
