import { FormEvent, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import { Link } from 'react-router';
import { useAuth, useMonedaDelTaller } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { MONEDA_POR_DEFECTO, MONEDAS } from '@/shared/constants/monedas';
import { esDebito, ETIQUETA_MEDIO_PAGO, ETIQUETA_MOVIMIENTO, MEDIOS_PAGO } from '@/shared/constants/pagos';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { MedioPago, Moneda, SaldoEnMoneda } from '@/shared/types';
import { aNumero, formatearMonto, redondear } from '@/shared/utils/dinero';
import { formatearFechaHora } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as cuentasApi from '../api';
import { FormularioAjuste } from './FormularioAjuste';

export interface DetalleCuentaModalProps {
  clienteId: number;
  onCerrar: () => void;
  /** `monedaCobro` es en la que entró la plata; `monedaDeuda`, la del saldo que queda. */
  onCobrado: (nombre: string, monto: number, monedaCobro: Moneda, saldo: number, monedaDeuda: Moneda) => void;
  /** Un ajuste aplicado cambia el saldo, así que el listado de atrás se recarga. */
  onAjusteAplicado: () => void;
}

/** Lo que debe en esa moneda (0 si no debe nada). */
const deudaEn = (saldos: SaldoEnMoneda[], moneda: Moneda) =>
  Math.max(0, saldos.find((s) => s.moneda === moneda)?.saldo ?? 0);

/**
 * Historial de la cuenta de un cliente y el formulario para descontarle un pago.
 * Cada moneda tiene su saldo: el cobro descuenta la deuda de la moneda elegida,
 * aunque el cliente la pague en otra (una deuda en dólares, con pesos).
 */
export function DetalleCuentaModal({
  clienteId,
  onCerrar,
  onCobrado,
  onAjusteAplicado
}: DetalleCuentaModalProps) {
  const { esAdmin } = useAuth();
  const monedaDelTaller = useMonedaDelTaller();
  const [mensajeAjuste, setMensajeAjuste] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>(monedaDelTaller);
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [nota, setNota] = useState('');
  const [pagaEnOtra, setPagaEnOtra] = useState(false);
  const [monedaPago, setMonedaPago] = useState<Moneda>(MONEDA_POR_DEFECTO);
  const [cotizacion, setCotizacion] = useState('');
  const [recibe, setRecibe] = useState('');

  const {
    datos: detalle,
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(
    async () => {
      const data = await cuentasApi.obtenerCuenta(clienteId);
      // Se propone saldar la deuda entera de la primera moneda que debe, que es lo más frecuente.
      const deudora = data.saldos.find((s) => s.saldo > 0);
      setMoneda(deudora?.moneda ?? monedaDelTaller);
      setMonto(deudora ? String(deudora.saldo) : '');
      return data;
    },
    [clienteId],
    'No se pudo cargar la cuenta'
  );
  const { enCurso: cobrando, ejecutar } = useAccion(setError);

  const saldos = detalle?.saldos ?? [];
  const monedasConDeuda = saldos.filter((s) => s.saldo > 0).map((s) => s.moneda);
  const deuda = deudaEn(saldos, moneda);
  const montoNumero = aNumero(monto);
  const montoValido = montoNumero > 0 && montoNumero <= deuda;
  const recibeNumero = aNumero(recibe);
  const puedeCobrar = montoValido && (!pagaEnOtra || recibeNumero > 0);

  // La cotización se lee contra la moneda local, gire para donde gire el pago.
  const deudaEnLocal = moneda === MONEDA_POR_DEFECTO;
  const monedaBase = deudaEnLocal ? monedaPago : moneda;
  const monedaOtra = deudaEnLocal ? moneda : monedaPago;
  const cotizacionNumero = aNumero(cotizacion);
  // Cuánto se paga por cada unidad de deuda.
  const factor = cotizacionNumero > 0 ? (deudaEnLocal ? 1 / cotizacionNumero : cotizacionNumero) : 0;

  const montoARecibe = (valor: string, porUnidad: number) =>
    porUnidad > 0 && aNumero(valor) > 0 ? String(redondear(aNumero(valor) * porUnidad)) : '';

  function cambiarMonto(valor: string) {
    setMonto(valor);
    if (pagaEnOtra) setRecibe(montoARecibe(valor, factor));
  }

  function cambiarRecibe(valor: string) {
    setRecibe(valor);
    if (factor > 0 && aNumero(valor) > 0) setMonto(String(redondear(aNumero(valor) / factor)));
  }

  function cambiarCotizacion(valor: string) {
    setCotizacion(valor);
    const nueva = aNumero(valor);
    if (nueva > 0) setRecibe(montoARecibe(monto, deudaEnLocal ? 1 / nueva : nueva));
  }

  /** La moneda local si se puede: es en la que casi siempre se paga una deuda en otra. */
  const monedaDePagoPara = (deudaEn: Moneda): Moneda =>
    deudaEn !== monedaDelTaller ? monedaDelTaller : MONEDAS.find((m) => m !== deudaEn)!;

  function reiniciarPagoEnOtra(deudaEn: Moneda) {
    setMonedaPago(monedaDePagoPara(deudaEn));
    setCotizacion('');
    setRecibe('');
  }

  function elegirMoneda(nueva: Moneda) {
    setMoneda(nueva);
    setMonto(String(deudaEn(saldos, nueva)));
    reiniciarPagoEnOtra(nueva);
  }

  function elegirMonedaPago(nueva: Moneda) {
    setMonedaPago(nueva);
    setCotizacion('');
    setRecibe('');
  }

  function alternarPagaEnOtra(activo: boolean) {
    setPagaEnOtra(activo);
    reiniciarPagoEnOtra(moneda);
  }

  async function handleCobrar(e: FormEvent) {
    e.preventDefault();
    if (!detalle) return;
    let saldoNuevo = 0;
    const cobro = pagaEnOtra
      ? { monto: recibeNumero, moneda: monedaPago, monedaDeuda: moneda, montoDeuda: montoNumero }
      : { monto: montoNumero, moneda };
    const ok = await ejecutar(async () => {
      const resultado = await cuentasApi.registrarCobro(clienteId, {
        ...cobro,
        medioPago,
        nota: nota.trim() || null
      });
      saldoNuevo = resultado.saldo;
    }, 'No se pudo registrar el cobro');
    if (ok) onCobrado(nombreCompleto(detalle.cliente), cobro.monto, cobro.moneda, saldoNuevo, moneda);
  }

  return (
    <Modal show onHide={onCerrar} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{detalle ? nombreCompleto(detalle.cliente) : 'Cuenta del cliente'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <AlertaError error={error} />

        {cargando && !detalle ? (
          <Cargando />
        ) : detalle ? (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div className="text-muted small">Saldo</div>
                {saldos.length === 0 ? (
                  <div className="fs-4 fw-semibold">{formatearMonto(0)}</div>
                ) : (
                  saldos.map((s) => (
                    <div
                      key={s.moneda}
                      className={`fs-4 fw-semibold ${s.saldo > 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {formatearMonto(Math.abs(s.saldo), s.moneda)}
                      {s.saldo < 0 && <span className="fs-6 fw-normal"> a favor</span>}
                    </div>
                  ))
                )}
              </div>
              {!detalle.cliente.cuentaCorrienteHabilitada && (
                <Badge bg="warning" text="dark">
                  Cuenta corriente no habilitada
                </Badge>
              )}
            </div>

            {monedasConDeuda.length > 0 ? (
              <Card className="mb-3">
                <Card.Header>Registrar cobro</Card.Header>
                <Card.Body>
                  <Form onSubmit={handleCobrar}>
                    <Row className="g-2 align-items-end">
                      <Col sm={4}>
                        <Form.Group controlId="cobro-monto">
                          <Form.Label>{pagaEnOtra ? 'Deuda que cancela' : 'Monto'}</Form.Label>
                          <InputGroup hasValidation>
                            <SelectorMoneda
                              value={moneda}
                              onChange={elegirMoneda}
                              opciones={monedasConDeuda}
                              disabled={cobrando}
                            />
                            <Form.Control
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              value={monto}
                              onChange={(e) => cambiarMonto(e.target.value)}
                              disabled={cobrando}
                              isInvalid={monto !== '' && !montoValido}
                              autoFocus
                            />
                            <Form.Control.Feedback type="invalid">
                              Tiene que ser mayor a cero y no superar lo que debe en {moneda}.
                            </Form.Control.Feedback>
                          </InputGroup>
                        </Form.Group>
                      </Col>
                      <Col sm={4}>
                        <Form.Group controlId="cobro-medio">
                          <Form.Label>Medio de pago</Form.Label>
                          <Form.Select
                            value={medioPago}
                            onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                            disabled={cobrando}
                          >
                            {MEDIOS_PAGO.map((medio) => (
                              <option key={medio} value={medio}>
                                {ETIQUETA_MEDIO_PAGO[medio]}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col sm={4}>
                        <Form.Group controlId="cobro-nota">
                          <Form.Label>Nota</Form.Label>
                          <Form.Control
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            placeholder="Opcional"
                            disabled={cobrando}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Form.Check
                      type="checkbox"
                      id="cobro-otra-moneda"
                      className="mt-3"
                      label="Paga en otra moneda"
                      checked={pagaEnOtra}
                      disabled={cobrando}
                      onChange={(e) => alternarPagaEnOtra(e.target.checked)}
                    />
                    {pagaEnOtra && (
                      <Row className="g-2 mt-1 align-items-end">
                        <Col sm={4}>
                          <Form.Group controlId="cobro-cotizacion">
                            <Form.Label>
                              Cotización (1 {monedaBase} en {monedaOtra})
                            </Form.Label>
                            <Form.Control
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              value={cotizacion}
                              disabled={cobrando}
                              onChange={(e) => cambiarCotizacion(e.target.value)}
                            />
                          </Form.Group>
                        </Col>
                        <Col sm={4}>
                          <Form.Group controlId="cobro-recibe">
                            <Form.Label>Lo que paga</Form.Label>
                            <InputGroup>
                              <SelectorMoneda
                                value={monedaPago}
                                onChange={elegirMonedaPago}
                                opciones={MONEDAS.filter((m) => m !== moneda)}
                                disabled={cobrando}
                              />
                              <Form.Control
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                value={recibe}
                                disabled={cobrando || cotizacionNumero <= 0}
                                onChange={(e) => cambiarRecibe(e.target.value)}
                              />
                            </InputGroup>
                          </Form.Group>
                        </Col>
                        <Col sm={4} className="small text-muted pb-2">
                          {recibeNumero > 0 &&
                            montoValido &&
                            `Entran ${formatearMonto(recibeNumero, monedaPago)} a la caja y baja ${formatearMonto(montoNumero, moneda)} de la deuda.`}
                        </Col>
                      </Row>
                    )}
                    <Button type="submit" className="mt-3" disabled={cobrando || !puedeCobrar}>
                      {cobrando ? <Spinner size="sm" animation="border" /> : 'Registrar cobro'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            ) : (
              <Alert variant="success">
                {saldos.length > 0
                  ? 'El cliente no debe nada: solo tiene saldo a favor.'
                  : 'El cliente está al día.'}
              </Alert>
            )}

            <FormularioAjuste
              clienteId={clienteId}
              esAdmin={esAdmin}
              monedaInicial={saldos[0]?.moneda ?? monedaDelTaller}
              onListo={(aplicada) => {
                // Un ajuste aplicado agrega un movimiento: se recarga la cuenta entera, no solo el saldo.
                if (aplicada) {
                  recargar();
                  onAjusteAplicado();
                }
                setMensajeAjuste(
                  aplicada
                    ? 'Ajuste aplicado.'
                    : 'Pedido enviado. Se aplica cuando un administrador lo apruebe.'
                );
              }}
            />
            {mensajeAjuste && (
              <Alert variant="info" className="mt-2 py-2 small">
                {mensajeAjuste}
              </Alert>
            )}

            <h6 className="text-muted">Movimientos</h6>
            {detalle.movimientos.length === 0 ? (
              <p className="text-muted">Todavía no hay movimientos en esta cuenta.</p>
            ) : (
              <Table size="sm" responsive className="align-middle">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th className="text-end">Debe</th>
                    <th className="text-end">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="text-muted small">{formatearFechaHora(m.createdAt)}</td>
                      <td className="small">
                        {m.orden ? (
                          <Link to={`/ordenes/${m.orden.id}`}>{m.orden.numeroOrden}</Link>
                        ) : (
                          <span>{ETIQUETA_MOVIMIENTO[m.tipo]}</span>
                        )}
                        {m.medioPago && ` · ${ETIQUETA_MEDIO_PAGO[m.medioPago]}`}
                        {m.nota && <div className="text-muted">{m.nota}</div>}
                        {m.usuario && (
                          <div className="text-muted">
                            {m.usuario.nombre} {m.usuario.apellido}
                          </div>
                        )}
                      </td>
                      <td className="text-end">
                        {esDebito(m.tipo) ? formatearMonto(m.monto, m.moneda) : ''}
                      </td>
                      <td className="text-end text-success">
                        {esDebito(m.tipo) ? '' : formatearMonto(m.monto, m.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
