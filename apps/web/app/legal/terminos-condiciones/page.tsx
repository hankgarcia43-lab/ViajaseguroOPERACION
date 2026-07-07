import { LegalDocument } from '@/components/legal-document';
import { LEGAL_UPDATED_AT, TERMS_SECTIONS } from '@/lib/legal-content';

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terminos legales"
      title="Terminos y condiciones de uso de VIAJASEGURO"
      description="Reglas de uso de la comunidad digital de movilidad compartida, incluyendo naturaleza de la plataforma, planes digitales, seguridad, confidencialidad, reportes, rutas y limitacion de responsabilidad."
      updatedAt={LEGAL_UPDATED_AT}
      sections={TERMS_SECTIONS}
    />
  );
}