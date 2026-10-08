import { useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import type { ErrorApi } from '@/shared/api/client';
import { formatearMonto } from '@/shared/utils/dinero';
import { linkWhatsApp } from '@/shared/utils/whatsapp';
import * as authApi from '../api';

interface DatosBloqueo {
  taller?: string | null;
  contacto?: { email?: string | null; whatsapp?: string | null };
  planes?: { nombre: string; descripcion?: string | null; precioMensual?: number | null }[];
}

/**
 * Error del login. Los que tienen salida la ofrecen en el mismo cartel: la
 * suscripción vencida, con los planes y a quién escribir; el email sin
 * confirmar, con el botón para reenviar el link.
 */
export function ErrorDeIngreso({ error }: { error: ErrorApi }) {
  if (error.codigo === 'SUSCRIPCION_VENCIDA')
    return <SuscripcionVencida error={error as ErrorApi & DatosBloqueo} />;
  if (error.codigo === 'EMAIL_NO_VERIFICADO') return <EmailSinConfirmar error={error} />;
  return <Alert variant="danger">{error.message}</Alert>;
}

function SuscripcionVencida({ error }: { error: ErrorApi & DatosBloqueo }) {
  const taller = error.taller ? `del taller "${error.taller}"` : 'de mi taller';
  const mensaje = `Hola, quiero reactivar la suscripción ${taller} en RepairOS.`;
  const { email, whatsapp } = error.contacto ?? {};
  const planes = error.planes ?? [];

  return (
    <Alert variant="warning">
      <Alert.Heading as="h6">Suscripción vencida</Alert.Heading>
      <p className="small mb-2">
        {error.message} Elegí un plan y escribinos para reactivarla: los datos del taller siguen guardados.
      </p>

      {planes.length > 0 && (
        <ul className="small ps-3 mb-3">
          {planes.map((plan) => (
            <li key={plan.nombre}>
              <strong>{plan.nombre}</strong>:{' '}
              {plan.precioMensual != null
                ? `${formatearMonto(plan.precioMensual)} por mes`
                : 'precio a convenir'}
              {plan.descripcion && <span className="text-body-secondary"> — {plan.descripcion}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="d-grid gap-2">
        {whatsapp && (
          <Button
            variant="success"
            href={linkWhatsApp(whatsapp, mensaje)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Escribir por WhatsApp
          </Button>
        )}
        {email && (
          <Button
            variant="outline-dark"
            href={`mailto:${email}?subject=${encodeURIComponent('Reactivar suscripción de RepairOS')}&body=${encodeURIComponent(mensaje)}`}
          >
            Escribir por email
          </Button>
        )}
        {!whatsapp && !email && <span className="small">Contactá a RepairOS para reactivarla.</span>}
      </div>
    </Alert>
  );
}

function EmailSinConfirmar({ error }: { error: ErrorApi }) {
  const email = typeof error.email === 'string' ? error.email : null;
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'enviado' | 'sin_email'>('inicial');

  async function reenviar() {
    if (!email) return;
    setEstado('enviando');
    try {
      const { emailHabilitado } = await authApi.reenviarVerificacion(email);
      setEstado(emailHabilitado ? 'enviado' : 'sin_email');
    } catch {
      setEstado('inicial');
    }
  }

  return (
    <Alert variant="warning">
      <p className="small mb-2">{error.message}</p>
      {estado === 'enviado' ? (
        <p className="small mb-0">Listo: te mandamos un link nuevo a {email}.</p>
      ) : estado === 'sin_email' ? (
        <p className="small mb-0">
          El envío de emails no está disponible en este momento. Contactá a RepairOS.
        </p>
      ) : (
        email && (
          <Button size="sm" variant="outline-dark" onClick={reenviar} disabled={estado === 'enviando'}>
            Reenviar el email de confirmación
          </Button>
        )
      )}
    </Alert>
  );
}
