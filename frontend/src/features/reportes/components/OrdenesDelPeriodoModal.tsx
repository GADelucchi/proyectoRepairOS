import { Button, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import { EstadoBadge } from '@/features/ordenes/components/EstadoBadge';
import { ETIQUETA_ESTADO } from '@/features/ordenes/estado-orden';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { descargarCsv } from '@/shared/utils/csv';
import { convertirDesdeBackend, formatearFechaHora } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import * as reportesApi from '../api';
import type { ListadoDelPeriodo } from '../api';

const TITULO: Record<ListadoDelPeriodo, string> = {
  ingresadas: 'Órdenes que ingresaron',
  entregadas: 'Órdenes entregadas'
};

interface OrdenesDelPeriodoModalProps {
  /** null: cerrado. */
  cuales: ListadoDelPeriodo | null;
  rango: { desde: string; hasta: string };
  todasLasSucursales: boolean;
  onCerrar: () => void;
}

/** Las órdenes detrás de un número de los reportes, para abrir cualquiera. */
export function OrdenesDelPeriodoModal({
  cuales,
  rango,
  todasLasSucursales,
  onCerrar
}: OrdenesDelPeriodoModalProps) {
  return (
    <Modal show={cuales !== null} onHide={onCerrar} size="lg" fullscreen="md-down" scrollable>
      {cuales && (
        <Listado cuales={cuales} rango={rango} todasLasSucursales={todasLasSucursales} onCerrar={onCerrar} />
      )}
    </Modal>
  );
}

function Listado({
  cuales,
  rango,
  todasLasSucursales,
  onCerrar
}: Omit<OrdenesDelPeriodoModalProps, 'cuales'> & { cuales: ListadoDelPeriodo }) {
  const navigate = useNavigate();
  const { datos, cargando, error } = useConsulta(
    () => reportesApi.obtenerOrdenesDelPeriodo(cuales, { ...rango, todasLasSucursales }),
    [cuales, rango.desde, rango.hasta, todasLasSucursales],
    'No se pudieron cargar las órdenes'
  );
  const ordenes = datos?.ordenes ?? [];
  const fechaDe = (o: (typeof ordenes)[number]) =>
    cuales === 'ingresadas' ? o.fechaIngreso : o.fechaEntrega;

  function exportar() {
    descargarCsv(
      `ordenes-${cuales}_${rango.desde}_a_${rango.hasta}`,
      ['Orden', cuales === 'ingresadas' ? 'Ingresó' : 'Entregada', 'Cliente', 'Teléfono', 'Equipo', 'Estado'],
      ordenes.map((o) => [
        o.numeroOrden,
        formatearFechaHora(fechaDe(o)),
        `${o.clienteNombre} ${o.clienteApellido}`,
        o.clienteTelefono,
        `${o.marca ?? ''} ${o.modelo ?? ''}`.trim(),
        ETIQUETA_ESTADO[o.estado]
      ])
    );
  }

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {TITULO[cuales]}
          <div className="small text-muted fw-normal">
            Del {convertirDesdeBackend(rango.desde)} al {convertirDesdeBackend(rango.hasta)}
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className={ordenes.length > 0 ? 'p-0' : undefined}>
        <AlertaError error={error} />
        {cargando && !datos ? (
          <Cargando />
        ) : ordenes.length === 0 ? (
          <p className="text-muted mb-0">No hay órdenes en el período.</p>
        ) : (
          <TablaApilable hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Equipo</th>
                <th>Estado</th>
                <th className="text-end">{cuales === 'ingresadas' ? 'Ingresó' : 'Entregada'}</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id} {...filaClickeable(() => navigate(`/ordenes/${o.id}`))}>
                  <td className="font-mono small">{o.numeroOrden}</td>
                  <td>
                    {o.clienteNombre} {o.clienteApellido}
                  </td>
                  <td className="small">{`${o.marca ?? ''} ${o.modelo ?? ''}`.trim() || '—'}</td>
                  <td>
                    <EstadoBadge estado={o.estado} />
                  </td>
                  <td className="text-end small text-nowrap">{formatearFechaHora(fechaDe(o))}</td>
                </tr>
              ))}
            </tbody>
          </TablaApilable>
        )}
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <span className="small text-muted">
          {datos && datos.total > ordenes.length
            ? `Se muestran las ${ordenes.length} más recientes de ${datos.total}.`
            : datos && `${datos.total} ${datos.total === 1 ? 'orden' : 'órdenes'}`}
        </span>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={exportar} disabled={ordenes.length === 0}>
            Excel (CSV)
          </Button>
          <Button variant="secondary" size="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </Modal.Footer>
    </>
  );
}
