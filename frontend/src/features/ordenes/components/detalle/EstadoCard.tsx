import { useState } from 'react';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { useAccion } from '@/shared/hooks/useAccion';
import type { EstadoOrden } from '@/shared/types';
import * as ordenesApi from '../../api';
import { ESTADOS_ORDEN, ETIQUETA_ESTADO, transicionesDesde } from '../../estado-orden';
import type { SeccionOrdenProps } from './tipos';

interface EstadoCardProps extends Omit<SeccionOrdenProps, 'puedeEditar'> {
  esAdmin: boolean;
  onEntregar: () => void;
  conAviso: (base: string, orden: ordenesApi.OrdenConNotificacion) => string;
}

/**
 * Cambio de estado y acceso a la entrega.
 *
 * `entregado` no está en el desplegable: entregar mueve plata y va por su
 * propio flujo, que registra cuánto se cobró.
 *
 * El comentario sale impreso en el remito; la nota interna queda en el
 * historial solo para el taller.
 */
export function EstadoCard({
  orden,
  esAdmin,
  onActualizada,
  onError,
  onEntregar,
  conAviso
}: EstadoCardProps) {
  const [nuevoEstado, setNuevoEstado] = useState<EstadoOrden | ''>('');
  const [comentario, setComentario] = useState('');
  const [notaInterna, setNotaInterna] = useState('');
  const [forzar, setForzar] = useState(false);
  const { enCurso, ejecutar } = useAccion(onError);

  const posibles = (forzar && esAdmin ? ESTADOS_ORDEN : transicionesDesde(orden.estado)).filter(
    (e) => e !== 'entregado' && e !== orden.estado
  );
  const puedeEntregar = orden.estado !== 'entregado' && (orden.estado === 'listo_para_retirar' || esAdmin);

  async function cambiar() {
    if (!nuevoEstado) return;
    let actualizada: ordenesApi.OrdenConNotificacion | undefined;
    const ok = await ejecutar(async () => {
      actualizada = await ordenesApi.cambiarEstadoOrden(orden.id, {
        estado: nuevoEstado,
        comentario: comentario.trim() || undefined,
        notaInterna: notaInterna.trim() || undefined,
        forzar: forzar || undefined
      });
    }, 'No se pudo cambiar el estado');
    if (ok && actualizada) {
      setNuevoEstado('');
      setComentario('');
      setNotaInterna('');
      setForzar(false);
      onActualizada(conAviso('Estado actualizado.', actualizada));
    }
  }

  return (
    <Card className="h-100">
      <Card.Header>Cambiar estado</Card.Header>
      <Card.Body>
        {puedeEntregar && (
          <div className="mb-3">
            <Button variant="success" onClick={onEntregar}>
              Entregar equipo
            </Button>
            <Form.Text className="text-muted d-block">
              Al entregar se registra cuánto abona el cliente.
            </Form.Text>
          </div>
        )}
        {posibles.length === 0 && !esAdmin ? (
          <span className="text-muted">
            La orden está {ETIQUETA_ESTADO[orden.estado].toLowerCase()}: no hay más cambios posibles.
          </span>
        ) : (
          <>
            <Form.Select
              className="mb-2"
              aria-label="Nuevo estado"
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value as EstadoOrden)}
            >
              <option value="">Seleccionar nuevo estado...</option>
              {posibles.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETA_ESTADO[estado]}
                </option>
              ))}
            </Form.Select>
            <Form.Control
              className="mb-2"
              aria-label="Comentario"
              placeholder={
                forzar
                  ? 'Motivo del cambio forzado (obligatorio)'
                  : 'Comentario (opcional, sale en el remito)'
              }
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
            <Form.Control
              as="textarea"
              rows={2}
              className="mb-2"
              aria-label="Notas internas"
              placeholder="Notas internas (opcional, no las ve el cliente)"
              value={notaInterna}
              maxLength={2000}
              onChange={(e) => setNotaInterna(e.target.value)}
            />
            {esAdmin && (
              <Form.Check
                type="checkbox"
                id="forzar-estado"
                className="mb-2 small"
                label="Forzar un estado fuera del circuito normal"
                checked={forzar}
                onChange={(e) => {
                  setForzar(e.target.checked);
                  setNuevoEstado('');
                }}
              />
            )}
            <Button
              size="sm"
              onClick={cambiar}
              disabled={!nuevoEstado || enCurso || (forzar && !comentario.trim())}
            >
              {enCurso ? <Spinner size="sm" animation="border" /> : 'Actualizar estado'}
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
