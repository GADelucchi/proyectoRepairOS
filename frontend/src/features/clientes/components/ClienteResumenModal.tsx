import { type ReactNode, useState } from 'react';
import { Badge, Button, Col, ListGroup, Modal, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { CircleCheck, CircleX, ClipboardList, PackageCheck, Wrench, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { EstadoBadge } from '@/features/ordenes/components/EstadoBadge';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import type { Tono } from '@/shared/constants/tonos';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Cliente } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { convertirDesdeBackend, formatearFecha } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as clientesApi from '../api';

/** Un recuadro del resumen: tocarlo muestra (o esconde) sus órdenes. */
function Numero({
  titulo,
  valor,
  icono: Icono,
  tono,
  activo,
  onClick
}: {
  titulo: string;
  valor: number;
  icono: LucideIcon;
  tono: Tono;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`recuadro-filtro d-flex align-items-center gap-2 p-2 rounded border h-100 ${activo ? 'active' : ''}`}
      onClick={onClick}
      disabled={valor === 0}
      aria-pressed={activo}
      title={valor === 0 ? undefined : `Ver las órdenes: ${titulo.toLowerCase()}`}
    >
      <span className={`chip-icono chip-icono-sm tono-${tono}`}>
        <Icono size={16} aria-hidden="true" />
      </span>
      <span className="lh-sm">
        <span className="d-block fw-bold fs-5">{valor}</span>
        <span className="d-block small text-muted">{titulo}</span>
      </span>
    </button>
  );
}

/**
 * Las órdenes de un recuadro. Las de la sucursal actual abren su detalle; las
 * de otra se muestran sin link, porque el detalle solo se ve desde su sucursal.
 */
function ListaOrdenes({ ordenes, titulo }: { ordenes: clientesApi.OrdenDelCliente[]; titulo: string }) {
  const { usuario } = useAuth();
  return (
    <div className="mt-3">
      <div className="small text-muted mb-1">{titulo}</div>
      <ListGroup>
        {ordenes.map((o) => {
          const equipo = `${o.equipo.marca ?? ''} ${o.equipo.modelo ?? ''}`.trim() || 'Equipo';
          const deEstaSucursal = o.sucursal.id === usuario?.sucursalActualId;
          const contenido = (
            <div className="d-flex flex-wrap align-items-center gap-2 w-100">
              <span className="font-mono fw-semibold">{o.numeroOrden}</span>
              <span className="min-w-0">
                {equipo}
                {o.equipo.color && <span className="text-muted"> · {o.equipo.color}</span>}
              </span>
              <span className="ms-auto d-flex align-items-center gap-2">
                {!deEstaSucursal && <span className="small text-muted">{o.sucursal.nombre}</span>}
                <span className="small text-muted">{formatearFecha(o.fechaIngreso)}</span>
                <EstadoBadge estado={o.estado} />
              </span>
            </div>
          );
          return deEstaSucursal ? (
            <ListGroup.Item key={o.id} action as={Link} to={`/ordenes/${o.id}`}>
              {contenido}
            </ListGroup.Item>
          ) : (
            <ListGroup.Item key={o.id} title="Es de otra sucursal: su detalle se ve desde esa sucursal">
              {contenido}
            </ListGroup.Item>
          );
        })}
      </ListGroup>
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

const RECUADROS: {
  clave: Exclude<clientesApi.CategoriaOrdenes, 'canceladas'>;
  titulo: string;
  icono: LucideIcon;
  tono: Tono;
}[] = [
  { clave: 'total', titulo: 'En total', icono: ClipboardList, tono: 'violet' },
  { clave: 'reparadas', titulo: 'Reparadas', icono: CircleCheck, tono: 'green' },
  { clave: 'noReparadas', titulo: 'No reparadas', icono: CircleX, tono: 'red' },
  { clave: 'entregadas', titulo: 'Entregadas', icono: PackageCheck, tono: 'cyan' },
  { clave: 'enCurso', titulo: 'En curso', icono: Wrench, tono: 'amber' }
];

const TITULO_LISTA: Record<clientesApi.CategoriaOrdenes, string> = {
  total: 'Todas sus órdenes',
  reparadas: 'Órdenes reparadas',
  noReparadas: 'Órdenes no reparadas',
  entregadas: 'Órdenes entregadas',
  enCurso: 'Órdenes en curso',
  canceladas: 'Órdenes canceladas'
};

interface ClienteResumenModalProps {
  /** Cliente a mostrar; null con el modal cerrado. */
  clienteId: number | null;
  onCerrar: () => void;
  onEditar: (cliente: Cliente) => void;
}

/**
 * Ficha de un cliente: sus datos, cuántas órdenes trajo y cómo terminaron, y
 * el estado de su cuenta corriente. Tocar un recuadro lista esas órdenes, y
 * desde acá se pasa a editar al cliente.
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

  // El recuadro elegido vale para el cliente en que se eligió: al abrir otro arranca sin ninguno.
  const [eleccion, setEleccion] = useState<{
    clienteId: number;
    categoria: clientesApi.CategoriaOrdenes;
  } | null>(null);
  const categoria = eleccion?.clienteId === clienteId ? eleccion.categoria : null;

  function alternar(nueva: clientesApi.CategoriaOrdenes) {
    if (clienteId === null) return;
    setEleccion(categoria === nueva ? null : { clienteId, categoria: nueva });
  }

  /** Props de cada recuadro según su categoría. */
  const recuadro = (clave: clientesApi.CategoriaOrdenes) => ({
    valor: o?.[clave] ?? 0,
    activo: categoria === clave,
    onClick: () => alternar(clave)
  });

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
                  {RECUADROS.map(({ clave, titulo, icono, tono }) => (
                    <Col key={clave}>
                      <Numero titulo={titulo} icono={icono} tono={tono} {...recuadro(clave)} />
                    </Col>
                  ))}
                </Row>
                {o.canceladas > 0 && (
                  <p className="small text-muted mt-2 mb-0">
                    {o.canceladas === 1 ? '1 orden cancelada' : `${o.canceladas} órdenes canceladas`} ·{' '}
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 align-baseline"
                      onClick={() => alternar('canceladas')}
                    >
                      {categoria === 'canceladas' ? 'Ocultar' : 'Ver'}
                    </Button>
                  </p>
                )}
                {categoria ? (
                  <ListaOrdenes
                    titulo={TITULO_LISTA[categoria]}
                    ordenes={clientesApi.ordenesDeCategoria(resumen.listado, categoria)}
                  />
                ) : (
                  o.total > 0 && (
                    <p className="small text-muted mt-2 mb-0">Tocá un recuadro para ver esas órdenes.</p>
                  )
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
