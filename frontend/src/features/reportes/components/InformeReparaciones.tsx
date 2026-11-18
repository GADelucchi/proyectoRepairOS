import { Alert, Button, Card, Col, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import { CircleDollarSign, Package, Truck, TrendingUp } from 'lucide-react';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { TarjetaDato } from '@/shared/components/TarjetaDato';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { descargarCsv } from '@/shared/utils/csv';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import * as reportesApi from '../api';

interface InformeReparacionesProps {
  desde: string;
  hasta: string;
  todasLasSucursales: boolean;
}

const usd = (valor: number) => formatearMonto(valor, 'USD');

/**
 * Costo y ganancia de las reparaciones entregadas en el período (solo admin),
 * en US$: lo cobrado, los repuestos (al costo de su entrada, también los que se
 * perdieron) y lo que cobró el taller externo. Una orden cobrada en pesos sin
 * cotización no se puede pasar a dólares: se avisa y no suma.
 */
export function InformeReparaciones({ desde, hasta, todasLasSucursales }: InformeReparacionesProps) {
  const navigate = useNavigate();
  const {
    datos: informe,
    cargando,
    error
  } = useConsulta(
    () => reportesApi.obtenerInformeReparaciones({ desde, hasta, todasLasSucursales }),
    [desde, hasta, todasLasSucursales],
    'No se pudo cargar el informe de reparaciones',
    'informe-reparaciones'
  );
  const r = informe?.resumen;

  function exportar() {
    if (!informe) return;
    descargarCsv(
      `reparaciones_${desde}_a_${hasta}`,
      [
        'Orden',
        'Entregada',
        'Cliente',
        'Equipo',
        'Trabajo',
        'Moneda',
        'Cobrado',
        'Cotización',
        'Cobrado US$',
        'Repuestos US$',
        'Perdidos US$',
        'Externo US$',
        'Ganancia US$',
        'Margen %'
      ],
      informe.ordenes.map((o) => [
        o.numeroOrden,
        formatearFecha(o.fechaEntrega),
        o.cliente,
        o.equipo,
        o.trabajo,
        o.moneda,
        o.cobrado,
        o.cotizacion,
        o.cobradoUsd,
        o.repuestosUsd,
        o.perdidosUsd,
        o.externoUsd,
        o.gananciaUsd,
        o.margen
      ])
    );
  }

  if (cargando && !informe) return <Cargando />;
  return (
    <>
      <AlertaError error={error} />
      {r && (
        <Row className="g-3 mb-3" xs={2} lg={4}>
          <Col>
            <TarjetaDato
              titulo="Cobrado"
              valor={usd(r.cobradoUsd)}
              detalle={`${r.entregadas} ${r.entregadas === 1 ? 'orden entregada' : 'órdenes entregadas'}`}
              icono={CircleDollarSign}
              tono="blue"
            />
          </Col>
          <Col>
            <TarjetaDato
              titulo="Repuestos"
              valor={usd(r.repuestosUsd)}
              detalle={r.perdidosUsd > 0 ? `${usd(r.perdidosUsd)} se perdieron` : 'Al costo de cada entrada'}
              icono={Package}
              tono="amber"
            />
          </Col>
          <Col>
            <TarjetaDato titulo="Talleres externos" valor={usd(r.externoUsd)} icono={Truck} tono="cyan" />
          </Col>
          <Col>
            <TarjetaDato
              titulo="Ganancia"
              valor={usd(r.gananciaUsd)}
              detalle={r.margen != null ? `${r.margen.toLocaleString('es-AR')} % de lo cobrado` : undefined}
              icono={TrendingUp}
              tono="green"
            />
          </Col>
        </Row>
      )}
      {r && r.sinCotizacion > 0 && (
        <Alert variant="warning">
          {r.sinCotizacion === 1 ? 'Una orden se cobró' : `${r.sinCotizacion} órdenes se cobraron`} en otra
          moneda sin cotización y no {r.sinCotizacion === 1 ? 'suma' : 'suman'} a los totales. Entrá a cada
          una y cargala en &quot;Costo y ganancia&quot;.
        </Alert>
      )}
      {informe && (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <span>Órdenes entregadas</span>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={exportar}
              disabled={informe.ordenes.length === 0}
            >
              Descargar Excel
            </Button>
          </Card.Header>
          <TablaApilable hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Equipo y trabajo</th>
                <th className="text-end">Cobrado</th>
                <th className="text-end">Repuestos</th>
                <th className="text-end">Externo</th>
                <th className="text-end">Ganancia</th>
                <th className="text-end">Margen</th>
              </tr>
            </thead>
            <tbody>
              {informe.ordenes.map((o) => (
                <tr key={o.id} {...filaClickeable(() => navigate(`/ordenes/${o.id}`))}>
                  <td>
                    <span className="font-mono">{o.numeroOrden}</span>
                    <div className="small text-muted">{formatearFecha(o.fechaEntrega)}</div>
                  </td>
                  <td>
                    {o.equipo ?? '—'}
                    <div className="small text-muted">{o.trabajo}</div>
                  </td>
                  <td className="text-end text-nowrap">
                    {o.cobradoUsd != null ? (
                      usd(o.cobradoUsd)
                    ) : (
                      <span className="badge badge-amber">Sin cotización</span>
                    )}
                    {o.moneda !== 'USD' && (
                      <div className="small text-muted">
                        {formatearMonto(o.cobrado, o.moneda)}
                        {o.cotizacion != null && ` · cot. ${o.cotizacion}`}
                      </div>
                    )}
                  </td>
                  <td className="text-end text-nowrap">
                    {o.repuestosUsd > 0 ? usd(o.repuestosUsd) : '—'}
                    {o.perdidosUsd > 0 && (
                      <div className="small text-danger">{usd(o.perdidosUsd)} perdido</div>
                    )}
                  </td>
                  <td className="text-end text-nowrap">{o.externoUsd > 0 ? usd(o.externoUsd) : '—'}</td>
                  <td className="text-end text-nowrap fw-semibold">
                    {o.gananciaUsd != null ? usd(o.gananciaUsd) : '—'}
                  </td>
                  <td className="text-end text-nowrap">
                    {o.margen != null ? `${o.margen.toLocaleString('es-AR')} %` : '—'}
                  </td>
                </tr>
              ))}
              {informe.ordenes.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted">
                    No se entregaron órdenes en el período
                  </td>
                </tr>
              )}
            </tbody>
          </TablaApilable>
        </Card>
      )}
    </>
  );
}
