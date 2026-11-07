import { Button, Card, Col, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import { CircleDollarSign, Package, Receipt, TrendingUp } from 'lucide-react';
import { textoAlmacenamiento } from '@/features/stock/stock-form';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { TarjetaDato } from '@/shared/components/TarjetaDato';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { descargarCsv } from '@/shared/utils/csv';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import * as ventasApi from '../api';

const usd = (valor: number) => formatearMonto(valor, 'USD');

interface InformeVentasProps {
  desde: string;
  hasta: string;
  todasLasSucursales: boolean;
}

/**
 * Informe de ventas de equipos (solo admin), en US$: cuántas ventas y equipos,
 * lo que se facturó (bruto), lo que costaron esos equipos y la ganancia. Cada
 * equipo vendido aporta su propio costo, con la cotización del día que se compró.
 * Va dentro de Reportes, con su mismo período.
 */
export function InformeVentas({ desde, hasta, todasLasSucursales }: InformeVentasProps) {
  const navigate = useNavigate();
  const {
    datos: informe,
    cargando,
    error
  } = useConsulta(
    () => ventasApi.obtenerInforme({ desde, hasta, todasLasSucursales }),
    [desde, hasta, todasLasSucursales],
    'No se pudo cargar el informe de ventas',
    'informe-ventas'
  );
  const r = informe?.resumen;

  function exportar() {
    if (!informe) return;
    descargarCsv(
      `ventas_${desde}_a_${hasta}`,
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

  if (cargando && !informe) return <Cargando />;
  return (
    <>
      <AlertaError error={error} />
      {r && (
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

          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Ventas completadas</span>
              <Button
                size="sm"
                variant="link"
                className="p-0"
                onClick={exportar}
                disabled={!informe.ventas.length}
              >
                Excel (CSV)
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <TablaApilable hover responsive className="mb-0 align-middle">
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
                            [e.marca, e.modelo, textoAlmacenamiento(e.almacenamientoGb)]
                              .filter(Boolean)
                              .join(' ')
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
            </Card.Body>
          </Card>
        </>
      )}
    </>
  );
}
