import { Badge, Card, ListGroup } from 'react-bootstrap';
import { ExternalLink } from 'lucide-react';
import type { EstadoTercerizacion, Tercerizacion } from '@/shared/types';
import { formatearFecha } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import { urlDeSeguimiento } from '../../aviso-cliente';
import { EstadoBadge } from '../EstadoBadge';

const ETIQUETA_ENVIO: Record<EstadoTercerizacion, { texto: string; clase: string }> = {
  enviada: { texto: 'Afuera', clase: 'badge-teal' },
  recibida: { texto: 'Lo recibió', clase: 'badge-teal' },
  devuelta: { texto: 'Volvió', clase: 'badge-gris' },
  cancelada: { texto: 'Cancelado', clase: 'badge-red' }
};

/** "Enviado el 3/11 · recibido el 4/11 · volvió el 9/11". */
function fechasDelEnvio(t: Tercerizacion): string {
  return [
    `Enviado el ${formatearFecha(t.createdAt)}`,
    t.recibidaEn && `recibido el ${formatearFecha(t.recibidaEn)}`,
    t.devueltaEn && `volvió el ${formatearFecha(t.devueltaEn)}`,
    t.canceladaEn && `cancelado el ${formatearFecha(t.canceladaEn)}`
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * A quién se mandó el equipo. Si el destino usa RepairOS, se ve en qué anda su
 * orden y el link de seguimiento de ese taller (con su presupuesto, si lo cargó).
 * Solo lo ve el taller: el cliente sigue viendo "En reparación".
 */
export function TercerizacionCard({ tercerizaciones }: { tercerizaciones: Tercerizacion[] }) {
  return (
    <Card>
      <Card.Header>Taller externo</Card.Header>
      <ListGroup variant="flush">
        {tercerizaciones.map((t) => {
          const envio = ETIQUETA_ENVIO[t.estado];
          const contacto = [t.dniCuit && `DNI/CUIT ${t.dniCuit}`, t.direccion].filter(Boolean).join(' · ');
          return (
            <ListGroup.Item key={t.id}>
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div className="min-w-0">
                  <strong>{t.nombre}</strong>
                  {t.enRepairOS && <Badge className="badge-violet ms-2">RepairOS</Badge>}
                  {contacto && <div className="small text-muted">{contacto}</div>}
                  <div className="small">
                    {t.telefono && <a href={`tel:${t.telefono.replace(/[^\d+]/g, '')}`}>{t.telefono}</a>}
                    {t.telefono && t.email && ' · '}
                    {t.email && <a href={`mailto:${t.email}`}>{t.email}</a>}
                  </div>
                </div>
                <Badge className={envio.clase}>{envio.texto}</Badge>
              </div>

              <div className="small mt-2" style={{ whiteSpace: 'pre-line' }}>
                <span className="text-muted">Trabajo: </span>
                {t.trabajo}
              </div>

              {t.ordenDestino && (
                <div className="small mt-2 d-flex align-items-center gap-2 flex-wrap">
                  <span className="text-muted">Su orden</span>
                  <span className="font-mono">{t.ordenDestino.numeroOrden}</span>
                  <EstadoBadge estado={t.ordenDestino.estado} />
                  {t.ordenDestino.codigoSeguimiento && (
                    <a
                      href={urlDeSeguimiento(t.ordenDestino.codigoSeguimiento)}
                      target="_blank"
                      rel="noreferrer"
                      className="d-inline-flex align-items-center gap-1"
                    >
                      Ver su seguimiento <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              <div className="text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                {fechasDelEnvio(t)}
                {t.enviadaPor && ` · por ${nombreCompleto(t.enviadaPor)}`}
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    </Card>
  );
}
