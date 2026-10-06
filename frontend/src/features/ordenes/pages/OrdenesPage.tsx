import { useState } from 'react';
import { Badge, Col, Form, Row, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { EstadoOrden } from '@/shared/types';
import { convertirDesdeBackend, formatearFecha } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as ordenesApi from '../api';
import { EstadoBadge } from '../components/EstadoBadge';
import { ESTADOS_ORDEN, ETIQUETA_ESTADO } from '../estado-orden';

/**
 * Órdenes de la sucursal activa, de la más nueva a la más vieja.
 *
 * El buscador pega contra el número de orden, la serie, el modelo y el color del
 * equipo, y el nombre, el teléfono y el DNI del cliente.
 */
export function OrdenesPage() {
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoOrden | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda.trim());
  const {
    datos: ordenes = [],
    cargando,
    error
  } = useConsulta(
    () =>
      ordenesApi.listarOrdenes({
        estado: estadoFiltro || undefined,
        search: busquedaDebounced || undefined
      }),
    [estadoFiltro, busquedaDebounced],
    'No se pudieron cargar las órdenes'
  );
  const filtrando = Boolean(estadoFiltro || busquedaDebounced);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Órdenes de reparación</h3>
        <Link className="btn btn-primary" to="/ordenes/nueva">
          + Nueva orden
        </Link>
      </div>

      <Row className="g-2 mb-3">
        <Col md>
          <Form.Control
            type="search"
            placeholder="Buscar por Nº de orden, serie, modelo, color, cliente, teléfono o DNI..."
            aria-label="Buscar órdenes"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Col>
        <Col md="auto">
          <Form.Select
            style={{ minWidth: 220 }}
            aria-label="Filtrar por estado"
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value as EstadoOrden | '')}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_ORDEN.map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETA_ESTADO[estado]}
              </option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      <AlertaError error={error} />

      {cargando ? (
        <Cargando />
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Nº orden</th>
              <th>Cliente</th>
              <th>Equipo</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fecha de ingreso</th>
              <th>Fecha pactada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id}>
                <td className="font-mono">{o.numeroOrden}</td>
                <td>{nombreCompleto(o.cliente) || '-'}</td>
                <td className="font-mono">
                  {`${o.equipo?.marca ?? ''} ${o.equipo?.modelo ?? ''}`.trim() || '-'}
                  {o.equipo?.numeroSerie && (
                    <div className="text-muted small">S/N {o.equipo.numeroSerie}</div>
                  )}
                </td>
                <td>
                  <Badge bg="secondary">{o.equipo?.tipoEquipo?.nombre ?? 'Sin especificar'}</Badge>
                </td>
                <td>
                  <EstadoBadge estado={o.estado} />
                </td>
                <td>{formatearFecha(o.fechaIngreso)}</td>
                <td>{convertirDesdeBackend(o.fechaPactada) || '-'}</td>
                <td>
                  <Link className="btn btn-sm btn-outline-primary" to={`/ordenes/${o.id}`}>
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {ordenes.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  {filtrando ? 'Ninguna orden coincide con la búsqueda' : 'No hay órdenes en esta sucursal'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}
