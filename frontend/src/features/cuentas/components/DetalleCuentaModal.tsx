import { FormEvent, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { esDebito, ETIQUETA_MEDIO_PAGO, ETIQUETA_MOVIMIENTO, MEDIOS_PAGO } from '@/shared/constants/pagos';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { MedioPago } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import { formatearFechaHora } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as cuentasApi from '../api';
import { FormularioAjuste } from './FormularioAjuste';

export interface DetalleCuentaModalProps {
  clienteId: number;
  onCerrar: () => void;
  onCobrado: (nombre: string, monto: number, saldo: number) => void;
  /** Un ajuste aplicado cambia el saldo, así que el listado de atrás se recarga. */
  onAjusteAplicado: () => void;
}

/** Historial de la cuenta de un cliente y el formulario para descontarle un pago. */
export function DetalleCuentaModal({
  clienteId,
  onCerrar,
  onCobrado,
  onAjusteAplicado
}: DetalleCuentaModalProps) {
  const { esAdmin } = useAuth();
  const [mensajeAjuste, setMensajeAjuste] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [nota, setNota] = useState('');

  const {
    datos: detalle,
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(
    async () => {
      const data = await cuentasApi.obtenerCuenta(clienteId);
      // Se propone saldar la cuenta entera, que es lo más frecuente.
      setMonto(data.saldo > 0 ? String(data.saldo) : '');
      return data;
    },
    [clienteId],
    'No se pudo cargar la cuenta'
  );
  const { enCurso: cobrando, ejecutar } = useAccion(setError);

  const saldo = detalle?.saldo ?? 0;
  const montoNumero = aNumero(monto);
  const montoValido = montoNumero > 0 && montoNumero <= saldo;

  async function handleCobrar(e: FormEvent) {
    e.preventDefault();
    if (!detalle) return;
    let saldoNuevo = 0;
    const ok = await ejecutar(async () => {
      const resultado = await cuentasApi.registrarCobro(clienteId, {
        monto: montoNumero,
        medioPago,
        nota: nota.trim() || null
      });
      saldoNuevo = resultado.saldo;
    }, 'No se pudo registrar el cobro');
    if (ok) onCobrado(nombreCompleto(detalle.cliente), montoNumero, saldoNuevo);
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
                <div className="text-muted small">{saldo < 0 ? 'Saldo a favor del cliente' : 'Saldo'}</div>
                <div
                  className={`fs-4 fw-semibold ${saldo > 0 ? 'text-danger' : saldo < 0 ? 'text-success' : ''}`}
                >
                  {formatearMonto(Math.abs(saldo))}
                </div>
              </div>
              {!detalle.cliente.cuentaCorrienteHabilitada && (
                <Badge bg="warning" text="dark">
                  Cuenta corriente no habilitada
                </Badge>
              )}
            </div>

            {saldo > 0 ? (
              <Card className="mb-3">
                <Card.Header>Registrar cobro</Card.Header>
                <Card.Body>
                  <Form onSubmit={handleCobrar}>
                    <Row className="g-2 align-items-end">
                      <Col sm={4}>
                        <Form.Group controlId="cobro-monto">
                          <Form.Label>Monto</Form.Label>
                          <Form.Control
                            type="number"
                            min={0}
                            step="0.01"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            disabled={cobrando}
                            isInvalid={monto !== '' && !montoValido}
                            autoFocus
                          />
                          <Form.Control.Feedback type="invalid">
                            Tiene que ser mayor a cero y no superar el saldo.
                          </Form.Control.Feedback>
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
                    <Button type="submit" className="mt-3" disabled={cobrando || !montoValido}>
                      {cobrando ? <Spinner size="sm" animation="border" /> : 'Registrar cobro'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            ) : (
              <Alert variant="success">
                {saldo < 0
                  ? `El cliente tiene ${formatearMonto(Math.abs(saldo))} a favor.`
                  : 'El cliente está al día.'}
              </Alert>
            )}

            <FormularioAjuste
              clienteId={clienteId}
              esAdmin={esAdmin}
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
                      <td className="text-end">{esDebito(m.tipo) ? formatearMonto(m.monto) : ''}</td>
                      <td className="text-end text-success">
                        {esDebito(m.tipo) ? '' : formatearMonto(m.monto)}
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
