import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Col, Form, InputGroup, Modal, Row, Spinner } from 'react-bootstrap';
import { getApiErrorMessage } from '@/shared/api/client';
import { AlertaError } from '@/shared/components/AlertaError';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { ETIQUETA_MEDIO_PAGO, MEDIOS_PAGO } from '@/shared/constants/pagos';
import type { MedioPago, Moneda, Orden, SaldoEnMoneda } from '@/shared/types';
import { aNumero, formatearMonto, redondear } from '@/shared/utils/dinero';
import { nombreCompleto } from '@/shared/utils/texto';
import * as ordenesApi from '../api';
import { estaListoParaRetirar } from '../estado-orden';

/** Lo único que la pantalla necesita saber después de entregar. */
export interface ResultadoEntrega {
  saldoCliente: number;
  /** La moneda en que se cobró, que es la de los montos de acá. */
  moneda: Moneda;
  /** Cuánto saldo a favor se usó para cubrir la orden. */
  creditoAplicado?: number;
  notificacion?: ordenesApi.OrdenConNotificacion['notificacion'];
}

interface EntregaModalProps {
  orden: Orden;
  show: boolean;
  esAdmin: boolean;
  onCerrar: () => void;
  onEntregado: (resultado: ResultadoEntrega) => void;
  /** Se avisó que quedó un pedido esperando la firma de un supervisor. */
  onAutorizacionPedida: () => void;
}

/** Plata a favor del cliente en esa moneda: su saldo, si es negativo. */
function creditoEn(saldos: SaldoEnMoneda[] | undefined, moneda: Moneda): number {
  const saldo = saldos?.find((s) => s.moneda === moneda)?.saldo ?? 0;
  return saldo < 0 ? -saldo : 0;
}

/**
 * Entrega del equipo: el momento en que se cobra.
 *
 * Se pide confirmar el total además de lo abonado porque al retirar el precio
 * puede haber cambiado respecto del presupuesto (un repuesto de más, un
 * descuento), y lo que se cobra es esto, no lo que se presupuestó hace una semana.
 * Por lo mismo se puede cambiar la moneda: se presupuesta en dólares y se termina
 * cobrando en pesos. Lo que quede debiendo queda en la moneda en que se cobró.
 */
