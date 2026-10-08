import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Plan } from '@/shared/types';
import {
  convertirDesdeBackend,
  fechaLocalISO,
  formatearFecha,
  formatearFechaHora
} from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as plataformaApi from '../api';
import { EstadoSuscripcionBadge } from './EstadoSuscripcionBadge';

interface TallerModalProps {
  tallerId: number;
  planes: Plan[];
  onCerrar: () => void;
  /** La suscripción cambió: el listado de atrás se recarga. */
  onActualizado: () => void;
}

/** `YYYY-MM-DD` dentro de `dias` días desde hoy (o desde `desde`, si es posterior). */
function sumarDias(dias: number, desde?: string | null): string {
  const hoy = fechaLocalISO();
  const base = desde && desde > hoy ? desde : hoy;
  const fecha = new Date(`${base}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fechaLocalISO(fecha);
}

/** Detalle de un taller y gestión de su suscripción. */
export function TallerModal({ tallerId, planes, onCerrar, onActualizado }: TallerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [estado, setEstado] = useState<plataformaApi.CambioSuscripcion['estado']>('prueba');
  const [planId, setPlanId] = useState('');
  const [hasta, setHasta] = useState('');
  const { enCurso: guardando, ejecutar } = useAccion(setError);

  const {
    datos: taller,
    cargando,
    error: errorCarga,
    recargar
  } = useConsulta(() => plataformaApi.obtenerTaller(tallerId), [tallerId], 'No se pudo cargar el taller');

  // El formulario arranca con la suscripción tal como está.
  useEffect(() => {
    const s = taller?.suscripcion;
    if (!s) {
      setEstado('prueba');
      setPlanId('');
      setHasta(sumarDias(30));
      return;
    }
    setEstado(s.estadoGuardado === 'vencida' ? 'prueba' : s.estadoGuardado);
    setPlanId(s.plan ? String(s.plan.id) : '');
    setHasta((s.estadoGuardado === 'activa' ? s.periodoFin : s.graciaHasta) ?? '');
  }, [taller]);

  async function guardar(cambio: plataformaApi.CambioSuscripcion, aviso: string) {
    setMensaje(null);
    let resultado: plataformaApi.ResultadoSuscripcion | undefined;
    const ok = await ejecutar(async () => {
      resultado = await plataformaApi.actualizarSuscripcion(tallerId, cambio);
    }, 'No se pudo actualizar la suscripción');
    const exceso = (resultado as plataformaApi.ResultadoSuscripcion | undefined)?.exceso;
    if (ok) {
      // Si el plan nuevo queda chico, el taller no puede operar hasta ajustarse: conviene saberlo.
      setMensaje(
        exceso
          ? `${aviso} Ojo: el taller tiene ${exceso.usuarios.usados} usuarios y ${exceso.sucursales.usados} sucursales activos, y el plan ${exceso.plan} permite menos. Hasta que su admin elija cuáles quedan, no van a poder operar.`
          : aviso
      );
      recargar();
      onActualizado();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    guardar(
      { estado, planId: planId ? Number(planId) : null, hasta: hasta || null },
      estado === 'cancelada'
        ? 'Suscripción cancelada: el taller quedó bloqueado.'
        : 'Suscripción actualizada. Los usuarios del taller ya ven el cambio.'
    );
  }

  const s = taller?.suscripcion ?? null;

  return (
    <Modal show onHide={onCerrar} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{taller?.nombre ?? 'Taller'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <AlertaError error={error ?? errorCarga} onCerrar={() => setError(null)} />
        {mensaje && (
          <Alert variant="success" dismissible onClose={() => setMensaje(null)} className="py-2">
            {mensaje}
          </Alert>
        )}

        {cargando && !taller ? (
          <Cargando />
        ) : taller ? (
          <>
            <Row className="g-2 mb-3 small">
              <Col sm={6}>
                <div>
                  Dueño: <strong>{taller.duenoNombre ?? '-'}</strong>
                </div>
                <div>
                  {taller.duenoEmail && <a href={`mailto:${taller.duenoEmail}`}>{taller.duenoEmail}</a>}
                </div>
                <div className="text-muted">Registrado el {formatearFecha(taller.createdAt)}</div>
              </Col>
              <Col sm={6}>
                <div>
                  Órdenes: {taller.ordenes} ({taller.ordenesUltimos30} en los últimos 30 días)
                </div>
                <div>
                  Último acceso: {taller.ultimoAcceso ? formatearFechaHora(taller.ultimoAcceso) : 'nunca'}
                </div>
                {taller.esDemo && (
                  <Badge bg="warning" text="dark">
                    Taller de demo
                  </Badge>
                )}
              </Col>
            </Row>

            <h6>Suscripción</h6>
            <div className="mb-2">
              <EstadoSuscripcionBadge suscripcion={s} />
              {s?.plan && <span className="ms-2 small">Plan {s.plan.nombre}</span>}
              {s?.hasta && (
                <span className="ms-2 small text-muted">hasta el {convertirDesdeBackend(s.hasta)}</span>
              )}
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              <Button
                size="sm"
                variant="outline-info"
                disabled={guardando}
                onClick={() =>
                  guardar(
                    { estado: 'prueba', hasta: sumarDias(15, s?.estado === 'prueba' ? s.graciaHasta : null) },
                    'Prueba extendida 15 días.'
                  )
                }
              >
                Extender prueba 15 días
              </Button>
              <Button
                size="sm"
                variant="outline-success"
                disabled={guardando}
                onClick={() =>
                  guardar(
                    {
                      estado: 'activa',
                      planId: s?.plan?.id ?? null,
                      hasta: sumarDias(30, s?.estado === 'activa' ? s.periodoFin : null)
                    },
                    'Plan activo por 30 días más.'
                  )
                }
              >
                Activar 30 días
              </Button>
              <Button
                size="sm"
                variant="outline-danger"
                disabled={guardando || s?.estado === 'cancelada'}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Cancelar la suscripción de ${taller.nombre}? Todos sus usuarios quedan bloqueados.`
                    )
                  ) {
                    guardar({ estado: 'cancelada' }, 'Suscripción cancelada: el taller quedó bloqueado.');
                  }
                }}
              >
                Cancelar y bloquear
              </Button>
            </div>

            <Form onSubmit={handleSubmit} className="border rounded p-2 mb-4">
              <Row className="g-2 align-items-end">
                <Col sm={4}>
                  <Form.Group controlId="sus-estado">
                    <Form.Label className="small">Estado</Form.Label>
                    <Form.Select
                      size="sm"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value as plataformaApi.CambioSuscripcion['estado'])}
                    >
                      <option value="prueba">Prueba</option>
                      <option value="activa">Activa (plan pago)</option>
                      <option value="cancelada">Cancelada (bloqueado)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col sm={4}>
                  <Form.Group controlId="sus-plan">
                    <Form.Label className="small">Plan</Form.Label>
                    <Form.Select size="sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                      <option value="">Sin plan</option>
                      {planes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col sm={4}>
                  <Form.Group controlId="sus-hasta">
                    <Form.Label className="small">
                      {estado === 'activa' ? 'Vence (vacío = no vence)' : 'Hasta'}
                    </Form.Label>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={hasta}
                      disabled={estado === 'cancelada'}
                      required={estado === 'prueba'}
                      onChange={(e) => setHasta(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Button type="submit" size="sm" className="mt-2" disabled={guardando}>
                {guardando ? <Spinner size="sm" animation="border" /> : 'Guardar suscripción'}
              </Button>
            </Form>

            <h6>Usuarios</h6>
            <Table size="sm" responsive className="align-middle">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Último acceso</th>
                </tr>
              </thead>
              <tbody>
                {taller.usuarios.map((u) => (
                  <tr key={u.id} className={u.activo ? '' : 'text-muted'}>
                    <td>
                      {nombreCompleto(u)}
                      {!u.activo && (
                        <Badge bg="secondary" className="ms-1">
                          baja
                        </Badge>
                      )}
                    </td>
                    <td className="small">{u.email}</td>
                    <td className="small">{u.rol === 'admin' ? 'Admin' : 'Técnico'}</td>
                    <td className="small">
                      {u.ultimoAccesoAt ? formatearFechaHora(u.ultimoAccesoAt) : 'nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <h6>Sucursales</h6>
            {taller.sucursales.length === 0 ? (
              <p className="small text-muted">Todavía no creó ninguna sucursal.</p>
            ) : (
              <p className="small">
                {taller.sucursales
                  .map((suc) => `${suc.nombre}${suc.activo ? '' : ' (inactiva)'}`)
                  .join(' · ')}
              </p>
            )}
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
