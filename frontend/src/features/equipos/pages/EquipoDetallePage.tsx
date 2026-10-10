import { useState } from 'react';
import { Alert, Badge, Card, Col, Row } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router';
import * as ordenesApi from '@/features/ordenes/api';
import { EstadoBadge } from '@/features/ordenes/components/EstadoBadge';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { formatearFecha } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as equiposApi from '../api';
import { EtiquetaQr } from '../components/EtiquetaQr';

/**
 * Ficha de un equipo: es adonde lleva el QR de la etiqueta.
 *
 * Muestra los datos del equipo, su dueño y las órdenes que tuvo en la sucursal
 * activa (las órdenes se ven desde la sucursal que las recibió). Las
 * credenciales no se muestran acá: se revelan desde la orden o el listado, y
 * cada consulta queda auditada.
 */
export function EquipoDetallePage() {
  const id = Number(useParams<{ id: string }>().id);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    datos,
    cargando,
    error: errorCarga
  } = useConsulta(
    async () => {
      const [equipo, ordenes] = await Promise.all([
        equiposApi.obtenerEquipo(id),
        ordenesApi.listarOrdenes({ equipoId: id })
      ]);
      return { equipo, ordenes };
    },
    [id],
    'No se pudo cargar el equipo',
    'equipo'
  );

  if (cargando && !datos) return <Cargando />;
  if (!datos) return <Alert variant="danger">{errorCarga ?? 'Equipo no encontrado'}</Alert>;

  const { equipo, ordenes } = datos;
  const nombre = `${equipo.marca ?? ''} ${equipo.modelo ?? ''}`.trim() || 'Equipo';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h3 className="mb-0 font-mono">{nombre}</h3>
          <Badge bg="secondary" className="mt-1">
            {equipo.tipoEquipo?.nombre ?? 'Sin especificar'}
          </Badge>
        </div>
        <Link className="btn btn-outline-secondary" to="/equipos">
          Volver
        </Link>
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      <Row className="g-3">
        <Col md={8}>
          <Card className="h-100">
            <Card.Header>Datos del equipo</Card.Header>
            <Card.Body>
              <div>Marca: {equipo.marca ?? '-'}</div>
              <div>Modelo: {equipo.modelo ?? '-'}</div>
              <div>Color: {equipo.color ?? '-'}</div>
              <div>
                Nº de serie: <span className="font-mono">{equipo.numeroSerie ?? '-'}</span>
              </div>
              <hr className="my-2" />
              <div>Dueño: {nombreCompleto(equipo.cliente) || '-'}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Header>Etiqueta QR</Card.Header>
            <Card.Body>
              <EtiquetaQr equipo={equipo} onError={setError} />
            </Card.Body>
          </Card>
        </Col>
        <Col md={12}>
          <Card>
            <Card.Header>Órdenes en esta sucursal</Card.Header>
            <Card.Body className="p-0">
              {ordenes.length === 0 ? (
                <p className="text-muted p-3 mb-0">Este equipo no tiene órdenes en esta sucursal.</p>
              ) : (
                <TablaApilable hover responsive size="sm" className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Nº orden</th>
                      <th>Estado</th>
                      <th>Ingreso</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((o) => (
                      <tr key={o.id} {...filaClickeable(() => navigate(`/ordenes/${o.id}`))}>
                        <td className="font-mono">{o.numeroOrden}</td>
                        <td>
                          <EstadoBadge estado={o.estado} />
                        </td>
                        <td>{formatearFecha(o.fechaIngreso)}</td>
                        <td className="text-end">
                          <Link className="btn btn-sm btn-outline-primary" to={`/ordenes/${o.id}`}>
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TablaApilable>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
