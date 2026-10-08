import { Alert, Badge, Card, Container, ListGroup } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import { Cargando } from '@/shared/components/Cargando';
import { Logo } from '@/shared/components/Logo';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { EstadoOrden } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { convertirDesdeBackend, formatearFecha, formatearFechaHora } from '@/shared/utils/fechas';
import { consultarSeguimiento } from '../api';

/** El camino normal de una orden, para mostrar en qué paso está. */
const PASOS: { estados: EstadoOrden[]; etiqueta: string }[] = [
  { estados: ['recibido'], etiqueta: 'Recibido' },
  { estados: ['en_diagnostico'], etiqueta: 'En revisión' },
  { estados: ['presupuestado', 'aprobado', 'rechazado'], etiqueta: 'Presupuesto' },
  { estados: ['en_reparacion'], etiqueta: 'En reparación' },
  { estados: ['listo_para_retirar'], etiqueta: 'Listo' },
  { estados: ['entregado'], etiqueta: 'Entregado' }
];

/** Qué tiene que hacer el cliente según el estado, en una línea. */
const QUE_SIGUE: Partial<Record<EstadoOrden, string>> = {
  recibido: 'Tu equipo está en el taller. En breve empezamos a revisarlo.',
  en_diagnostico: 'Estamos revisando tu equipo para saber qué tiene.',
  presupuestado: 'Ya tenemos el presupuesto: esperamos tu respuesta para seguir.',
  aprobado: 'Aprobaste el presupuesto. Empezamos con la reparación.',
  rechazado: 'No vas a seguir con la reparación. Podés pasar a retirar el equipo.',
  en_reparacion: 'Estamos reparando tu equipo.',
  listo_para_retirar: '¡Tu equipo está listo! Ya podés pasar a retirarlo.',
  entregado: 'Ya retiraste tu equipo. ¡Gracias por confiar en nosotros!',
  cancelado: 'La orden fue cancelada. Si tenés dudas, comunicate con el taller.'
};

/**
 * Seguimiento público de una orden, con el link o el QR del remito. No pide
 * cuenta: el código aleatorio del link es lo que lo protege.
 */
export function SeguimientoPage() {
  const codigo = useParams<{ codigo: string }>().codigo ?? '';
  const {
    datos: s,
    cargando,
    error
  } = useConsulta(
    () => consultarSeguimiento(codigo),
    [codigo],
    'No encontramos esa orden. Revisá que el link esté completo.'
  );

  const pasoActual = s ? PASOS.findIndex((p) => p.estados.includes(s.estado)) : -1;
  const equipo = s ? [s.equipo.tipo, s.equipo.marca, s.equipo.modelo].filter(Boolean).join(' · ') : '';

  return (
    <Container className="py-4" style={{ maxWidth: 560 }}>
      <div className="d-flex justify-content-center mb-3">
        <Logo size={36} />
      </div>

      {cargando && !s ? (
        <Cargando />
      ) : !s ? (
        <Alert variant="warning">{error}</Alert>
      ) : (
        <>
          <Card className="mb-3">
            <Card.Body>
              <div className="text-muted small">{s.taller}</div>
              <h4 className="mb-1">{s.nombreCliente ? `Hola, ${s.nombreCliente}` : 'Tu orden'}</h4>
              <div className="font-mono small text-muted mb-3">
                Orden {s.numeroOrden} · {equipo}
              </div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <Badge
                  bg={
                    s.estado === 'listo_para_retirar'
                      ? 'success'
                      : s.estado === 'cancelado'
                        ? 'secondary'
                        : 'info'
                  }
                  className="fs-6"
                >
                  {s.etiquetaEstado}
                </Badge>
              </div>
              <p className="mb-0">{QUE_SIGUE[s.estado]}</p>

              {pasoActual >= 0 && (
                <ol
                  className="seguimiento-pasos list-unstyled d-flex mt-3 mb-0"
                  aria-label="Avance de la orden"
                >
                  {PASOS.map((paso, i) => (
                    <li
                      key={paso.etiqueta}
                      className={i < pasoActual ? 'hecho' : i === pasoActual ? 'actual' : ''}
                      aria-current={i === pasoActual ? 'step' : undefined}
                    >
                      <span className="punto" />
                      <span className="etiqueta">{paso.etiqueta}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <ListGroup variant="flush">
              <ListGroup.Item>
                <div className="small text-muted">Ingresó</div>
                {formatearFecha(s.fechaIngreso)}
              </ListGroup.Item>
              {s.fechaPactada && !s.fechaEntrega && (
                <ListGroup.Item>
                  <div className="small text-muted">Fecha estimada de entrega</div>
                  {convertirDesdeBackend(s.fechaPactada)}
                </ListGroup.Item>
              )}
              {s.reparacionSolicitada && (
                <ListGroup.Item>
                  <div className="small text-muted">Trabajo pedido</div>
                  {s.reparacionSolicitada}
                </ListGroup.Item>
              )}
              {s.presupuesto && (
                <ListGroup.Item>
                  <div className="small text-muted">Presupuesto</div>
                  {formatearMonto(s.presupuesto.monto, s.presupuesto.moneda)}
                  {s.presupuesto.aprobado === true && (
                    <Badge bg="success" className="ms-2">
                      Aprobado
                    </Badge>
                  )}
                  {s.presupuesto.aprobado === false && (
                    <Badge bg="secondary" className="ms-2">
                      No aprobado
                    </Badge>
                  )}
                </ListGroup.Item>
              )}
              {s.sucursal && (
                <ListGroup.Item>
                  <div className="small text-muted">Dónde está tu equipo</div>
                  {s.sucursal.nombre}
                  {s.sucursal.direccion && <div className="small">{s.sucursal.direccion}</div>}
                  {s.sucursal.telefono && (
                    <a href={`tel:${s.sucursal.telefono.replace(/[^\d+]/g, '')}`} className="small">
                      {s.sucursal.telefono}
                    </a>
                  )}
                </ListGroup.Item>
              )}
            </ListGroup>
          </Card>

          <Card>
            <Card.Header>Historial</Card.Header>
            <ListGroup variant="flush">
              {[...s.historial].reverse().map((h, i) => (
                <ListGroup.Item key={i}>
                  <div className="d-flex justify-content-between">
                    <strong>{h.etiqueta}</strong>
                    <span className="small text-muted">{formatearFechaHora(h.fecha)}</span>
                  </div>
                  {h.comentario && <div className="small text-muted">{h.comentario}</div>}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
          {s.codigoPortal && (
            <p className="text-center small mt-3">
              <Link to={`/cliente/${s.codigoPortal}`}>Ver todos mis equipos y mi cuenta corriente</Link>
            </p>
          )}
        </>
      )}
    </Container>
  );
}
