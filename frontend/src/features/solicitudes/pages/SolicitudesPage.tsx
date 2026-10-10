import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { EstadoSolicitud, Solicitud } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFechaHora } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as solicitudesApi from '../api';

const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada'
};

const COLOR_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'warning',
  aprobada: 'success',
  rechazada: 'danger',
  cancelada: 'secondary'
};

const FILTROS: { valor: EstadoSolicitud | 'todas'; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'aprobada', etiqueta: 'Aprobadas' },
  { valor: 'rechazada', etiqueta: 'Rechazadas' },
  { valor: 'todas', etiqueta: 'Todas' }
];

/** Qué se está pidiendo, en una línea. */
function describir(s: Solicitud): string {
  if (s.tipo === 'fiado') {
    return `Entregar la orden ${s.orden?.numeroOrden ?? ''} dejando ${formatearMonto(s.monto, s.moneda)} en cuenta corriente`;
  }
  const direccion = s.datos?.direccion === 'debito' ? 'Sumar' : 'Descontar';
  return `${direccion} ${formatearMonto(s.monto, s.moneda)} en la cuenta del cliente`;
}

/**
 * Autorizaciones pendientes de un supervisor.
 *
 * Todos ven la lista porque quien pidió necesita saber si le aprobaron; el
 * botón de resolver aparece solo para el admin.
 */
export function SolicitudesPage() {
  const { usuario, esAdmin } = useAuth();
  const [filtro, setFiltro] = useState<EstadoSolicitud | 'todas'>('pendiente');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<number | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});

  const {
    datos: solicitudes = [],
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(
    () => solicitudesApi.listarSolicitudes(filtro === 'todas' ? undefined : filtro),
    [filtro],
    'No se pudieron cargar las autorizaciones',
    'autorizaciones'
  );
  const { ejecutar } = useAccion(setError);

  /** Ejecuta la acción y devuelve el mensaje para mostrar. */
  async function accionar(s: Solicitud, accion: 'aprobar' | 'rechazar' | 'cancelar'): Promise<string> {
    const respuesta = respuestas[s.id]?.trim() || null;
    if (accion === 'rechazar') {
      await solicitudesApi.rechazarSolicitud(s.id, respuesta);
      return 'Pedido rechazado.';
    }
    if (accion === 'cancelar') {
      await solicitudesApi.cancelarSolicitud(s.id);
      return 'Pedido cancelado.';
    }
    const { saldoCliente } = await solicitudesApi.aprobarSolicitud(s.id, respuesta);
    return s.tipo === 'fiado'
      ? `Entrega autorizada. El cliente queda debiendo ${formatearMonto(saldoCliente, s.moneda)}.`
      : `Ajuste aplicado. El saldo del cliente en ${s.moneda} quedó en ${formatearMonto(saldoCliente, s.moneda)}.`;
  }

  async function resolver(s: Solicitud, accion: 'aprobar' | 'rechazar' | 'cancelar') {
    setResolviendo(s.id);
    setMensaje(null);
    await ejecutar(async () => setMensaje(await accionar(s, accion)), 'No se pudo resolver el pedido');
    setResolviendo(null);
    recargar();
  }

  return (
    <div>
      <h2 className="mb-3">Autorizaciones</h2>

      <AlertaError error={error} onCerrar={() => setError(null)} />
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
        <Cargando />
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
                    <Badge bg={COLOR_ESTADO[s.estado]}>{ETIQUETA_ESTADO[s.estado]}</Badge>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-1 fw-semibold">{describir(s)}</p>
                    <p className="mb-2 text-muted small">
                      {nombreCompleto(s.cliente) || 'Cliente'}
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
                      Pidió {nombreCompleto(s.solicitante) || '—'} el {formatearFechaHora(s.createdAt)}
                      {s.resueltoPor && (
                        <>
                          <br />
                          Resolvió {nombreCompleto(s.resueltoPor)}
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
                        aria-label="Comentario para quien lo pidió"
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
