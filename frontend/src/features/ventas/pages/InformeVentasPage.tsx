import { useState } from 'react';
import { Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { CircleDollarSign, Package, Receipt, TrendingUp } from 'lucide-react';
import { textoAlmacenamiento } from '@/features/stock/stock-form';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { FechaFiltro } from '@/shared/components/FechaFiltro';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { TarjetaDato } from '@/shared/components/TarjetaDato';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { descargarCsv } from '@/shared/utils/csv';
import { formatearMonto } from '@/shared/utils/dinero';
import { fechaLocalISO, formatearFecha } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import * as ventasApi from '../api';

const usd = (valor: number) => formatearMonto(valor, 'USD');

/** Primer día del mes de hoy, en la fecha del navegador. */
const inicioDelMes = () => `${fechaLocalISO().slice(0, 8)}01`;

/**
 * Informe de ventas de equipos (solo admin), en US$: cuántas ventas y equipos,
 * lo que se facturó (bruto), lo que costaron esos equipos y la ganancia. Cada
 * equipo vendido aporta su propio costo, con la cotización del día que se compró.
 */
export function InformeVentasPage() {
  const navigate = useNavigate();
  const [desde, setDesde] = useState(inicioDelMes);
  const [hasta, setHasta] = useState(fechaLocalISO);
  const [todas, setTodas] = useState(false);

  const {
    datos: informe,
    cargando,
    error
  } = useConsulta(
    () => ventasApi.obtenerInforme({ desde, hasta, todasLasSucursales: todas }),
    [desde, hasta, todas],
    'No se pudo cargar el informe'
  );
  const r = informe?.resumen;

  function exportar() {
    if (!informe) return;
    descargarCsv(
      `ventas-${desde}-a-${hasta}`,
      [
        'Venta',
        'Fecha',
        'Cliente',
        'Vendedor',
        'Equipos',
        'Moneda',
        'Total',
        'Cotización',
        'Bruto US$',
        'Costo US$',
        'Ganancia US$',
        'Parte de pago US$'
      ],
      informe.ventas.map((v) => [
        v.etiqueta,
        formatearFecha(v.completadaEn),
        v.cliente,
        v.vendedor,
        v.equipos
          .map((e) => [e.marca, e.modelo, textoAlmacenamiento(e.almacenamientoGb)].filter(Boolean).join(' '))
          .join(' + '),
        v.moneda,
        v.total,
        v.cotizacion,
        v.brutoUsd,
        v.costoUsd,
        v.gananciaUsd,
        v.partePagoUsd
      ])
    );
  }

  return (
    <div>
      <div className="small">
        <Link to="/ventas">Ventas</Link>
      </div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 className="mb-0">Informe de ventas</h3>
        {informe && (
          <Badge bg={informe.alcance === 'taller' ? 'primary' : 'secondary'}>
            {informe.alcance === 'taller' ? 'Todo el taller' : 'Sucursal actual'}
          </Badge>
        )}
      </div>

      <AlertaError error={error} />

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col sm={3}>
              <FechaFiltro label="Desde" value={desde} onChange={setDesde} />
            </Col>
            <Col sm={3}>
              <FechaFiltro label="Hasta" value={hasta} onChange={setHasta} />
            </Col>
            <Col sm="auto" className="d-flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => {
                  setDesde(inicioDelMes());
                  setHasta(fechaLocalISO());
                }}
              >
                Este mes
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => {
                  const hoy = new Date();
                  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                  setDesde(fechaLocalISO(anterior));
                  setHasta(fechaLocalISO(fin));
                }}
              >
                Mes anterior
              </Button>
            </Col>
            <Col sm="auto">
              <Form.Check
                type="checkbox"
                id="informe-todas"
                label="Todas las sucursales"
                checked={todas}
                onChange={(e) => setTodas(e.target.checked)}
              />
            </Col>
            <Col sm="auto" className="ms-sm-auto">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={exportar}
                disabled={!informe?.ventas.length}
              >
                Bajar a Excel
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {cargando && !informe ? (
        <Cargando />
      ) : r ? (
        <>
          <Row className="g-3 mb-3" xs={2} lg={4}>
            <Col>
              <TarjetaDato
                titulo="Ventas"
                valor={r.ventas}
                detalle={`${r.equipos} ${r.equipos === 1 ? 'equipo' : 'equipos'}`}
                icono={Receipt}
                tono="violet"
              />
            </Col>
            <Col>
              <TarjetaDato
                titulo="Bruto"
                valor={usd(r.brutoUsd)}
                detalle="Lo que se vendió"
                icono={CircleDollarSign}
                tono="blue"
              />
            </Col>
            <Col>
              <TarjetaDato
                titulo="Costo"
                valor={usd(r.costoUsd)}
                detalle="De los equipos vendidos"
                icono={Package}
                tono="amber"
              />
            </Col>
            <Col>
              <TarjetaDato
                titulo="Ganancia"
                valor={usd(r.gananciaUsd)}
                detalle={r.margen != null ? `${r.margen.toLocaleString('es-AR')} % del bruto` : undefined}
                icono={TrendingUp}
                tono="green"
              />
            </Col>
          </Row>
          {r.partePagoUsd > 0 && (
            <p className="small text-muted">
              Además se recibieron {usd(r.partePagoUsd)} en equipos como parte de pago: entraron al stock con
              ese costo y suman cuando se vendan.
            </p>
          )}

          <TablaApilable hover responsive className="align-middle">
            <thead>
              <tr>
                <th>Venta</th>
                <th>Cliente</th>
                <th>Equipos</th>
                <th className="text-end">Bruto</th>
                <th className="text-end">Costo</th>
                <th className="text-end">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {informe.ventas.map((v) => (
                <tr key={v.id} {...filaClickeable(() => navigate(`/ventas/${v.id}`))}>
                  <td>
                    <div className="font-mono">{v.etiqueta}</div>
                    <div className="small text-muted">{formatearFecha(v.completadaEn)}</div>
                  </td>
                  <td>
                    {v.cliente}
                    {v.vendedor && <div className="small text-muted">{v.vendedor}</div>}
                  </td>
                  <td className="small">
                    {v.equipos
                      .map((e) =>
                        [e.marca, e.modelo, textoAlmacenamiento(e.almacenamientoGb)].filter(Boolean).join(' ')
                      )
                      .join(' + ')}
                  </td>
                  <td className="text-end text-nowrap">
                    {usd(v.brutoUsd)}
                    {v.moneda !== 'USD' && (
                      <div className="small text-muted">{formatearMonto(v.total, v.moneda)}</div>
                    )}
                  </td>
                  <td className="text-end text-nowrap">{usd(v.costoUsd)}</td>
                  <td
                    className={`text-end text-nowrap fw-semibold ${v.gananciaUsd < 0 ? 'text-danger' : ''}`}
                  >
                    {usd(v.gananciaUsd)}
                  </td>
                </tr>
              ))}
              {informe.ventas.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted">
                    No hubo ventas completadas en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </TablaApilable>
        </>
      ) : null}
    </div>
  );
}
