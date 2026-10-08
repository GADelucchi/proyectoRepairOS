import type { ReactNode } from 'react';
import { Badge, Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { ESTADOS_ORDEN, ETIQUETA_ESTADO } from '@/features/ordenes/estado-orden';
import * as reportesApi from '@/features/reportes/api';
import { TablaOrdenes } from '@/features/reportes/components/TablaOrdenes';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { formatearMonto } from '@/shared/utils/dinero';
import { PrimerosPasos } from '../components/PrimerosPasos';

function Numero({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card body className="h-100">
      <div className="text-muted small">{titulo}</div>
      <div className="fs-3 fw-semibold">{children}</div>
    </Card>
  );
}

/**
 * Tablero de inicio de la sucursal: lo que hay que mirar al abrir el local.
 * Equipos listos para avisar, presupuestos sin respuesta y órdenes atrasadas.
 */
export function InicioPage() {
  const { usuario } = useAuth();
  const {
    datos: t,
    cargando,
    error
  } = useConsulta(reportesApi.obtenerTablero, [], 'No se pudo cargar el tablero');

  if (cargando && !t) return <Cargando />;
  if (!t) return <AlertaError error={error} />;

  const abiertas = Object.values(t.abiertasPorEstado).reduce((suma, n) => suma + (n ?? 0), 0);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 className="mb-0">Hola, {usuario?.nombre}</h3>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/escanear">
            Escanear QR
          </Link>
          <Link className="btn btn-primary" to="/ordenes/nueva" data-tour="nueva-orden">
            + Nueva orden
          </Link>
        </div>
      </div>

      <PrimerosPasos pasos={t.primerosPasos} />

      <Row xs={2} md={4} className="g-3 mb-3">
        <Col>
          <Numero titulo="Ingresaron hoy">{t.hoy.ingresadas}</Numero>
        </Col>
        <Col>
          <Numero titulo="Entregados hoy">{t.hoy.entregadas}</Numero>
        </Col>
        <Col>
          <Numero titulo="Cobrado hoy">
            {t.hoy.cobrado.length === 0
              ? formatearMonto(0, usuario?.taller?.moneda)
              : t.hoy.cobrado.map((c) => <div key={c.moneda}>{formatearMonto(c.total, c.moneda)}</div>)}
          </Numero>
        </Col>
        <Col>
          <Numero titulo="Órdenes abiertas">{abiertas}</Numero>
        </Col>
      </Row>

      {abiertas > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {ESTADOS_ORDEN.filter((e) => t.abiertasPorEstado[e]).map((estado) => (
            <Link key={estado} to={`/ordenes?estado=${estado}`} className="text-decoration-none">
              <Badge bg="secondary" className="fw-normal">
                {ETIQUETA_ESTADO[estado]}: <strong>{t.abiertasPorEstado[estado]}</strong>
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <Row className="g-3">
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header>
              Listos para retirar <Badge bg="success">{t.listasSinRetirar.total}</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <TablaOrdenes
                lista={t.listasSinRetirar}
                columna="dias"
                conWhatsApp
                vacio="No hay equipos esperando que los retiren."
              />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header>
              Presupuestos sin respuesta <Badge bg="info">{t.esperandoRespuesta.total}</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <TablaOrdenes
                lista={t.esperandoRespuesta}
                columna="dias"
                conWhatsApp
                vacio="Ningún presupuesto espera respuesta."
              />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header>
              Atrasadas <Badge bg="danger">{t.atrasadas.total}</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <TablaOrdenes
                lista={t.atrasadas}
                columna="pactada"
                vacio="Ninguna orden pasó su fecha pactada."
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
