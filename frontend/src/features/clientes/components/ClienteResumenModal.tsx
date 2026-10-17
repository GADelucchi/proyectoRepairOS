import type { ReactNode } from 'react';
import { Badge, Button, Col, Modal, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { CircleCheck, CircleX, ClipboardList, PackageCheck, Wrench, type LucideIcon } from 'lucide-react';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import type { Tono } from '@/shared/constants/tonos';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Cliente } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { convertirDesdeBackend, formatearFecha } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as clientesApi from '../api';

function Numero({
  titulo,
  valor,
  icono: Icono,
  tono
}: {
  titulo: string;
  valor: number;
  icono: LucideIcon;
  tono: Tono;
}) {
  return (
    <div className="d-flex align-items-center gap-2 p-2 rounded border h-100">
      <span className={`chip-icono chip-icono-sm tono-${tono}`}>
        <Icono size={16} aria-hidden="true" />
      </span>
      <div className="lh-sm">
        <div className="fw-bold fs-5">{valor}</div>
        <div className="small text-muted">{titulo}</div>
      </div>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Col xs={6} md={4}>
      <div className="small text-muted">{titulo}</div>
      <div className="text-break">{children || '-'}</div>
    </Col>
  );
}

function CuentaCorriente({ cliente }: { cliente: Cliente }) {
  const deudas = cliente.saldos?.filter((s) => s.saldo > 0) ?? [];
  const aFavor = cliente.saldos?.filter((s) => s.saldo < 0) ?? [];
  if (!cliente.cuentaCorrienteHabilitada && !cliente.saldos?.length) {
    return <span className="text-muted">No tiene cuenta corriente habilitada.</span>;
  }
  if (deudas.length === 0 && aFavor.length === 0) return <Badge className="badge-green">Al día</Badge>;
  return (
    <div className="d-flex flex-wrap align-items-center gap-3">
      {deudas.map((s) => (
        <span key={s.moneda} className="text-danger fw-semibold">
          Debe {formatearMonto(s.saldo, s.moneda)}
        </span>
      ))}
      {aFavor.map((s) => (
        <span key={s.moneda} className="text-success fw-semibold">
          A favor {formatearMonto(-s.saldo, s.moneda)}
        </span>
      ))}
      <Link to="/cuentas" className="small">
        Ver cuenta corriente
      </Link>
    </div>
  );
}

interface ClienteResumenModalProps {
  /** Cliente a mostrar; null con el modal cerrado. */
  clienteId: number | null;
  onCerrar: () => void;
  onEditar: (cliente: Cliente) => void;
}

/**
 * Ficha de un cliente: sus datos, cuántas órdenes trajo y cómo terminaron, y
 * el estado de su cuenta corriente. Desde acá se pasa a editarlo.
 */
export function ClienteResumenModal({ clienteId, onCerrar, onEditar }: ClienteResumenModalProps) {
  const { datos, cargando, error } = useConsulta(
    () => (clienteId ? clientesApi.obtenerResumen(clienteId) : Promise.resolve(null)),
    [clienteId],
    'No se pudo cargar el resumen del cliente'
  );
  const resumen = datos && datos.cliente.id === clienteId ? datos : null;
  const c = resumen?.cliente;
  const o = resumen?.ordenes;

  return (
    <Modal show={clienteId !== null} onHide={onCerrar} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{c ? nombreCompleto(c) : 'Cliente'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <AlertaError error={error} />
        {cargando && !resumen ? (
          <Cargando />
        ) : (
          c &&
          o && (
            <>
              <Row className="g-3 mb-4">
                <Dato titulo="DNI/CUIT">{c.dniCuit}</Dato>
                <Dato titulo="Teléfono">{c.telefono}</Dato>
                <Dato titulo="Email">{c.email}</Dato>
                <Dato titulo="Dirección">{c.direccion}</Dato>
                <Dato titulo="Ciudad">{c.ciudad}</Dato>
                <Dato titulo="Fecha de nacimiento">{convertirDesdeBackend(c.fechaNacimiento)}</Dato>
                {c.esGremio && <Dato titulo="Gremio">{c.nombreGremio ?? 'Sí'}</Dato>}
                <Dato titulo="Última visita">
                  {resumen.ultimaVisita ? formatearFecha(resumen.ultimaVisita) : 'Nunca trajo un equipo'}
                </Dato>
              </Row>

              <h6 className="mb-2">Órdenes</h6>
              <div className="mb-4">
                <Row xs={2} md={3} lg={5} className="g-2">
                  <Col>
                    <Numero titulo="En total" valor={o.total} icono={ClipboardList} tono="violet" />
                  </Col>
                  <Col>
                    <Numero titulo="Reparadas" valor={o.reparadas} icono={CircleCheck} tono="green" />
                  </Col>
                  <Col>
                    <Numero titulo="No reparadas" valor={o.noReparadas} icono={CircleX} tono="red" />
                  </Col>
                  <Col>
                    <Numero titulo="Entregadas" valor={o.entregadas} icono={PackageCheck} tono="cyan" />
                  </Col>
                  <Col>
                    <Numero titulo="En curso" valor={o.enCurso} icono={Wrench} tono="amber" />
                  </Col>
                </Row>
                {o.canceladas > 0 && (
                  <p className="small text-muted mt-2 mb-0">
                    {o.canceladas === 1 ? '1 orden cancelada.' : `${o.canceladas} órdenes canceladas.`}
                  </p>
                )}
              </div>

              <h6 className="mb-2">Cuenta corriente</h6>
              <CuentaCorriente cliente={c} />
            </>
          )
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCerrar}>
          Cerrar
        </Button>
        {c && !c.anonimizadoEn && <Button onClick={() => onEditar(c)}>Editar datos</Button>}
      </Modal.Footer>
    </Modal>
  );
}
