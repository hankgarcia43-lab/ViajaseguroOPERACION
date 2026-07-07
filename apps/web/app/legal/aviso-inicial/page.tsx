import { LegalDocument } from '@/components/legal-document';
import { INITIAL_NOTICE, LEGAL_UPDATED_AT } from '@/lib/legal-content';

export default function InitialNoticePage() {
  return (
    <LegalDocument
      eyebrow="Aviso obligatorio"
      title="Aviso inicial de confidencialidad, privacidad y seguridad"
      description="Este aviso resume las reglas basicas de confidencialidad, seguridad, uso de informacion y naturaleza de VIAJASEGURO antes de registrarse o utilizar la plataforma."
      updatedAt={LEGAL_UPDATED_AT}
      sections={INITIAL_NOTICE}
    />
  );
}