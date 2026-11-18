import { FormEvent, useState } from 'react';
import { Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap';
import * as inventarioApi from '@/features/inventario/api';
import { AlertaError } from '@/shared/components/AlertaError';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Articulo, CostoReparacion, EquipoStock, Moneda } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import { convertirDesdeBackend } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as stockApi from '../api';

const usd = (valor: number | null | undefined) => formatearMonto(valor ?? 0, 'USD');

interface CostosReparacionProps {
  equipo: EquipoStock;
}

/**
 * Lo que se le agregó al equipo después de comprarlo: una batería, un módulo,
 * la mano de obra (solo admin). Suma al costo y baja la ganancia de la venta,
 * también si el equipo ya se vendió. Un costo equivocado se anula, no se borra.
 */
export function CostosReparacion({ equipo: inicial }: CostosReparacionProps) {
  const [equipo, setEquipo] = useState(inicial);
  const [concepto, setConcepto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USD');
  const [monto, setMonto] = useState('');
  const [cotizacion, setCotizacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);
  const costos = equipo.costosReparacion ?? [];
  const montoUsd =
    moneda === 'USD' ? aNumero(monto) : aNumero(cotizacion) > 0 ? aNumero(monto) / aNumero(cotizacion) : null;

  async function agregar(e: FormEvent) {
    e.preventDefault();
    const problema =
      (!concepto.trim() && 'Contá qué se le hizo: batería, pantalla, mano de obra…') ||
      (!(aNumero(monto) > 0) && 'Indicá cuánto costó.') ||
      (moneda !== 'USD' && !(aNumero(cotizacion) > 0) && 'Indicá la cotización: cuánto vale 1 US$.');
    if (problema) {
      setError(problema);
      return;
    }
    const ok = await ejecutar(async () => {
      setEquipo(
        await stockApi.agregarCosto(equipo.id, {
          concepto: concepto.trim(),
          moneda,
          monto: aNumero(monto),
          cotizacion: moneda === 'USD' ? null : aNumero(cotizacion)
        })
      );
    }, 'No se pudo agregar el costo');
    if (ok) {
      setConcepto('');
      setMonto('');
    }
  }

  async function anular(costo: CostoReparacion) {
    if (!window.confirm(`¿Anular "${costo.concepto}"? Queda en la lista pero deja de sumar al costo.`))
      return;
    await ejecutar(
      async () => setEquipo(await stockApi.anularCosto(equipo.id, costo.id)),
      'No se pudo anular el costo'
    );
  }

  return (
    <Card className="mb-3">
      <Card.Header>Costos de reparación</Card.Header>
      <Card.Body>
        <AlertaError error={error} onCerrar={() => setError(null)} />
        <dl className="row small mb-3">
          <dt className="col-7 fw-normal text-muted">Compra</dt>
          <dd className="col-5 text-end mb-1">{usd(equipo.costoCompraUsd)}</dd>
          <dt className="col-7 fw-normal text-muted">Reparaciones</dt>
          <dd className="col-5 text-end mb-1">{usd(equipo.costoReparacionesUsd)}</dd>
          <dt className="col-7">Costo del equipo</dt>
          <dd className="col-5 text-end mb-0 fw-semibold">{usd(equipo.costoUsd)}</dd>
        </dl>

        {costos.length > 0 && (
          <Table size="sm" responsive className="align-middle">
            <tbody>
              {costos.map((c) => (
                <tr key={c.id} className={c.anuladoEn ? 'text-muted' : undefined}>
                  <td>
                    <div className={c.anuladoEn ? 'text-decoration-line-through' : undefined}>
                      {c.concepto}
                    </div>
                    <div className="small text-muted">
                      {convertirDesdeBackend(c.fecha)}
                      {c.usuario && ` · ${nombreCompleto(c.usuario)}`}
                      {c.anuladoEn &&
                        ` · Anulado${c.anuladoPor ? ` por ${nombreCompleto(c.anuladoPor)}` : ''}`}
                    </div>
                  </td>
                  <td className="text-end text-nowrap">
                    <span className={c.anuladoEn ? 'text-decoration-line-through' : undefined}>
                      {formatearMonto(c.monto, c.moneda)}
                    </span>
                    {c.moneda !== 'USD' && (
                      <div className="small text-muted">
                        {usd(aNumero(c.montoUsd))} · 1 US$ = {aNumero(c.cotizacion).toLocaleString('es-AR')}
                      </div>
                    )}
                  </td>
                  <td className="text-end" style={{ width: 1 }}>
                    {!c.anuladoEn && (
                      <Button
                        size="sm"
                        variant="link"
                        className="text-danger p-0"
                        disabled={enCurso}
                        onClick={() => anular(c)}
                      >
                        Anular
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <Form onSubmit={agregar}>
          <fieldset disabled={enCurso}>
            <Row className="g-2 align-items-end">
              <Col md={5}>
                <Form.Label htmlFor="costo-concepto">Qué se le hizo</Form.Label>
                <Form.Control
                  id="costo-concepto"
                  placeholder="Batería, pantalla, mano de obra…"
                  maxLength={150}
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                />
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="costo-monto">Costo</Form.Label>
                <InputGroup>
                  <SelectorMoneda value={moneda} onChange={setMoneda} />
                  <Form.Control
                    id="costo-monto"
                    inputMode="decimal"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </InputGroup>
              </Col>
              {moneda !== 'USD' && (
                <Col md={3}>
                  <Form.Label htmlFor="costo-cotizacion">Cotización</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>1 US$ =</InputGroup.Text>
                    <Form.Control
                      id="costo-cotizacion"
                      inputMode="decimal"
                      value={cotizacion}
                      onChange={(e) => setCotizacion(e.target.value)}
                    />
                  </InputGroup>
                </Col>
              )}
              <Col xs="auto" className={moneda !== 'USD' ? 'ms-md-auto' : undefined}>
                <Button type="submit" variant="outline-primary">
                  Agregar
                </Button>
              </Col>
            </Row>
            <Form.Text className="text-muted d-block">
              {montoUsd != null && montoUsd > 0
                ? `Suma ${usd(montoUsd)} al costo del equipo.`
                : 'Suma al costo del equipo y baja la ganancia cuando se venda.'}
              {equipo.estado === 'vendido' && ' El equipo ya se vendió: cambia la ganancia de esa venta.'}
            </Form.Text>
          </fieldset>
        </Form>

        {equipo.estado !== 'baja' && (
          <RepuestoDelInventario equipo={equipo} onUsado={setEquipo} onError={setError} />
        )}
      </Card.Body>
    </Card>
  );
}

/**
 * Un repuesto del inventario puesto en el equipo: sale del stock de la
 * sucursal del equipo (de la entrada más vieja) y su costo se suma solo.
 * Anular ese costo devuelve el repuesto al stock.
 */
function RepuestoDelInventario({
  equipo,
  onUsado,
  onError
}: {
  equipo: EquipoStock;
  onUsado: (equipo: EquipoStock) => void;
  onError: (mensaje: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const buscado = useDebounce(texto);
  const { enCurso, ejecutar } = useAccion(onError);
  const { datos } = useConsulta(
    () =>
      buscado.trim().length < 2
        ? Promise.resolve(null)
        : inventarioApi.listarArticulos({ tipo: 'productos', search: buscado.trim() }),
    [buscado],
    'No se pudo buscar en el inventario'
  );
  const sugerencias = (datos?.articulos ?? []).filter((a) => (a.cantidad ?? 0) > 0);

  async function usar(articulo: Articulo) {
    const ok = await ejecutar(
      async () =>
        onUsado(await stockApi.usarRepuesto(equipo.id, articulo.id, Math.max(1, Number(cantidad) || 1))),
      'No se pudo usar el repuesto'
    );
    if (ok) {
      setTexto('');
      setCantidad('1');
    }
  }

  return (
    <div className="border-top mt-3 pt-3">
      <div className="small fw-semibold mb-2">O un repuesto del inventario</div>
      <Row className="g-2">
        <Col>
          <BuscadorConSugerencias
            texto={texto}
            onTextoChange={setTexto}
            sugerencias={sugerencias}
            claveDe={(a) => a.id}
            mostrar={(a) => (
              <>
                {a.nombre}
                <span className="small text-muted"> · hay {a.cantidad}</span>
              </>
            )}
            onElegir={usar}
            disabled={enCurso}
            placeholder="Buscar el repuesto que se le puso"
          />
        </Col>
        <Col xs={3} sm={2}>
          <Form.Control
            type="number"
            min={1}
            aria-label="Cantidad"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </Col>
      </Row>
      <Form.Text className="text-muted">
        Sale del stock de la sucursal del equipo, al costo de su entrada.
      </Form.Text>
    </div>
  );
}
