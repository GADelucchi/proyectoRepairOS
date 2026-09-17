import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router';
import * as solicitudesApi from '../api/solicitudes';
import { EstadoSolicitud, Solicitud, ETIQUETA_ESTADO_SOLICITUD, COLOR_ESTADO_SOLICITUD } from '../types';
import { getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatearMonto } from '../utils/formato';
import { formatearFechaHora } from '../utils/dateFormat';

const FILTROS: { valor: EstadoSolicitud | 'todas'; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'aprobada', etiqueta: 'Aprobadas' },
  { valor: 'rechazada', etiqueta: 'Rechazadas' },
  { valor: 'todas', etiqueta: 'Todas' }
];

/** Qué se está pidiendo, en una línea. */
function describir(s: Solicitud): string {
  if (s.tipo === 'fiado') {
    return `Entregar la orden ${s.orden?.numeroOrden ?? ''} dejando ${formatearMonto(Number(s.monto))} en cuenta corriente`;
  }
  const direccion = s.datos?.direccion === 'debito' ? 'Sumar' : 'Descontar';
  return `${direccion} ${formatearMonto(Number(s.monto))} en la cuenta del cliente`;
}

/**
 * Autorizaciones pendientes de un supervisor.
 *
 * Todos ven la lista porque quien pidió necesita saber si le aprobaron; el
 * botón de resolver aparece solo para el admin.
 */
export function SolicitudesPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [filtro, setFiltro] = useState<EstadoSolicitud | 'todas'>('pendiente');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<number | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setSolicitudes(await solicitudesApi.listarSolicitudes(filtro === 'todas' ? undefined : filtro));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las autorizaciones'));
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function resolver(s: Solicitud, accion: 'aprobar' | 'rechazar' | 'cancelar') {
    setResolviendo(s.id);
    setError(null);
    try {
      const respuesta = respuestas[s.id]?.trim() || null;
      if (accion === 'aprobar') {
        const { saldoCliente } = await solicitudesApi.aprobarSolicitud(s.id, respuesta);
        setMensaje(
          s.tipo === 'fiado'
            ? `Entrega autorizada. El cliente queda debiendo ${formatearMonto(saldoCliente)}.`
            : `Ajuste aplicado. El saldo del cliente quedó en ${formatearMonto(saldoCliente)}.`
        );
      } else if (accion === 'rechazar') {
        await solicitudesApi.rechazarSolicitud(s.id, respuesta);
        setMensaje('Pedido rechazado.');
      } else {
        await solicitudesApi.cancelarSolicitud(s.id);
        setMensaje('Pedido cancelado.');
      }
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo resolver el pedido'));
    } finally {
      setResolviendo(null);
    }
  }

  return (
    <div>
      <h2 className="mb-3">Autorizaciones</h2>

      {error && <Alert variant="danger">{error}</Alert>}
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      <div className="d-flex gap-2 mb-3 flex-wrap">
        {FILTROS.map((f) => (
          <Button
            key={f.valor}
            size="sm"
            variant={filtro === f.valor ? 'primary' : 'outline-secondary'}
            onClick={() => setFiltro(f.valor)}
          >
            {f.etiqueta}
          </Button>
        ))}
      </div>

      {cargando ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
      ) : solicitudes.length === 0 ? (
        <Alert variant="light" className="border">
          {filtro === 'pendiente' ? 'No hay nada esperando autorización.' : 'No hay pedidos con ese estado.'}
        </Alert>
      ) : (
        <Row xs={1} lg={2} className="g-3">
          {solicitudes.map((s) => {
            const pendiente = s.estado === 'pendiente';
            const puedeCancelar = pendiente && (esAdmin || s.solicitante?.id === usuario?.id);

            return (
              <Col key={s.id}>
                <Card className="h-100">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>{s.tipo === 'fiado' ? 'Entrega fiada' : 'Ajuste de cuenta'}</span>
                    <Badge bg={COLOR_ESTADO_SOLICITUD[s.estado]}>{ETIQUETA_ESTADO_SOLICITUD[s.estado]}</Badge>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-1 fw-semibold">{describir(s)}</p>
                    <p className="mb-2 text-muted small">
                      {s.cliente ? `${s.cliente.nombre} ${s.cliente.apellido}` : 'Cliente'}
                      {s.orden && (
                        <>
                          {' · '}
                          <Link to={`/ordenes/${s.orden.id}`}>{s.orden.numeroOrden}</Link>
                        </>
                      )}
                    </p>

                    <div className="border-start ps-3 mb-3">
                      <div className="small text-muted">Motivo</div>
                      <div>{s.motivo}</div>
                    </div>

                    <p className="text-muted small mb-2">
                      Pidió {s.solicitante ? `${s.solicitante.nombre} ${s.solicitante.apellido}` : '—'} el{' '}
                      {formatearFechaHora(s.createdAt)}
                      {s.resueltoPor && (
                        <>
                          <br />
                          Resolvió {s.resueltoPor.nombre} {s.resueltoPor.apellido}
                          {s.resueltoEn && ` el ${formatearFechaHora(s.resueltoEn)}`}
                        </>
                      )}
                    </p>

                    {s.respuesta && (
                      <Alert variant="light" className="border py-2 px-3 small mb-3">
                        {s.respuesta}
                      </Alert>
                    )}

                    {pendiente && esAdmin && (
                      <Form.Control
                        size="sm"
                        className="mb-2"
                        placeholder="Comentario para quien lo pidió (opcional)"
                        value={respuestas[s.id] ?? ''}
                        onChange={(e) => setRespuestas({ ...respuestas, [s.id]: e.target.value })}
                        disabled={resolviendo === s.id}
                      />
                    )}

                    <div className="d-flex gap-2 flex-wrap">
                      {pendiente && esAdmin && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            disabled={resolviendo === s.id}
                            onClick={() => resolver(s, 'aprobar')}
                          >
                            {resolviendo === s.id ? <Spinner size="sm" animation="border" /> : 'Aprobar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            disabled={resolviendo === s.id}
                            onClick={() => resolver(s, 'rechazar')}
                          >
                            Rechazar
                          </Button>
                        </>
                      )}
                      {puedeCancelar && (
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={resolviendo === s.id}
                          onClick={() => resolver(s, 'cancelar')}
                        >
                          Cancelar pedido
                        </Button>
                      )}
                      {pendiente && !esAdmin && !puedeCancelar && (
                        <span className="text-muted small">Esperando a un administrador.</span>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
