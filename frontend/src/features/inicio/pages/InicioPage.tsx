import type { ReactNode } from 'react';
import { Badge, Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import {
  ArrowDownToLine,
  ClipboardList,
  HandCoins,
  Hourglass,
  PackageCheck,
  Plus,
  ScanLine,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { CLASE_BADGE_ESTADO, ESTADOS_ORDEN, ETIQUETA_ESTADO } from '@/features/ordenes/estado-orden';
import * as reportesApi from '@/features/reportes/api';
import { TablaOrdenes } from '@/features/reportes/components/TablaOrdenes';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TarjetaDato } from '@/shared/components/TarjetaDato';
import type { Tono } from '@/shared/constants/tonos';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { formatearMonto } from '@/shared/utils/dinero';
import { PrimerosPasos } from '../components/PrimerosPasos';

/** Encabezado de cada lista del tablero: ícono, título y cuántas hay. */
function TituloLista({
  icono: Icono,
  tono,
  total,
  children
}: {
  icono: LucideIcon;
  tono: Tono;
  total: number;
  children: ReactNode;
}) {
  return (
    <Card.Header className="d-flex align-items-center gap-2">
      <span className={`chip-icono chip-icono-sm tono-${tono}`}>
        <Icono size={16} aria-hidden="true" />
      </span>
      {children}
      <Badge className={`badge-${tono} ms-auto`}>{total}</Badge>
    </Card.Header>
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
  } = useConsulta(reportesApi.obtenerTablero, [], 'No se pudo cargar el tablero', 'tablero');

  if (cargando && !t) return <Cargando />;
  if (!t) return <AlertaError error={error} />;

  const abiertas = Object.values(t.abiertasPorEstado).reduce((suma, n) => suma + (n ?? 0), 0);
  const sucursal = usuario?.sucursales.find((s) => s.id === usuario.sucursalActualId);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h3 className="mb-0">Hola, {usuario?.nombre}</h3>
          <p className="pagina-subtitulo">
            Esto es lo que pasa hoy{sucursal ? ` en ${sucursal.nombre}` : ''}.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary d-inline-flex align-items-center gap-2" to="/escanear">
            <ScanLine size={16} aria-hidden="true" />
            Escanear QR
          </Link>
          <Link
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            to="/ordenes/nueva"
            data-tour="nueva-orden"
          >
            <Plus size={16} aria-hidden="true" />
            Nueva orden
          </Link>
        </div>
      </div>

      <PrimerosPasos pasos={t.primerosPasos} />

      <Row xs={2} md={4} className="g-3 mb-3">
        <Col>
          <TarjetaDato
            titulo="Ingresaron hoy"
            valor={t.hoy.ingresadas}
            detalle="equipos recibidos"
            icono={ArrowDownToLine}
            tono="cyan"
          />
        </Col>
        <Col>
          <TarjetaDato
            titulo="Entregados hoy"
            valor={t.hoy.entregadas}
            detalle="equipos retirados"
            icono={PackageCheck}
            tono="green"
          />
        </Col>
        <Col>
          <TarjetaDato
            titulo="Cobrado hoy"
            valor={
              t.hoy.cobrado.length === 0
                ? formatearMonto(0, usuario?.taller?.moneda)
                : t.hoy.cobrado.map((c) => <div key={c.moneda}>{formatearMonto(c.total, c.moneda)}</div>)
            }
            detalle="en caja"
            icono={HandCoins}
            tono="amber"
          />
        </Col>
        <Col>
          <TarjetaDato
            titulo="Órdenes abiertas"
            valor={abiertas}
            detalle="sin entregar ni cancelar"
            icono={ClipboardList}
            tono="violet"
          />
        </Col>
      </Row>

      {abiertas > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {ESTADOS_ORDEN.filter((e) => t.abiertasPorEstado[e]).map((estado) => (
            <Link key={estado} to={`/ordenes?estado=${estado}`} className="text-decoration-none">
              <Badge className={CLASE_BADGE_ESTADO[estado]}>
                {ETIQUETA_ESTADO[estado]}: <strong>{t.abiertasPorEstado[estado]}</strong>
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <Row className="g-3">
        <Col lg={4}>
          <Card className="h-100">
            <TituloLista icono={PackageCheck} tono="green" total={t.listasSinRetirar.total}>
              Listos para retirar
            </TituloLista>
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
            <TituloLista icono={Hourglass} tono="violet" total={t.esperandoRespuesta.total}>
              Presupuestos sin respuesta
            </TituloLista>
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
            <TituloLista icono={TriangleAlert} tono="red" total={t.atrasadas.total}>
              Atrasadas
            </TituloLista>
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
