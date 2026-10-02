import { useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { ETIQUETA_MEDIO_PAGO } from '@/shared/constants/pagos';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { GrupoCaja, MedioPago } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { fechaLocalISO, formatearFechaHora, haceDias } from '@/shared/utils/fechas';
import * as cajaApi from '../api';

/**
 * Caja: qué plata entró en un período y por qué vía.
 *
 * Solo cuenta los cobros, que es lo que tiene que coincidir con el cajón. Lo
 * facturado y los ajustes se muestran aparte y en gris: son contexto, no caja.
 */
export function CajaPage() {
  const { esAdmin } = useAuth();

  // Fechas del navegador, no de UTC: a las 22 hs "hoy" sigue siendo hoy.
  const [desde, setDesde] = useState(fechaLocalISO);
  const [hasta, setHasta] = useState(fechaLocalISO);
  const [todasLasSucursales, setTodasLasSucursales] = useState(false);
  const verTodas = esAdmin && todasLasSucursales;

  const { datos, cargando, error } = useConsulta(
    async () => {
      const rango = { desde, hasta, todasLasSucursales: verTodas };
      const [resumen, movimientos] = await Promise.all([
        cajaApi.obtenerCaja(rango),
        cajaApi.movimientosDeCaja(rango)
      ]);
      return { resumen, movimientos };
    },
    [desde, hasta, verTodas],
    'No se pudo cargar la caja'
  );
  const resumen = datos?.resumen;
  const movimientos = datos?.movimientos ?? [];

  function aplicarAtajo(dias: number) {
    setDesde(haceDias(dias));
    setHasta(fechaLocalISO());
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 className="mb-0">Caja</h2>
        {resumen && (
          <Badge bg={resumen.alcance === 'taller' ? 'primary' : 'secondary'}>
            {resumen.alcance === 'taller' ? 'Todo el taller' : 'Sucursal actual'}
          </Badge>
        )}
      </div>

      <AlertaError error={error} />

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col sm={3}>
              <Form.Group controlId="caja-desde">
                <Form.Label className="small">Desde</Form.Label>
                <Form.Control type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </Form.Group>
            </Col>
            <Col sm={3}>
              <Form.Group controlId="caja-hasta">
                <Form.Label className="small">Hasta</Form.Label>
                <Form.Control type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </Form.Group>
            </Col>
            <Col sm="auto" className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" onClick={() => aplicarAtajo(0)}>
                Hoy
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={() => aplicarAtajo(6)}>
                Últimos 7 días
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={() => aplicarAtajo(29)}>
                Últimos 30
              </Button>
            </Col>
            {esAdmin && (
              <Col sm="auto">
                <Form.Check
                  type="checkbox"
                  id="todas-sucursales"
                  label="Todas las sucursales"
                  checked={todasLasSucursales}
                  onChange={(e) => setTodasLasSucursales(e.target.checked)}
                />
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      {cargando ? (
        <Cargando />
      ) : resumen ? (
        <>
          <Row xs={1} md={3} className="g-3 mb-3">
            <Col>
              <Card body className="h-100">
                <div className="text-muted small">Cobrado</div>
                <div className="fs-3 fw-semibold text-success">{formatearMonto(resumen.cobrado)}</div>
                <div className="text-muted small">Plata que entró en el período.</div>
              </Card>
            </Col>
            <Col>
              <Card body className="h-100">
                <div className="text-muted small">Facturado</div>
                <div className="fs-3 fw-semibold">{formatearMonto(resumen.facturado)}</div>
                <div className="text-muted small">Lo cargado a clientes, se haya cobrado o no.</div>
              </Card>
            </Col>
            <Col>
              <Card body className="h-100">
                <div className="text-muted small">Ajustes</div>
                <div className="fs-5">
                  <span className="text-danger">+{formatearMonto(resumen.ajustes.debito)}</span>{' '}
                  <span className="text-muted">/</span>{' '}
                  <span className="text-success">-{formatearMonto(resumen.ajustes.credito)}</span>
                </div>
                <div className="text-muted small">Correcciones de saldo. No son plata.</div>
              </Card>
            </Col>
          </Row>

          <Row xs={1} md={verTodas ? 3 : 2} className="g-3 mb-3">
            <Col>
              <Card className="h-100">
                <Card.Header>Por medio de pago</Card.Header>
                <Card.Body className="p-0">
                  <TablaGrupos
                    grupos={resumen.porMedioDePago}
                    etiquetar={(clave) => ETIQUETA_MEDIO_PAGO[clave as MedioPago] ?? 'Sin especificar'}
                  />
                </Card.Body>
              </Card>
            </Col>
            <Col>
              <Card className="h-100">
                <Card.Header>Por usuario</Card.Header>
                <Card.Body className="p-0">
                  <TablaGrupos grupos={resumen.porUsuario} />
                </Card.Body>
              </Card>
            </Col>
            {verTodas && (
              <Col>
                <Card className="h-100">
                  <Card.Header>Por sucursal</Card.Header>
                  <Card.Body className="p-0">
                    <TablaGrupos grupos={resumen.porSucursal} />
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>

          <Card>
            <Card.Header>Cobros del período</Card.Header>
            <Card.Body className="p-0">
              {movimientos.length === 0 ? (
                <p className="text-muted p-3 mb-0">No entró plata en este período.</p>
              ) : (
                <Table hover responsive size="sm" className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Orden</th>
                      <th>Medio</th>
                      <th>Cobró</th>
                      <th className="text-end">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id}>
                        <td className="text-muted small">{formatearFechaHora(m.createdAt)}</td>
                        <td>{m.cliente}</td>
                        <td className="text-muted small">{m.numeroOrden ?? '—'}</td>
                        <td className="small">
                          {m.medioPago ? ETIQUETA_MEDIO_PAGO[m.medioPago] : 'Sin especificar'}
                        </td>
                        <td className="text-muted small">{m.usuario}</td>
                        <td className="text-end fw-semibold">{formatearMonto(Number(m.monto))}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </>
      ) : null}
    </div>
  );
}

interface TablaGruposProps {
  grupos: GrupoCaja[];
  etiquetar?: (clave: string) => string;
}

function TablaGrupos({ grupos, etiquetar }: TablaGruposProps) {
  if (grupos.length === 0) {
    return <p className="text-muted p-3 mb-0">Sin movimientos.</p>;
  }

  return (
    <Table size="sm" className="mb-0">
      <tbody>
        {grupos.map((g) => (
          <tr key={g.clave}>
            <td>{g.etiqueta ?? etiquetar?.(g.clave) ?? g.clave}</td>
            <td className="text-muted small text-end">{g.cantidad}</td>
            <td className="text-end fw-semibold">{formatearMonto(g.total)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
