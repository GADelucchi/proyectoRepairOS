import { type ReactNode, useState } from 'react';
import { Button, Card, Form, InputGroup, Spinner } from 'react-bootstrap';
import { useAccion } from '@/shared/hooks/useAccion';
import type { CostosDeOrden, Orden } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import * as ordenesApi from '../../api';

interface GananciaCardProps {
  orden: Orden;
  costos: CostosDeOrden;
  onActualizada: (mensaje?: string) => void;
  onError: (mensaje: string) => void;
}

/**
 * Costo y ganancia de la orden, en US$ (solo admin). Hasta que se entrega se
 * calcula con el presupuesto; después, con lo cobrado. Si se cobró en otra
 * moneda sin cotización, la pide para poder pasarlo a dólares.
 */
export function GananciaCard({ orden, costos, onActualizada, onError }: GananciaCardProps) {
  const [cotizacion, setCotizacion] = useState(
    orden.cotizacionSugerida ? String(orden.cotizacionSugerida) : ''
  );
  const { enCurso, ejecutar } = useAccion(onError);
  const usd = (valor: number) => formatearMonto(valor, 'USD');

  async function guardarCotizacion() {
    const valor = Number(cotizacion.replace(',', '.'));
    if (!(valor > 0)) return onError('Indicá la cotización.');
    const ok = await ejecutar(() => ordenesApi.guardarCotizacion(orden.id, valor), 'No se pudo guardar');
    if (ok) onActualizada('Cotización guardada.');
  }

  const etiquetaBase = costos.base === 'cobrado' ? 'Cobrado' : 'Presupuesto';

  return (
    <Card className="h-100">
      <Card.Header className="d-flex justify-content-between">
        <span>Costo y ganancia</span>
        <span className="badge badge-gris">Solo admins</span>
      </Card.Header>
      <Card.Body>
        <Fila etiqueta={etiquetaBase}>
          {costos.monto === null ? (
            <span className="text-muted">Sin {etiquetaBase.toLowerCase()}</span>
          ) : (
            <>
              {formatearMonto(costos.monto, costos.moneda)}
              {costos.moneda !== 'USD' && costos.baseUsd !== null && (
                <div className="small text-muted text-end">
                  {usd(costos.baseUsd)} a {costos.cotizacion}
                  {costos.cotizacionEstimada && ' (última cotización)'}
                </div>
              )}
            </>
          )}
        </Fila>
        <Fila etiqueta="Repuestos">− {usd(costos.repuestosUsd)}</Fila>
        {costos.perdidosUsd > 0 && (
          <div className="small text-muted text-end mt-n1 mb-1">
            incluye {usd(costos.perdidosUsd)} que se perdió
          </div>
        )}
        <Fila etiqueta="Taller externo">
          {costos.externoUsd > 0 ? `− ${usd(costos.externoUsd)}` : <span className="text-muted">—</span>}
        </Fila>
        <div className="d-flex justify-content-between align-items-center pt-2 mt-1 border-top">
          <strong>{costos.base === 'cobrado' ? 'Ganancia' : 'Ganancia estimada'}</strong>
          <span className={`fs-4 fw-bold ${(costos.gananciaUsd ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
            {costos.gananciaUsd === null ? '—' : usd(costos.gananciaUsd)}
          </span>
        </div>
        {costos.margen !== null && (
          <div className="small text-muted text-end">Margen {costos.margen.toLocaleString('es-AR')} %</div>
        )}

        {costos.faltaCotizacion && (
          <div className="mt-3">
            <Form.Label htmlFor="cotizacion-cobro" className="small">
              Se cobró en {costos.moneda} sin cotización: cargala para pasarlo a dólares.
            </Form.Label>
            <InputGroup size="sm">
              <Form.Control
                id="cotizacion-cobro"
                inputMode="decimal"
                placeholder={`${costos.moneda} por US$ 1`}
                value={cotizacion}
                onChange={(e) => setCotizacion(e.target.value)}
              />
              <Button onClick={guardarCotizacion} disabled={enCurso}>
                {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
              </Button>
            </InputGroup>
          </div>
        )}
        {costos.base === 'presupuesto' && (
          <p className="small text-muted mb-0 mt-2">
            Hasta que se entregue se calcula con el presupuesto. Al entregar pasa a usar lo cobrado.
          </p>
        )}
      </Card.Body>
    </Card>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="d-flex justify-content-between gap-2 py-1">
      <span className="text-muted">{etiqueta}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}
