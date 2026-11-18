import { useEffect, useRef } from 'react';
import { Col, Form, Row } from 'react-bootstrap';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Moneda } from '@/shared/types';
import * as inventarioApi from '../api';

export interface ValorCompra {
  moneda: Moneda;
  /** Como la escribe el usuario. */
  cotizacion: string;
  proveedor: string;
  nota: string;
}

interface DatosCompraProps {
  id: string;
  valor: ValorCompra;
  onChange: (valor: ValorCompra) => void;
}

/**
 * Moneda, cotización, proveedor y nota de una compra. Si no es en dólares pide
 * la cotización (el costo se informa en US$) y propone la última que usó el
 * taller. El proveedor sugiere los que ya se usaron.
 */
export function DatosCompra({ id, valor, onChange }: DatosCompraProps) {
  const enDolares = valor.moneda === 'USD';
  const { datos: proveedores } = useConsulta(
    () => inventarioApi.listarProveedores(),
    [],
    'No se pudieron cargar los proveedores',
    'inventario-proveedores'
  );
  const { datos: sugerida } = useConsulta(
    () => (enDolares ? Promise.resolve(null) : inventarioApi.cotizacionSugerida(valor.moneda)),
    [valor.moneda, enDolares],
    'No se pudo cargar la cotización'
  );

  // Una sola vez, al llegar la sugerencia: después no pisa lo que el usuario escriba (ni que la borre).
  const propuesta = useRef(false);
  useEffect(() => {
    if (propuesta.current || enDolares || !sugerida) return;
    propuesta.current = true;
    if (!valor.cotizacion) onChange({ ...valor, cotizacion: String(sugerida) });
  }, [sugerida, enDolares, valor, onChange]);

  return (
    <Row className="g-3">
      <Col xs={6} md={3}>
        <Form.Group controlId={`${id}-moneda`}>
          <Form.Label>Moneda del costo</Form.Label>
          <SelectorMoneda value={valor.moneda} onChange={(moneda) => onChange({ ...valor, moneda })} />
        </Form.Group>
      </Col>
      {!enDolares && (
        <Col xs={6} md={3}>
          <Form.Group controlId={`${id}-cotizacion`}>
            <Form.Label>Cotización</Form.Label>
            <Form.Control
              inputMode="decimal"
              value={valor.cotizacion}
              onChange={(e) => onChange({ ...valor, cotizacion: e.target.value })}
              placeholder={`${valor.moneda} por US$ 1`}
              required
            />
            <Form.Text>Cuántos {valor.moneda} vale 1 US$ hoy.</Form.Text>
          </Form.Group>
        </Col>
      )}
      <Col xs={12} md={enDolares ? 4 : 3}>
        <Form.Group controlId={`${id}-proveedor`}>
          <Form.Label>
            Proveedor <span className="text-muted fw-normal">(opcional)</span>
          </Form.Label>
          <Form.Control
            list={`${id}-proveedores`}
            value={valor.proveedor}
            maxLength={150}
            onChange={(e) => onChange({ ...valor, proveedor: e.target.value })}
          />
          <datalist id={`${id}-proveedores`}>
            {(proveedores ?? []).map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Form.Group>
      </Col>
      <Col xs={12} md={enDolares ? 5 : 3}>
        <Form.Group controlId={`${id}-nota`}>
          <Form.Label>
            Nota <span className="text-muted fw-normal">(opcional)</span>
          </Form.Label>
          <Form.Control
            value={valor.nota}
            maxLength={255}
            placeholder="Nº de factura, remito…"
            onChange={(e) => onChange({ ...valor, nota: e.target.value })}
          />
        </Form.Group>
      </Col>
    </Row>
  );
}
