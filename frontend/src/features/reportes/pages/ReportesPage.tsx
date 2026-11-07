import { ReactNode, useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Tab, Table, Tabs } from 'react-bootstrap';
import { useSearchParams } from 'react-router';
import { ArrowDownToLine, CircleCheck, PackageCheck, Timer } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { InformeVentas } from '@/features/ventas/components/InformeVentas';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { FechaFiltro } from '@/shared/components/FechaFiltro';
import { TarjetaDato } from '@/shared/components/TarjetaDato';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { descargarCsv } from '@/shared/utils/csv';
import { formatearMonto } from '@/shared/utils/dinero';
import { fechaLocalISO, haceDias } from '@/shared/utils/fechas';
import * as reportesApi from '../api';
import { OrdenesDelPeriodoModal } from '../components/OrdenesDelPeriodoModal';
import { TablaOrdenes } from '../components/TablaOrdenes';

/** Atajos de período, calculados en la fecha local del navegador. */
function periodo(clave: 'mes' | 'mes_pasado' | '30' | '90' | 'anio'): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = fechaLocalISO(hoy);
  switch (clave) {
    case 'mes':
      return { desde: fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta };
    case 'mes_pasado':
      return {
        desde: fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        hasta: fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0))
      };
    case 'anio':
      return { desde: fechaLocalISO(new Date(hoy.getFullYear(), 0, 1)), hasta };
    default:
      return { desde: haceDias(Number(clave) - 1), hasta };
  }
}

