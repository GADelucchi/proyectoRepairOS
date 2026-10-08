import { useState } from 'react';
import { Alert } from 'react-bootstrap';
import type { Suscripcion } from '@/shared/types';
import { convertirDesdeBackend } from '@/shared/utils/fechas';

/** Avisa cuántos días le quedan al taller antes de que se bloquee el acceso. */
export function AvisoSuscripcion({ suscripcion }: { suscripcion: Suscripcion | null }) {
  const [cerrado, setCerrado] = useState(false);
  if (!suscripcion?.avisar || suscripcion.diasRestantes === null || cerrado) return null;

  const dias = suscripcion.diasRestantes;
  const cuando =
    dias === 0 ? 'hoy es el último día' : `te ${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}`;
  const hasta = suscripcion.hasta ? ` (hasta el ${convertirDesdeBackend(suscripcion.hasta)})` : '';
  const variante = dias <= 2 ? 'danger' : dias <= 7 ? 'warning' : 'info';

  return (
    <Alert variant={variante} dismissible onClose={() => setCerrado(true)} className="py-2">
      {suscripcion.estado === 'prueba' ? (
        <>
          <strong>Período de prueba:</strong> {cuando}
          {hasta}.
        </>
      ) : (
        <>
          <strong>Tu plan {suscripcion.plan?.nombre ?? ''} vence pronto:</strong> {cuando}
          {hasta}.
        </>
      )}{' '}
      Al vencer se bloquea el acceso de todos los usuarios del taller.
      {suscripcion.contacto && (
        <>
          {' '}
          Para elegir o renovar el plan escribí a{' '}
          <Alert.Link href={`mailto:${suscripcion.contacto}`}>{suscripcion.contacto}</Alert.Link>.
        </>
      )}
    </Alert>
  );
}
