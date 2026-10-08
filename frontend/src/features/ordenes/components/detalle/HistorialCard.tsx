import { Card, ListGroup } from 'react-bootstrap';
import type { OrdenHistorialEstado } from '@/shared/types';
import { formatearFechaHora } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import { ETIQUETA_ESTADO } from '../../estado-orden';

export function HistorialCard({ historial }: { historial: OrdenHistorialEstado[] }) {
  return (
    <Card className="h-100">
      <Card.Header>Historial de estados</Card.Header>
      <Card.Body>
        {historial.length === 0 ? (
          <span className="text-muted">Sin historial</span>
        ) : (
          <ListGroup variant="flush">
            {historial.map((h) => (
              <ListGroup.Item key={h.id} className="px-0">
                <div className="d-flex justify-content-between">
                  <span>
                    {h.estadoAnterior && `${ETIQUETA_ESTADO[h.estadoAnterior]} → `}
                    <strong>{ETIQUETA_ESTADO[h.estadoNuevo]}</strong>
                    {h.usuario && ` — ${nombreCompleto(h.usuario)}`}
                  </span>
                  <span className="text-muted small">{formatearFechaHora(h.createdAt)}</span>
                </div>
                {h.comentario && <div className="text-muted small">{h.comentario}</div>}
                {h.notaInterna && (
                  <div className="small mt-1 p-2 rounded nota-interna" style={{ whiteSpace: 'pre-wrap' }}>
                    <span className="fw-semibold">Nota interna: </span>
                    {h.notaInterna}
                  </div>
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
}
