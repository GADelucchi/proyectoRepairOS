import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import * as ordenesApi from '../api/ordenes';
import { Orden, EstadoOrden, ESTADOS_ORDEN } from '../types';
import { getApiErrorMessage } from '../api/client';
import { ESTADO_BADGE_CLASS } from '../estadoColors';
import { formatearFecha, convertirDesdeBackend } from '../utils/dateFormat';

export function OrdenesPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoOrden | ''>('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar(estado?: EstadoOrden) {
    setCargando(true);
    setError(null);
    try {
      const data = await ordenesApi.listarOrdenes(estado || undefined);
      setOrdenes(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las órdenes'));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Órdenes de reparación</h3>
        <Button as={Link as any} to="/ordenes/nueva">
          + Nueva orden
        </Button>
      </div>

      <Form.Select
        className="mb-3"
        style={{ maxWidth: 320 }}
        value={estadoFiltro}
        onChange={(e) => {
          const val = e.target.value as EstadoOrden | '';
          setEstadoFiltro(val);
          cargar(val || undefined);
        }}
      >
        <option value="">Todos los estados</option>
        {ESTADOS_ORDEN.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </Form.Select>

      {error && <Alert variant="danger">{error}</Alert>}

      {cargando ? (
        <Spinner animation="border" />
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
                <td>{o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}` : '-'}</td>
                <td className="font-mono">
                  {o.equipo ? `${o.equipo.marca ?? ''} ${o.equipo.modelo ?? ''}`.trim() || '-' : '-'}
                </td>
                <td>
                  <Badge bg="secondary">{o.equipo?.tipoEquipo?.nombre ?? 'Sin especificar'}</Badge>
                </td>
                <td>
                  <Badge className={ESTADO_BADGE_CLASS[o.estado]}>
                    {ESTADOS_ORDEN.find((e) => e.value === o.estado)?.label ?? o.estado}
                  </Badge>
                </td>
                <td>{formatearFecha(o.fechaIngreso)}</td>
                <td>{o.fechaPactada ? convertirDesdeBackend(o.fechaPactada) : '-'}</td>
                <td>
                  <Button as={Link as any} to={`/ordenes/${o.id}`} size="sm" variant="outline-primary">
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
            {ordenes.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  No hay órdenes en esta sucursal
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}