export function EntregaModal({
  orden,
  show,
  esAdmin,
  onCerrar,
  onEntregado,
  onAutorizacionPedida
}: EntregaModalProps) {
  const presupuesto = aNumero(orden.presupuestoMonto);

  const [moneda, setMoneda] = useState<Moneda>(orden.moneda);
  // Cuál de los precios cargados se eligió. El 0 es el de lista.
  const [precioElegido, setPrecioElegido] = useState<number | null>(0);
  const [montoTotal, setMontoTotal] = useState('');
  const [montoAbonado, setMontoAbonado] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [comentario, setComentario] = useState('');
  const [notaInterna, setNotaInterna] = useState('');
  const [forzar, setForzar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Cuando el cliente no tiene cuenta corriente, la salida es pedirle permiso a
  // un supervisor. Se pide el motivo porque es lo que esa persona va a leer.
  const [pidiendoAutorizacion, setPidiendoAutorizacion] = useState(false);
  const [motivo, setMotivo] = useState('');

  // Solo sirve el saldo a favor de la moneda en que se cobra: una no compensa la otra.
  const saldos = orden.saldosCliente;
  const creditoDisponible = creditoEn(saldos, moneda);
  const creditoDelPresupuesto = creditoEn(saldos, orden.moneda);
  const creditoEnOtraMoneda = saldos?.filter((s) => s.saldo < 0 && s.moneda !== moneda) ?? [];

  const opciones = [
    { etiqueta: 'Precio de lista', moneda: orden.moneda, monto: presupuesto, medioPago: null },
    ...(orden.precios ?? []).map((p) => ({
      etiqueta: p.medioPago ? ETIQUETA_MEDIO_PAGO[p.medioPago] : 'Otro precio',
      moneda: p.moneda,
      monto: aNumero(p.monto),
      medioPago: p.medioPago ?? null
    }))
  ];

  // Al abrir se arranca del presupuesto, con el saldo a favor ya descontado y el
  // resto cobrado: fiar tiene que ser un cambio deliberado sobre lo que ya está.
  useEffect(() => {
    if (!show) return;
    const inicial = presupuesto > 0 ? String(presupuesto) : '';
    setMoneda(orden.moneda);
    setPrecioElegido(0);
    setMontoTotal(inicial);
    setMontoAbonado(String(Math.max(0, presupuesto - Math.min(creditoDelPresupuesto, presupuesto))));
    setMedioPago('efectivo');
    setComentario('');
    setNotaInterna('');
    setForzar(false);
    setError(null);
    setPidiendoAutorizacion(false);
    setMotivo('');
  }, [show, presupuesto, creditoDelPresupuesto, orden.moneda]);

  /** Trae el precio elegido, con el saldo a favor de su moneda ya descontado. */
  function elegirPrecio(indice: number) {
    const opcion = opciones[indice];
    const credito = creditoEn(saldos, opcion.moneda);
    setPrecioElegido(indice);
    setMoneda(opcion.moneda);
    setMontoTotal(opcion.monto > 0 ? String(opcion.monto) : '');
    setMontoAbonado(String(Math.max(0, opcion.monto - Math.min(credito, opcion.monto))));
    if (opcion.medioPago) setMedioPago(opcion.medioPago);
  }

  // Los montos que había estaban en la otra moneda: dejarlos sería cobrar 100 pesos por 100 dólares.
  function cambiarMoneda(nueva: Moneda) {
    setPrecioElegido(null);
    setMoneda(nueva);
    setMontoTotal('');
    setMontoAbonado('');
  }

  const total = aNumero(montoTotal);
  const abonado = aNumero(montoAbonado);

  // El saldo a favor cubre lo que no se abona, antes de generar deuda nueva.
  // Mismo cálculo que `repartirEntrega` en el backend, para anticipar el resultado.
  const sinCubrir = Math.max(0, redondear(total - abonado));
  const creditoAplicado = Math.min(creditoDisponible, sinCubrir);
  const pendiente = redondear(sinCubrir - creditoAplicado);
  const aFavorRestante = redondear(creditoDisponible - creditoAplicado);

  const cuentaHabilitada = orden.cliente?.cuentaCorrienteHabilitada ?? false;
  const excedeTotal = abonado > total;
  const fiaSinCuenta = pendiente > 0 && !cuentaHabilitada;
  // Sin monto en otra moneda no se entrega: es un cambio de moneda a medio hacer.
  const faltaMonto = moneda !== orden.moneda && total <= 0;
  const puedeConfirmar =
    !excedeTotal &&
    !fiaSinCuenta &&
    !faltaMonto &&
    total >= 0 &&
    abonado >= 0 &&
    (!forzar || comentario.trim() !== '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const resultado = await ordenesApi.entregarOrden(orden.id, {
        montoTotal: total,
        montoAbonado: abonado,
        moneda,
        medioPago: abonado > 0 ? medioPago : null,
        comentario: comentario.trim() || null,
        notaInterna: notaInterna.trim() || null,
        forzar: forzar || undefined
      });
      onEntregado({ ...resultado, moneda });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo registrar la entrega'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleSolicitarAutorizacion() {
    setError(null);
    setGuardando(true);
    try {
      const resultado = await ordenesApi.solicitarFiado(orden.id, {
        montoTotal: total,
        montoAbonado: abonado,
        moneda,
        medioPago: abonado > 0 ? medioPago : null,
        motivo: motivo.trim()
      });
      // Un admin no espera su propia firma: la entrega ya quedó hecha.
      if (resultado.autorizada) {
        onEntregado({
          saldoCliente: resultado.saldoCliente ?? 0,
          moneda,
          creditoAplicado: resultado.creditoAplicado ?? 0,
          notificacion: resultado.notificacion
        });
        return;
      }
      onAutorizacionPedida();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo pedir la autorización'));
    } finally {
      setGuardando(false);
    }
  }

  const nombreCliente = nombreCompleto(orden.cliente) || 'el cliente';
  const m = (valor: number) => formatearMonto(valor, moneda);

  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Entregar equipo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} />

          <p className="text-muted small">
            Orden {orden.numeroOrden} · {nombreCliente}
          </p>

          {opciones.length > 1 && (
            <Form.Group className="mb-3">
              <Form.Label>¿Qué precio paga?</Form.Label>
              {opciones.map((opcion, indice) => (
                <Form.Check
                  key={indice}
                  type="radio"
                  id={`entrega-precio-${indice}`}
                  name="entrega-precio"
                  disabled={guardando}
                  checked={precioElegido === indice}
                  onChange={() => elegirPrecio(indice)}
                  label={`${opcion.etiqueta}: ${formatearMonto(opcion.monto, opcion.moneda)}`}
                />
              ))}
            </Form.Group>
          )}

          <Row className="g-2">
            <Col sm={6}>
              <Form.Group controlId="entrega-total">
                <Form.Label>Total a cobrar</Form.Label>
                <InputGroup>
                  <SelectorMoneda value={moneda} onChange={cambiarMoneda} disabled={guardando} />
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={montoTotal}
                    onChange={(e) => {
                      setPrecioElegido(null);
                      setMontoTotal(e.target.value);
                    }}
                    disabled={guardando}
                    isInvalid={faltaMonto}
                    autoFocus
                  />
                </InputGroup>
                {presupuesto > 0 && (
                  <Form.Text className="text-muted">
                    Presupuesto: {formatearMonto(presupuesto, orden.moneda)}
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group>
                <Form.Label>Abona ahora ({moneda})</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={montoAbonado}
                  onChange={(e) => setMontoAbonado(e.target.value)}
                  disabled={guardando}
                  isInvalid={excedeTotal}
                />
                <Form.Control.Feedback type="invalid">
                  No puede abonar más que el total.
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <div className="d-flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={guardando}
              onClick={() => setMontoAbonado(String(Math.max(0, total - Math.min(creditoDisponible, total))))}
            >
              {creditoDisponible > 0 ? 'Cancela la orden' : 'Paga todo'}
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={guardando}
              onClick={() => setMontoAbonado('0')}
            >
              No paga nada
            </Button>
          </div>

          {abonado > 0 && (
            <Form.Group className="mt-3">
              <Form.Label>Medio de pago</Form.Label>
              <Form.Select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                disabled={guardando}
              >
                {MEDIOS_PAGO.map((medio) => (
                  <option key={medio} value={medio}>
                    {ETIQUETA_MEDIO_PAGO[medio]}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          )}

          {creditoEnOtraMoneda.map((s) => (
            <Form.Text key={s.moneda} className="text-muted d-block mt-2">
              Tiene {formatearMonto(-s.saldo, s.moneda)} a favor, que no se aplican a un cobro en {moneda}.
            </Form.Text>
          ))}

          {creditoAplicado > 0 && (
            <Alert variant="success" className="mt-3 mb-0 py-2">
              Se aplican <strong>{m(creditoAplicado)}</strong> del saldo a favor de {nombreCliente}.
              {aFavorRestante > 0 && <> Le quedan {m(aFavorRestante)} a favor.</>}
            </Alert>
          )}

          {pendiente > 0 && !fiaSinCuenta && (
            <Alert variant="warning" className="mt-3 mb-0">
              Quedan <strong>{m(pendiente)}</strong> en la cuenta corriente de {nombreCliente}.
            </Alert>
          )}

          {fiaSinCuenta && (
            <Alert variant="warning" className="mt-3 mb-0">
              <p className="mb-2">
                {nombreCliente} no tiene cuenta corriente habilitada, así que no puede quedar debiendo{' '}
                {m(pendiente)}.
              </p>
              {pidiendoAutorizacion ? (
                <Form.Group>
                  <Form.Label className="small fw-semibold">¿Por qué habría que autorizarlo?</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: cliente habitual, paga el viernes"
                    disabled={guardando}
                    autoFocus
                  />
                  <Form.Text className="text-muted">
                    {esAdmin
                      ? 'Como administrador, al enviarlo la entrega se hace en el acto y queda registrado que la autorizaste.'
                      : 'Lo va a leer quien apruebe. El equipo se entrega recién cuando lo autoricen.'}
                  </Form.Text>
                </Form.Group>
              ) : (
                <Button
                  size="sm"
                  variant="outline-dark"
                  disabled={guardando}
                  onClick={() => setPidiendoAutorizacion(true)}
                >
                  Solicitar autorización a un supervisor
                </Button>
              )}
            </Alert>
          )}

          <Form.Group className="mt-3">
            <Form.Label>Comentario</Form.Label>
            <Form.Control
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={
                forzar ? 'Motivo de la entrega forzada (obligatorio)' : 'Opcional, sale en el remito'
              }
              disabled={guardando}
            />
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Notas internas</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={notaInterna}
              maxLength={2000}
              onChange={(e) => setNotaInterna(e.target.value)}
              placeholder="Opcional, no las ve el cliente"
              disabled={guardando}
            />
          </Form.Group>

          {esAdmin && !estaListoParaRetirar(orden.estado) && (
            <Form.Check
              type="checkbox"
              id="forzar-entrega"
              className="mt-2 small"
              label="Entregar aunque la orden no esté lista para retirar"
              checked={forzar}
              onChange={(e) => setForzar(e.target.checked)}
              disabled={guardando}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          {pidiendoAutorizacion ? (
            <Button
              type="button"
              variant="warning"
              disabled={guardando || motivo.trim() === ''}
              onClick={handleSolicitarAutorizacion}
            >
              {guardando ? (
                <Spinner size="sm" animation="border" />
              ) : esAdmin ? (
                'Autorizar y entregar'
              ) : (
                'Enviar solicitud'
              )}
            </Button>
          ) : (
            <Button type="submit" disabled={guardando || !puedeConfirmar}>
              {guardando ? <Spinner size="sm" animation="border" /> : 'Confirmar entrega'}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