const nombreMes = (mes: string) => {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(anio, numero - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
};

function Seccion({
  titulo,
  onExportar,
  children
}: {
  titulo: ReactNode;
  onExportar?: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="h-100">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>{titulo}</span>
        {onExportar && (
          <Button size="sm" variant="link" className="p-0" onClick={onExportar}>
            Excel (CSV)
          </Button>
        )}
      </Card.Header>
      <Card.Body className="p-0">{children}</Card.Body>
    </Card>
  );
}

const SinDatos = () => <p className="text-muted small p-3 mb-0">Sin datos en el período.</p>;

type Seccion = 'reparaciones' | 'ventas';

/**
 * Reportes del período, en dos solapas con el mismo período y sucursales:
 * reparaciones (órdenes, tiempos, presupuestos, trabajo por usuario,
 * facturación y equipos abandonados) y ventas de equipos (bruto, costo y
 * ganancia). Cada tabla se puede bajar para abrir en Excel.
 */
export function ReportesPage() {
  const { esAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const seccion: Seccion = params.get('seccion') === 'ventas' ? 'ventas' : 'reparaciones';
  const [rango, setRango] = useState(() => periodo('30'));
  const [todas, setTodas] = useState(false);
  const verTodas = esAdmin && todas;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 className="mb-0">Reportes</h3>
        <Badge bg={verTodas ? 'primary' : 'secondary'}>
          {verTodas ? 'Todo el taller' : 'Sucursal actual'}
        </Badge>
      </div>

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col sm={3}>
              <FechaFiltro
                label="Desde"
                value={rango.desde}
                onChange={(desde) => setRango((p) => ({ ...p, desde }))}
              />
            </Col>
            <Col sm={3}>
              <FechaFiltro
                label="Hasta"
                value={rango.hasta}
                onChange={(hasta) => setRango((p) => ({ ...p, hasta }))}
              />
            </Col>
            <Col sm="auto" className="d-flex flex-wrap gap-2">
              {(
                [
                  ['mes', 'Este mes'],
                  ['mes_pasado', 'Mes pasado'],
                  ['30', '30 días'],
                  ['90', '90 días'],
                  ['anio', 'Este año']
                ] as const
              ).map(([clave, etiqueta]) => (
                <Button
                  key={clave}
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setRango(periodo(clave))}
                >
                  {etiqueta}
                </Button>
              ))}
            </Col>
            {esAdmin && (
              <Col sm="auto">
                <Form.Check
                  type="checkbox"
                  id="rep-todas"
                  label="Todas las sucursales"
                  checked={todas}
                  onChange={(e) => setTodas(e.target.checked)}
                />
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      <Tabs
        activeKey={seccion}
        onSelect={(clave) => setParams(clave === 'ventas' ? { seccion: 'ventas' } : {}, { replace: true })}
        className="mb-3"
        mountOnEnter
      >
        <Tab eventKey="reparaciones" title="Reparaciones">
          <ReporteReparaciones rango={rango} todasLasSucursales={verTodas} />
        </Tab>
        <Tab eventKey="ventas" title="Ventas de equipos">
          <InformeVentas desde={rango.desde} hasta={rango.hasta} todasLasSucursales={verTodas} />
        </Tab>
      </Tabs>
    </div>
  );
}

/** Órdenes del período. Los números de ingresadas y entregadas se tocan para ver cuáles fueron. */
function ReporteReparaciones({
  rango,
  todasLasSucursales
}: {
  rango: { desde: string; hasta: string };
  todasLasSucursales: boolean;
}) {
  const [listado, setListado] = useState<reportesApi.ListadoDelPeriodo | null>(null);
  const {
    datos: r,
    cargando,
    error
  } = useConsulta(
    () => reportesApi.obtenerReportes({ ...rango, todasLasSucursales }),
    [rango.desde, rango.hasta, todasLasSucursales],
    'No se pudieron cargar los reportes',
    'reportes'
  );

  const sufijo = `${rango.desde}_a_${rango.hasta}`;
  const conRespuesta = r ? r.presupuestos.aprobados + r.presupuestos.rechazados : 0;
  const tasa = r && conRespuesta > 0 ? Math.round((r.presupuestos.aprobados / conRespuesta) * 100) : null;

  return (
    <div>
      <AlertaError error={error} />

      {cargando && !r ? (
        <Cargando />
      ) : r ? (
        <>
          <Row xs={2} md={4} className="g-3 mb-3">
            <Col>
              <TarjetaDato
                titulo="Ingresaron"
                valor={r.ordenes.ingresadas}
                detalle="órdenes nuevas"
                icono={ArrowDownToLine}
                tono="cyan"
                onClick={() => setListado('ingresadas')}
                accion="Ver cuáles"
              />
            </Col>
            <Col>
              <TarjetaDato
                titulo="Entregados"
                valor={r.ordenes.entregadas}
                detalle={`${r.ordenes.canceladas} canceladas`}
                icono={PackageCheck}
                tono="green"
                onClick={() => setListado('entregadas')}
                accion="Ver cuáles"
              />
            </Col>
            <Col>
              <TarjetaDato
                titulo="Tiempo promedio"
                valor={
                  r.ordenes.diasPromedioReparacion != null ? `${r.ordenes.diasPromedioReparacion} días` : '—'
                }
                detalle="del ingreso a la entrega"
                icono={Timer}
                tono="amber"
              />
            </Col>
            <Col>
              <TarjetaDato
                titulo="Presupuestos aprobados"
                valor={tasa != null ? `${tasa}%` : '—'}
                detalle={`${r.presupuestos.aprobados} sí · ${r.presupuestos.rechazados} no · ${r.presupuestos.sinRespuesta} sin respuesta`}
                icono={CircleCheck}
                tono="violet"
              />
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col lg={6}>
              <Seccion
                titulo="Por tipo de equipo"
                onExportar={() =>
                  descargarCsv(
                    `por-tipo-de-equipo_${sufijo}`,
                    ['Tipo', 'Ingresaron', 'Entregados', 'Días promedio'],
                    r.porTipoDeEquipo.map((f) => [f.tipo, f.ingresadas, f.entregadas, f.diasPromedio])
                  )
                }
              >
                {r.porTipoDeEquipo.length === 0 ? (
                  <SinDatos />
                ) : (
                  <Table size="sm" responsive className="mb-0">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th className="text-end">Ingresaron</th>
                        <th className="text-end">Entregados</th>
                        <th className="text-end">Días prom.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.porTipoDeEquipo.map((f) => (
                        <tr key={f.tipo}>
                          <td>{f.tipo}</td>
                          <td className="text-end">{f.ingresadas}</td>
                          <td className="text-end">{f.entregadas}</td>
                          <td className="text-end">{f.diasPromedio ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Seccion>
            </Col>
            <Col lg={6}>
              <Seccion
                titulo="Por usuario"
                onExportar={() =>
                  descargarCsv(
                    `por-usuario_${sufijo}`,
                    ['Usuario', 'Recibió', 'Terminó', 'Entregó'],
                    r.porUsuario.map((f) => [f.usuario, f.recibidas, f.terminadas, f.entregadas])
                  )
                }
              >
                {r.porUsuario.length === 0 ? (
                  <SinDatos />
                ) : (
                  <Table size="sm" responsive className="mb-0">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th className="text-end" title="Órdenes que recibió en el mostrador">
                          Recibió
                        </th>
                        <th className="text-end" title="Órdenes que pasó a listas para retirar">
                          Terminó
                        </th>
                        <th className="text-end">Entregó</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.porUsuario.map((f) => (
                        <tr key={f.usuario}>
                          <td>{f.usuario}</td>
                          <td className="text-end">{f.recibidas}</td>
                          <td className="text-end">{f.terminadas}</td>
                          <td className="text-end">{f.entregadas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Seccion>
            </Col>
          </Row>

          <Row className="g-3">
            <Col lg={6}>
              <Seccion
                titulo="Facturado y cobrado por mes"
                onExportar={() =>
                  descargarCsv(
                    `facturacion_${sufijo}`,
                    ['Mes', 'Moneda', 'Facturado', 'Cobrado'],
                    r.facturacionPorMes.map((f) => [f.mes, f.moneda, f.facturado, f.cobrado])
                  )
                }
              >
                {r.facturacionPorMes.length === 0 ? (
                  <SinDatos />
                ) : (
                  <Table size="sm" responsive className="mb-0">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th className="text-end">Facturado</th>
                        <th className="text-end">Cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.facturacionPorMes.map((f) => (
                        <tr key={`${f.mes}-${f.moneda}`}>
                          <td className="text-capitalize">{nombreMes(f.mes)}</td>
                          <td className="text-end">{formatearMonto(f.facturado, f.moneda)}</td>
                          <td className="text-end text-success">{formatearMonto(f.cobrado, f.moneda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Seccion>
            </Col>
            <Col lg={6}>
              <Seccion
                titulo={
                  <>
                    Equipos sin retirar hace más de {r.abandonados.diasMinimos} días{' '}
                    <Badge bg="warning" text="dark">
                      {r.abandonados.total}
                    </Badge>
                  </>
                }
                onExportar={() =>
                  descargarCsv(
                    'equipos-abandonados',
                    ['Orden', 'Cliente', 'Teléfono', 'Equipo', 'Listo desde'],
                    r.abandonados.ordenes.map((o) => [
                      o.numeroOrden,
                      `${o.clienteNombre} ${o.clienteApellido}`,
                      o.clienteTelefono,
                      `${o.marca ?? ''} ${o.modelo ?? ''}`.trim(),
                      o.desde ? o.desde.slice(0, 10) : null
                    ])
                  )
                }
              >
                <TablaOrdenes
                  lista={r.abandonados}
                  columna="dias"
                  conWhatsApp
                  vacio="No hay equipos abandonados. Este listado no depende del período elegido."
                />
              </Seccion>
            </Col>
          </Row>
        </>
      ) : null}

      <OrdenesDelPeriodoModal
        cuales={listado}
        rango={rango}
        todasLasSucursales={todasLasSucursales}
        onCerrar={() => setListado(null)}
      />
    </div>
  );
}
