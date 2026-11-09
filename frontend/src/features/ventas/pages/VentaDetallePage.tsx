import { FormEvent, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import {
  describirEquipoStock,
  detalleCondicion,
  etiquetaNumero,
  textoAlmacenamiento
} from '@/features/stock/stock-form';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { DateInput } from '@/shared/components/DateInput';
import { ETIQUETA_MEDIO_PAGO, MEDIOS_PAGO } from '@/shared/constants/pagos';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { MedioPago, Venta } from '@/shared/types';
import { aNumero, formatearMonto, redondear } from '@/shared/utils/dinero';
import { convertirAFormatoBackend, formatearFecha, formatearFechaHora } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as ventasApi from '../api';
import { PagosEditor } from '../components/PagosEditor';
import {
  DIAS_AVISO_SENA,
  ETIQUETA_ESTADO_VENTA,
  VARIANTE_ESTADO_VENTA,
  PAGO_VACIO,
  cubiertoPor,
  diasDesde,
  pagosConSaldo,
  problemaDePago,
  type PagoForm
} from '../venta-form';

const TIPO_PAGO = { sena: 'Seña', pago: 'Pago', devolucion: 'Devolución' } as const;

/** Una venta: qué se llevó, qué dejó, qué pagó y lo que falta. */
export function VentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { esAdmin } = useAuth();
  const {
    datos: venta,
    setDatos,
    error: errorCarga
  } = useConsulta(() => ventasApi.obtenerVenta(Number(id)), [id], 'No se pudo cargar la venta');
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'pagar' | 'extender' | 'cancelar' | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  if (venta === undefined) return errorCarga ? <Alert variant="danger">{errorCarga}</Alert> : <Cargando />;

  const v = venta;
  const plata = (valor: number | string) => formatearMonto(valor, v.moneda);
  const abierta = v.estado === 'reservada' || v.estado === 'senada';
  const primeraSena = v.pagos.find((p) => p.tipo === 'sena')?.createdAt;
  const diasSenada = v.estado === 'senada' && primeraSena ? diasDesde(primeraSena) : 0;
  // Ganancia de la venta (solo admin, que es quien recibe los costos).
  const costoUsd = esAdmin ? v.items.reduce((t, i) => t + (i.equipo?.costoUsd ?? 0), 0) : null;
  const totalUsd = v.moneda === 'USD' ? aNumero(v.total) : aNumero(v.total) / aNumero(v.cotizacion || 1);

  async function descargarPdf() {
    await ejecutar(async () => {
      const url = URL.createObjectURL(await ventasApi.descargarPdf(v.id));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${v.etiqueta}.pdf`;
      enlace.click();
      // Se libera después: revocarla en el mismo instante cancela la descarga en Safari y Firefox.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, 'No se pudo descargar el comprobante');
  }

  function actualizada(nueva: Venta) {
    setDatos(nueva);
    setModal(null);
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="small">
        <Link to="/ventas">Ventas</Link>
      </div>
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        <h3 className="mb-0">{v.etiqueta}</h3>
        <Badge bg={VARIANTE_ESTADO_VENTA[v.estado]}>{ETIQUETA_ESTADO_VENTA[v.estado]}</Badge>
        <span className="text-muted small">
          {formatearFechaHora(v.createdAt)}
          {v.vendedor && ` · ${nombreCompleto(v.vendedor)}`}
          {v.sucursal && ` · ${v.sucursal.nombre}`}
        </span>
        <div className="ms-auto d-flex gap-2 flex-wrap">
          <Button variant="outline-secondary" onClick={descargarPdf} disabled={enCurso}>
            Comprobante PDF
          </Button>
          {abierta && <Button onClick={() => setModal('pagar')}>Cobrar</Button>}
        </div>
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      {v.estado === 'reservada' && v.reservadaHasta && (
        <Alert
          variant="primary"
          className="d-flex justify-content-between align-items-center flex-wrap gap-2"
        >
          <span>
            Reservado sin pago hasta el <strong>{formatearFecha(v.reservadaHasta)}</strong>. Si no paga, los
            equipos vuelven solos al stock.
          </span>
          <Button size="sm" variant="outline-primary" onClick={() => setModal('extender')}>
            Extender
          </Button>
        </Alert>
      )}
      {v.estado === 'senada' && (
        <Alert variant={diasSenada >= DIAS_AVISO_SENA ? 'danger' : 'warning'}>
          Señado hace {diasSenada} {diasSenada === 1 ? 'día' : 'días'}: los equipos quedan apartados hasta que
          pague el saldo o se cancele.
          {diasSenada >= DIAS_AVISO_SENA && ' Pasaron más de 15 días.'}
        </Alert>
      )}
      {v.estado === 'cancelada' && (
        <Alert variant="secondary">
          Cancelada el {formatearFechaHora(v.canceladaEn)}
          {v.canceladaPor && ` por ${nombreCompleto(v.canceladaPor)}`}: {v.motivoCancelacion}. Los equipos
          volvieron al stock.
        </Alert>
      )}
      {v.estado === 'anulada' && (
        <Alert variant="danger">
          Anulada el {formatearFechaHora(v.canceladaEn)}
          {v.canceladaPor && ` por ${nombreCompleto(v.canceladaPor)}`}: {v.motivoCancelacion}. Los equipos
          volvieron al stock
          {v.partesPago.length > 0 && ' y lo que dejó en parte de pago se le devolvió'}. No cuenta en el
          informe de ventas.
        </Alert>
      )}
      {v.estado === 'vencida' && (
        <Alert variant="secondary">La reserva venció y los equipos volvieron al stock.</Alert>
      )}

      <Row className="g-3">
        <Col lg={7} className="d-grid gap-3 align-content-start">
          <Card>
            <Card.Header>Cliente</Card.Header>
            <Card.Body>
              <div className="fw-semibold">{nombreCompleto(v.cliente)}</div>
              <div className="small text-muted">
                {[v.cliente.dniCuit && `DNI/CUIT ${v.cliente.dniCuit}`, v.cliente.telefono, v.cliente.email]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>{v.items.length > 1 ? 'Equipos que se lleva' : 'Equipo que se lleva'}</Card.Header>
            <Card.Body className="p-0">
              <Table className="mb-0 align-middle" responsive>
                <tbody>
                  {v.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.equipo && (
                          <>
                            <div className="fw-semibold">
                              <Link className="font-mono me-2" to={`/stock/${item.equipo.id}`}>
                                {etiquetaNumero(item.equipo.numero)}
                              </Link>
                              {describirEquipoStock(item.equipo)}
                            </div>
                            <div className="small text-muted">
                              {detalleCondicion(item.equipo)}
                              {item.equipo.imei && ` · IMEI ${item.equipo.imei}`}
                              {item.equipo.numeroSerie && ` · ${item.equipo.numeroSerie}`}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="text-end text-nowrap">
                        {plata(item.precio)}
                        {item.equipo?.costoUsd != null && (
                          <div className="small text-muted">
                            Costo {formatearMonto(item.equipo.costoUsd, 'USD')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {v.partesPago.length > 0 && (
            <Card>
              <Card.Header>Parte de pago</Card.Header>
              <Card.Body className="p-0">
                <Table className="mb-0 align-middle" responsive>
                  <tbody>
                    {v.partesPago.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="fw-semibold">
                            {[p.marca, p.modelo, textoAlmacenamiento(p.almacenamientoGb), p.color]
                              .filter(Boolean)
                              .join(' ')}
                          </div>
                          <div className="small text-muted">
                            {detalleCondicion(p)}
                            {p.imei && ` · IMEI ${p.imei}`}
                            {p.numeroSerie && ` · ${p.numeroSerie}`}
                          </div>
                          <div className="small">
                            {p.equipoStockId ? (
                              <Link to={`/stock/${p.equipoStockId}`}>
                                {v.estado === 'anulada'
                                  ? 'Se le devolvió (salió del stock)'
                                  : 'Entró al stock'}
                              </Link>
                            ) : (
                              <span className="text-muted">Entra al stock al completar la venta</span>
                            )}
                          </div>
                        </td>
                        <td className="text-end text-nowrap">- {plata(p.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}

          {(v.comentarioCliente || v.comentarioInterno) && (
            <Card>
              <Card.Header>Comentarios</Card.Header>
              <Card.Body>
                {v.comentarioCliente && (
                  <>
                    <div className="small text-muted">Para el cliente (va en el comprobante)</div>
                    <p style={{ whiteSpace: 'pre-line' }}>{v.comentarioCliente}</p>
                  </>
                )}
                {v.comentarioInterno && (
                  <>
                    <div className="small text-muted">Internos</div>
                    <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>
                      {v.comentarioInterno}
                    </p>
                  </>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col lg={5} className="d-grid gap-3 align-content-start">
          <Card>
            <Card.Header>Importe</Card.Header>
            <Card.Body>
              <dl className="row mb-0">
                {aNumero(v.descuento) > 0 && (
                  <>
                    <dt className="col-7 fw-normal text-muted">Subtotal</dt>
                    <dd className="col-5 text-end">{plata(v.subtotal)}</dd>
                    <dt className="col-7 fw-normal text-muted">
                      Descuento{v.descuentoTipo === 'porcentaje' && ` (${aNumero(v.descuentoValor)} %)`}
                    </dt>
                    <dd className="col-5 text-end">- {plata(v.descuento)}</dd>
                  </>
                )}
                <dt className="col-7">Total</dt>
                <dd className="col-5 text-end fw-semibold">{plata(v.total)}</dd>
                {aNumero(v.partePago) > 0 && (
                  <>
                    <dt className="col-7 fw-normal text-muted">Parte de pago</dt>
                    <dd className="col-5 text-end">- {plata(v.partePago)}</dd>
                  </>
                )}
                <dt className="col-7 fw-normal text-muted">Pagado</dt>
                <dd className="col-5 text-end">{plata(v.pagado)}</dd>
                {abierta && (
                  <>
                    <dt className="col-7 fs-5">Saldo</dt>
                    <dd className="col-5 text-end fs-5 fw-semibold mb-0">{plata(v.saldo)}</dd>
                  </>
                )}
              </dl>
              {v.cotizacion && (
                <div className="small text-muted mt-2">
                  Cotización: 1 US$ = {aNumero(v.cotizacion).toLocaleString('es-AR')} {v.moneda}
                </div>
              )}
              {costoUsd != null && v.estado === 'completada' && (
                <div className="small mt-2">
                  Ganancia {formatearMonto(redondear(totalUsd - costoUsd), 'USD')}{' '}
                  <span className="text-muted">(costo {formatearMonto(costoUsd, 'USD')})</span>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>Pagos</Card.Header>
            <Card.Body className="p-0">
              {v.pagos.length === 0 ? (
                <p className="text-muted p-3 mb-0">Sin pagos.</p>
              ) : (
                <Table size="sm" className="mb-0">
                  <tbody>
                    {v.pagos.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div>
                            {TIPO_PAGO[p.tipo]}
                            {p.medioPago && ` · ${ETIQUETA_MEDIO_PAGO[p.medioPago]}`}
                          </div>
                          <div className="small text-muted">
                            {formatearFechaHora(p.createdAt)}
                            {p.usuario && ` · ${nombreCompleto(p.usuario)}`}
                          </div>
                        </td>
                        <td
                          className={`text-end text-nowrap ${p.tipo === 'devolucion' ? 'text-danger' : ''}`}
                        >
                          {p.tipo === 'devolucion' ? '-' : ''}
                          {formatearMonto(p.monto, p.moneda)}
                          {p.moneda !== v.moneda && (
                            <div className="small text-muted">
                              = {plata(p.equivalente)}
                              {p.cotizacion &&
                                ` · 1 US$ = ${aNumero(p.cotizacion).toLocaleString('es-AR')} ${p.moneda === 'USD' ? v.moneda : p.moneda}`}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>

          {abierta && esAdmin && (
            <Button variant="outline-danger" onClick={() => setModal('cancelar')}>
              Cancelar {v.estado === 'reservada' ? 'la reserva' : 'la seña'}
            </Button>
          )}
          {v.estado === 'completada' && esAdmin && (
            <Button variant="outline-danger" onClick={() => setModal('cancelar')}>
              Anular la venta
            </Button>
          )}
        </Col>
      </Row>

      <PagarModal show={modal === 'pagar'} venta={v} onCerrar={() => setModal(null)} onHecho={actualizada} />
      <ExtenderModal
        show={modal === 'extender'}
        venta={v}
        onCerrar={() => setModal(null)}
        onHecho={actualizada}
      />
      <CancelarModal
        show={modal === 'cancelar'}
        venta={v}
        onCerrar={() => setModal(null)}
        onHecho={actualizada}
      />
    </div>
  );
}

interface ModalVentaProps {
  show: boolean;
  venta: Venta;
  onCerrar: () => void;
  onHecho: (venta: Venta) => void;
}

/** Cobrar sobre una reserva o una seña. Si cubre el saldo, la venta se completa. */
function PagarModal({ show, venta, onCerrar, onHecho }: ModalVentaProps) {
  const [pagos, setPagos] = useState<PagoForm[]>([PAGO_VACIO]);
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);
  const plata = (valor: number) => formatearMonto(valor, venta.moneda);
  // El único pago sin monto es lo que falta del saldo, igual que en la venta.
  const aPagar = pagosConSaldo(pagos, venta.saldo, venta.moneda);
  const monto = cubiertoPor(aPagar, venta.moneda);
  const problema = pagos.map((p) => problemaDePago(p, venta.moneda)).find(Boolean) ?? null;
  const completa = Math.abs(monto - venta.saldo) < 0.005;

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    let nueva: Venta | undefined;
    if (
      await ejecutar(
        async () => void (nueva = await ventasApi.pagarVenta(venta.id, aPagar)),
        'No se pudo cobrar'
      )
    ) {
      onHecho(nueva!);
      setPagos([PAGO_VACIO]);
    }
  }

  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Form onSubmit={confirmar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Cobrar {venta.etiqueta}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <p>
            Saldo: <strong>{plata(venta.saldo)}</strong>
          </p>
          <PagosEditor
            idPrefijo="cobro"
            value={pagos}
            onChange={setPagos}
            moneda={venta.moneda}
            cotizacionVenta={venta.cotizacion != null ? String(aNumero(venta.cotizacion)) : ''}
            saldo={venta.saldo}
          />
          <Form.Text className="text-muted d-block mt-2">
            {completa
              ? 'Cubre el saldo: la venta se completa y el cliente se lleva los equipos.'
              : 'Es menos que el saldo: queda como seña y los equipos siguen apartados.'}
          </Form.Text>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button type="submit" disabled={enCurso || Boolean(problema) || (monto <= 0 && venta.saldo > 0)}>
            {completa ? 'Cobrar y completar' : 'Registrar seña'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ExtenderModal({ show, venta, onCerrar, onHecho }: ModalVentaProps) {
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    const fecha = convertirAFormatoBackend(hasta);
    if (!fecha) {
      setError('La fecha no es válida.');
      return;
    }
    let nueva: Venta | undefined;
    if (
      await ejecutar(
        async () => void (nueva = await ventasApi.extenderReserva(venta.id, fecha)),
        'No se pudo extender'
      )
    ) {
      onHecho(nueva!);
    }
  }

  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Form onSubmit={confirmar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Extender la reserva</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <DateInput label="Nueva fecha" value={hasta} onChange={setHasta} required />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button type="submit" disabled={enCurso}>
            Extender
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/**
 * Solo admin. Una reserva o una seña se cancela; una venta completada se anula.
 * Ninguna se borra: queda cancelada o anulada, con el motivo.
 */
function CancelarModal({ show, venta, onCerrar, onHecho }: ModalVentaProps) {
  const [motivo, setMotivo] = useState('');
  const [devolver, setDevolver] = useState(true);
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);
  const anular = venta.estado === 'completada';
  const conPlata = venta.pagado > 0;
  const variasMonedas = new Set(venta.pagos.map((p) => p.moneda)).size > 1;

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    const datos = { motivo: motivo.trim(), medioDevolucion: medio };
    let nueva: Venta | undefined;
    const ok = await ejecutar(
      async () =>
        void (nueva = anular
          ? await ventasApi.anularVenta(venta.id, { ...datos, devolverPlata: conPlata && devolver })
          : await ventasApi.cancelarVenta(venta.id, { ...datos, devolverSena: conPlata && devolver })),
      anular ? 'No se pudo anular' : 'No se pudo cancelar'
    );
    if (ok) onHecho(nueva!);
  }

  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Form onSubmit={confirmar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">
            {anular ? 'Anular' : 'Cancelar'} {venta.etiqueta}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-grid gap-3">
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <p className="small text-muted mb-0">
            {anular ? (
              <>
                Los equipos vuelven al stock
                {venta.partesPago.length > 0 &&
                  ' y lo que dejó en parte de pago se le devuelve (sale del stock)'}
                . La venta no se borra: queda anulada con el motivo y deja de contar en el informe de ventas.
              </>
            ) : (
              'Los equipos vuelven al stock. La venta no se borra: queda cancelada con el motivo.'
            )}
          </p>
          <Form.Group controlId="cancelar-motivo">
            <Form.Label>Motivo</Form.Label>
            <Form.Control
              value={motivo}
              maxLength={255}
              onChange={(e) => setMotivo(e.target.value)}
              required
            />
          </Form.Group>
          {conPlata && (
            <div>
              <Form.Check
                type="switch"
                id="cancelar-devolver"
                label={`Devolver ${anular ? 'lo pagado' : 'la seña'} (${formatearMonto(venta.pagado, venta.moneda)})`}
                checked={devolver}
                onChange={(e) => setDevolver(e.target.checked)}
              />
              {devolver ? (
                <>
                  <Form.Select
                    className="mt-2"
                    aria-label="Medio de la devolución"
                    value={medio}
                    onChange={(e) => setMedio(e.target.value as MedioPago)}
                  >
                    {MEDIOS_PAGO.map((m) => (
                      <option key={m} value={m}>
                        {ETIQUETA_MEDIO_PAGO[m]}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Sale de la caja hoy
                    {variasMonedas && ', en las mismas monedas en que entró'}.
                  </Form.Text>
                </>
              ) : (
                <Form.Text className="text-muted">
                  El taller se queda con {anular ? 'lo que pagó' : 'la seña'}.
                </Form.Text>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button type="submit" variant="danger" disabled={enCurso || motivo.trim().length < 3}>
            {anular ? 'Anular venta' : 'Cancelar venta'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
