import { useState } from 'react';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { useAccion } from '@/shared/hooks/useAccion';
import type { EstadoOrden } from '@/shared/types';
import * as ordenesApi from '../../api';
import {
  ESTADOS_CON_FLUJO_PROPIO,
  ESTADOS_ORDEN,
  ETIQUETA_ESTADO,
  estaListoParaRetirar,
  transicionesDesde
} from '../../estado-orden';
import type { SeccionOrdenProps } from './tipos';

interface EstadoCardProps extends Omit<SeccionOrdenProps, 'puedeEditar'> {
  esAdmin: boolean;
  onEntregar: () => void;
  /** Elegir "Externo" sin un envío abierto pide a quién se manda el equipo. */
  onTercerizar: () => void;
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
 *
 * "Externo" abre el formulario de tercerización, salvo que el equipo siga
 * afuera (volvió a presupuesto y el cliente ya aprobó): ahí es un cambio común.
 * Al pasar a "Externo" no se pide comentario: el remito es del cliente.
 */
export function EstadoCard({
  orden,
  esAdmin,
  onActualizada,
  onError,
  onEntregar,
  onTercerizar,
  conAviso
}: EstadoCardProps) {
  const [nuevoEstado, setNuevoEstado] = useState<EstadoOrden | ''>('');
  const [comentario, setComentario] = useState('');
  const [notaInterna, setNotaInterna] = useState('');
  const [forzar, setForzar] = useState(false);
  const { enCurso, ejecutar } = useAccion(onError);

  const sigueAfuera = (orden.tercerizaciones ?? []).some(
    (t) => t.estado === 'enviada' || t.estado === 'recibida'
  );
  const posibles = (forzar && esAdmin ? ESTADOS_ORDEN : transicionesDesde(orden.estado)).filter(
    (e) =>
      e !== orden.estado &&
      // "Externo" se elige acá y sigue en el formulario; los otros, por su flujo.
      (e === 'externo' || !ESTADOS_CON_FLUJO_PROPIO.includes(e)) &&
      // Forzar pide un motivo que sale en el remito: a "Externo" se va por el circuito.
      !(forzar && e === 'externo') &&
      // Un equipo tercerizado se recibe con "Recibí el equipo", que pide el tipo.
      !(orden.estado === 'por_recibir' && e === 'recibido')
  );
  const abreFormulario = nuevoEstado === 'externo' && !sigueAfuera;
  const puedeEntregar =
    !['entregado', 'por_recibir'].includes(orden.estado) && (estaListoParaRetirar(orden.estado) || esAdmin);

  async function cambiar() {
    if (!nuevoEstado) return;
    if (abreFormulario) {
      setNuevoEstado('');
      onTercerizar();
      return;
    }
    let actualizada: ordenesApi.OrdenConNotificacion | undefined;
    const ok = await ejecutar(async () => {
      actualizada = await ordenesApi.cambiarEstadoOrden(orden.id, {
        estado: nuevoEstado,
        comentario: (nuevoEstado !== 'externo' && comentario.trim()) || undefined,
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
            {abreFormulario && (
              <Form.Text className="text-muted d-block mb-2">
                A continuación cargás a quién se manda el equipo. El cliente lo sigue viendo &quot;En
                reparación&quot;.
              </Form.Text>
            )}
            {nuevoEstado !== 'externo' && (
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
            )}
            {!abreFormulario && (
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
            )}
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
              {enCurso ? (
                <Spinner size="sm" animation="border" />
              ) : abreFormulario ? (
                'Continuar'
              ) : (
                'Actualizar estado'
              )}
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
