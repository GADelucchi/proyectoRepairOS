import { FormEvent, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Form, ListGroup, Row, Spinner } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import { EstadoBadge } from '@/features/ordenes/components/EstadoBadge';
import { getApiErrorMessage } from '@/shared/api/client';
import { Logo } from '@/shared/components/Logo';
import { esDebito, ETIQUETA_MEDIO_PAGO, ETIQUETA_MOVIMIENTO } from '@/shared/constants/pagos';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import { consultarPortal, type DatosPortal } from '../api';

/**
 * Portal de clientes de un taller: cada cliente consulta sus datos, sus órdenes
 * y su cuenta corriente con el DNI y los últimos 4 dígitos de su teléfono.
 *
 * No busca mientras se escribe: consulta recién con los dos datos completos y
 * el botón, y un dato equivocado no dice cuál fue.
 */
export function PortalClientePage() {
  const codigo = useParams<{ codigo: string }>().codigo ?? '';
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [datos, setDatos] = useState<DatosPortal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const dniLimpio = dni.replace(/\D/g, '');
  const listo = dniLimpio.length >= 6 && /^\d{4}$/.test(telefono);

  async function consultar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      setDatos(await consultarPortal(codigo, dniLimpio, telefono));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo hacer la consulta'));
    } finally {
      setCargando(false);
    }
  }

  function salir() {
    setDatos(null);
    setDni('');
    setTelefono('');
  }

  return (
    <Container className="py-4" style={{ maxWidth: 640 }}>
      <div className="d-flex justify-content-center mb-3">
        <Logo size={36} />
      </div>

      {!datos ? (
        <Card>
          <Card.Body>
            <h4 className="mb-1">Mis datos y mi cuenta</h4>
            <p className="text-muted small">
              Consultá tus equipos, el estado de tus órdenes y tu cuenta corriente con el taller.
            </p>
            {error && <Alert variant="warning">{error}</Alert>}
            <Form onSubmit={consultar}>
              <Form.Group className="mb-3" controlId="portal-dni">
                <Form.Label>DNI o CUIT</Form.Label>
                <Form.Control
                  inputMode="numeric"
                  autoComplete="off"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Completo, sin puntos"
                  required
                  autoFocus
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="portal-telefono">
                <Form.Label>Últimos 4 dígitos de tu teléfono</Form.Label>
                <Form.Control
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="El que dejaste en el taller"
                  required
                />
                <Form.Text className="text-muted">
                  Lo pedimos para que nadie más pueda ver tus datos.
                </Form.Text>
              </Form.Group>
              <Button type="submit" className="w-100" disabled={!listo || cargando}>
                {cargando ? <Spinner size="sm" animation="border" /> : 'Consultar'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-start mb-3 gap-2">
            <div>
              <div className="text-muted small">{datos.taller}</div>
              <h4 className="mb-0">Hola, {datos.cliente.nombre}</h4>
            </div>
            <Button size="sm" variant="outline-secondary" onClick={salir}>
              Salir
            </Button>
          </div>

          <Card className="mb-3">
            <Card.Header>Cuenta corriente</Card.Header>
            <Card.Body>
              {datos.saldos.length === 0 ? (
                <span className="text-success">Estás al día.</span>
              ) : (
                datos.saldos.map((s) => (
                  <div
                    key={s.moneda}
                    className={`fs-5 fw-semibold ${s.saldo > 0 ? 'text-danger' : 'text-success'}`}
                  >
                    {s.saldo > 0 ? 'Debés ' : 'Tenés a favor '}
                    {formatearMonto(Math.abs(s.saldo), s.moneda)}
                  </div>
                ))
              )}
            </Card.Body>
            {datos.movimientos.length > 0 && (
              <ListGroup variant="flush">
                {datos.movimientos.map((m, i) => (
                  <ListGroup.Item key={i} className="d-flex justify-content-between gap-2 small">
                    <span>
                      {formatearFecha(m.fecha)} · {ETIQUETA_MOVIMIENTO[m.tipo]}
                      {m.numeroOrden && ` · ${m.numeroOrden}`}
                      {m.medioPago && (
                        <span className="text-muted"> · {ETIQUETA_MEDIO_PAGO[m.medioPago]}</span>
                      )}
                    </span>
                    <span className={esDebito(m.tipo) ? '' : 'text-success'}>
                      {esDebito(m.tipo) ? '' : '−'}
                      {formatearMonto(m.monto, m.moneda)}
                    </span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card>

          <Card className="mb-3">
            <Card.Header>
              Mis órdenes <Badge bg="secondary">{datos.ordenes.length}</Badge>
            </Card.Header>
            {datos.ordenes.length === 0 ? (
              <Card.Body className="text-muted small">Todavía no hay órdenes.</Card.Body>
            ) : (
              <ListGroup variant="flush">
                {datos.ordenes.map((o) => (
                  <ListGroup.Item key={o.numeroOrden}>
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <span className="font-mono small">{o.numeroOrden}</span>
                      <EstadoBadge estado={o.estado} />
                    </div>
                    <div>{o.equipo}</div>
                    <div className="small text-muted">
                      Ingresó el {formatearFecha(o.fechaIngreso)}
                      {o.fechaEntrega && ` · entregado el ${formatearFecha(o.fechaEntrega)}`}
                      {(o.montoTotal ?? o.presupuestoMonto) != null &&
                        ` · ${formatearMonto((o.montoTotal ?? o.presupuestoMonto)!, o.moneda)}`}
                    </div>
                    {o.codigoSeguimiento && o.estado !== 'entregado' && (
                      <Link to={`/seguimiento/${o.codigoSeguimiento}`} className="small">
                        Ver el seguimiento
                      </Link>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card>

          <Card>
            <Card.Header>Mis datos</Card.Header>
            <Card.Body className="small">
              <Row className="g-2">
                <Col sm={6}>
                  {datos.cliente.nombre} {datos.cliente.apellido}
                </Col>
                <Col sm={6}>DNI/CUIT: {datos.cliente.dniCuit ?? '-'}</Col>
                <Col sm={6}>Teléfono: {datos.cliente.telefono ?? '-'}</Col>
                <Col sm={6}>Email: {datos.cliente.email ?? '-'}</Col>
                <Col sm={12}>
                  Domicilio:{' '}
                  {[datos.cliente.direccion, datos.cliente.ciudad].filter(Boolean).join(', ') || '-'}
                </Col>
              </Row>
              <p className="text-muted mt-3 mb-0">
                Si algún dato está mal, avisale al taller para que lo corrija.
              </p>
            </Card.Body>
          </Card>
        </>
      )}
    </Container>
  );
}
