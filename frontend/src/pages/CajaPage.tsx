import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import * as reportesApi from '../api/reportes';
import { MovimientoCaja, ResumenCaja, ETIQUETA_MEDIO_PAGO, MedioPago } from '../types';
import { getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatearMonto } from '../utils/formato';
import { formatearFechaHora } from '../utils/dateFormat';

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Resta días a una fecha ISO, para los atajos de rango. */
function restarDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Caja: qué plata entró en un período y por qué vía.
 *
 * Solo cuenta los cobros, que es lo que tiene que coincidir con el cajón. Lo
 * facturado y los ajustes se muestran aparte y en gris: son contexto, no caja.
 */
export function CajaPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [todasLasSucursales, setTodasLasSucursales] = useState(false);

  const [resumen, setResumen] = useState<ResumenCaja | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const rango = { desde, hasta, todasLasSucursales: esAdmin && todasLasSucursales };
    try {
      const [datos, detalle] = await Promise.all([
        reportesApi.obtenerCaja(rango),
        reportesApi.movimientosDeCaja(rango)
      ]);
      setResumen(datos);
      setMovimientos(detalle);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar la caja'));
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, todasLasSucursales, esAdmin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function aplicarAtajo(dias: number) {
    setDesde(dias === 0 ? hoyISO() : restarDias(dias));
    setHasta(hoyISO());
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

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col sm={3}>
              <Form.Group>
                <Form.Label className="small">Desde</Form.Label>
                <Form.Control type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </Form.Group>
            </Col>
            <Col sm={3}>
              <Form.Group>
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
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
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

          <Row xs={1} md={esAdmin && todasLasSucursales ? 3 : 2} className="g-3 mb-3">
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
            {esAdmin && todasLasSucursales && (
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
  grupos: { clave: string; etiqueta: string | null; total: number; cantidad: number }[];
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
