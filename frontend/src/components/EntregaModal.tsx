import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import * as ordenesApi from '../api/ordenes';
import { getApiErrorMessage } from '../api/client';
import { formatearMonto } from '../utils/formato';
import { Orden, MedioPago, MEDIOS_PAGO, ETIQUETA_MEDIO_PAGO } from '../types';

const aNumero = (texto: string): number => {
  const valor = Number(texto.replace(',', '.'));
  return Number.isFinite(valor) ? valor : 0;
};

/** Lo único que la pantalla necesita saber después de entregar. */
export interface ResultadoEntrega {
  saldoCliente: number;
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

/**
 * Entrega del equipo: el momento en que se cobra.
 *
 * Se pide confirmar el total además de lo abonado porque al retirar el precio
 * puede haber cambiado respecto del presupuesto (un repuesto de más, un
 * descuento), y lo que se cobra es esto, no lo que se presupuestó hace una semana.
 */
export function EntregaModal({
  orden,
  show,
  esAdmin,
  onCerrar,
  onEntregado,
  onAutorizacionPedida
}: EntregaModalProps) {
  const presupuesto = orden.presupuestoMonto != null ? Number(orden.presupuestoMonto) : 0;

  const [montoTotal, setMontoTotal] = useState('');
  const [montoAbonado, setMontoAbonado] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [comentario, setComentario] = useState('');
  const [forzar, setForzar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Cuando el cliente no tiene cuenta corriente, la salida es pedirle permiso a
  // un supervisor. Se pide el motivo porque es lo que esa persona va a leer.
  const [pidiendoAutorizacion, setPidiendoAutorizacion] = useState(false);
  const [motivo, setMotivo] = useState('');

  // Plata a favor del cliente: el saldo de su cuenta en negativo.
  const creditoDisponible = orden.saldoCliente != null && orden.saldoCliente < 0 ? -orden.saldoCliente : 0;

  // Al abrir se arranca del presupuesto, con el saldo a favor ya descontado y el
  // resto cobrado: fiar tiene que ser un cambio deliberado sobre lo que ya está.
  useEffect(() => {
    if (!show) return;
    const inicial = presupuesto > 0 ? String(presupuesto) : '';
    setMontoTotal(inicial);
    setMontoAbonado(String(Math.max(0, presupuesto - Math.min(creditoDisponible, presupuesto))));
    setMedioPago('efectivo');
    setComentario('');
    setForzar(false);
    setError(null);
    setPidiendoAutorizacion(false);
    setMotivo('');
  }, [show, presupuesto, creditoDisponible]);

  const total = aNumero(montoTotal);
  const abonado = aNumero(montoAbonado);

  // El saldo a favor cubre lo que no se abona, antes de generar deuda nueva.
  const sinCubrir = Math.max(0, Math.round((total - abonado) * 100) / 100);
  const creditoAplicado = Math.min(creditoDisponible, sinCubrir);
  const pendiente = Math.round((sinCubrir - creditoAplicado) * 100) / 100;
  const aFavorRestante = Math.round((creditoDisponible - creditoAplicado) * 100) / 100;

  const cuentaHabilitada = orden.cliente?.cuentaCorrienteHabilitada ?? false;
  const excedeTotal = abonado > total;
  const fiaSinCuenta = pendiente > 0 && !cuentaHabilitada;
  const puedeConfirmar =
    !excedeTotal && !fiaSinCuenta && total >= 0 && abonado >= 0 && (!forzar || comentario.trim() !== '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const resultado = await ordenesApi.entregarOrden(orden.id, {
        montoTotal: total,
        montoAbonado: abonado,
        medioPago: abonado > 0 ? medioPago : null,
        comentario: comentario.trim() || null,
        forzar: forzar || undefined
      });
      onEntregado(resultado);
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
        medioPago: abonado > 0 ? medioPago : null,
        motivo: motivo.trim()
      });
      // Un admin no espera su propia firma: la entrega ya quedó hecha.
      if (resultado.autorizada) {
        onEntregado({ saldoCliente: resultado.saldoCliente ?? 0, creditoAplicado: 0 });
        return;
      }
      onAutorizacionPedida();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo pedir la autorización'));
    } finally {
      setGuardando(false);
    }
  }

  const nombreCliente = orden.cliente ? `${orden.cliente.nombre} ${orden.cliente.apellido}` : 'el cliente';

  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Entregar equipo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <p className="text-muted small">
            Orden {orden.numeroOrden} · {nombreCliente}
          </p>

          <Row className="g-2">
            <Col sm={6}>
              <Form.Group>
                <Form.Label>Total a cobrar</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  value={montoTotal}
                  onChange={(e) => setMontoTotal(e.target.value)}
                  disabled={guardando}
                  autoFocus
                />
                {presupuesto > 0 && (
                  <Form.Text className="text-muted">Presupuesto: {formatearMonto(presupuesto)}</Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group>
                <Form.Label>Abona ahora</Form.Label>
                <Form.Control
                  type="number"
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

          {creditoAplicado > 0 && (
            <Alert variant="success" className="mt-3 mb-0 py-2">
              Se aplican <strong>{formatearMonto(creditoAplicado)}</strong> del saldo a favor de{' '}
              {nombreCliente}.
              {aFavorRestante > 0 && <> Le quedan {formatearMonto(aFavorRestante)} a favor.</>}
            </Alert>
          )}

          {pendiente > 0 && !fiaSinCuenta && (
            <Alert variant="warning" className="mt-3 mb-0">
              Quedan <strong>{formatearMonto(pendiente)}</strong> en la cuenta corriente de {nombreCliente}.
            </Alert>
          )}

          {fiaSinCuenta && (
            <Alert variant="warning" className="mt-3 mb-0">
              <p className="mb-2">
                {nombreCliente} no tiene cuenta corriente habilitada, así que no puede quedar debiendo{' '}
                {formatearMonto(pendiente)}.
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
              placeholder={forzar ? 'Motivo de la entrega forzada (obligatorio)' : 'Opcional'}
              disabled={guardando}
            />
          </Form.Group>

          {esAdmin && orden.estado !== 'listo_para_retirar' && (
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
