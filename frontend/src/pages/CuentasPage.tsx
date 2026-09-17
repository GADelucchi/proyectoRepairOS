import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import * as cuentasApi from '../api/cuentas';
import { CuentaResumen, MedioPago, MEDIOS_PAGO, ETIQUETA_MEDIO_PAGO } from '../types';
import { getApiErrorMessage } from '../api/client';
import { formatearMonto } from '../utils/formato';
import { formatearFechaHora } from '../utils/dateFormat';
import { ETIQUETA_MOVIMIENTO } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';

/**
 * Cuenta corriente: quién debe y cómo se le descuenta cuando paga.
 *
 * Por defecto solo lista a los que deben, que es la pregunta de todos los días.
 * El detalle de cada cuenta se abre en un modal con el historial completo y el
 * formulario de cobro, para no perder de vista el listado general.
 */
export function CuentasPage() {
  const [cuentas, setCuentas] = useState<CuentaResumen[]>([]);
  const [totalAdeudado, setTotalAdeudado] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const [incluirAlDia, setIncluirAlDia] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [clienteAbierto, setClienteAbierto] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await cuentasApi.listarCuentas({
        search: busquedaDebounced || undefined,
        todos: incluirAlDia
      });
      setCuentas(data.cuentas);
      setTotalAdeudado(data.totalAdeudado);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las cuentas'));
    } finally {
      setCargando(false);
    }
  }, [busquedaDebounced, incluirAlDia]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function handleCobrado(nombre: string, monto: number, saldo: number) {
    setClienteAbierto(null);
    setMensaje(
      saldo > 0
        ? `Cobro de ${formatearMonto(monto)} registrado. ${nombre} queda debiendo ${formatearMonto(saldo)}.`
        : `Cobro de ${formatearMonto(monto)} registrado. ${nombre} queda al día.`
    );
    cargar();
  }

  return (
    <div>
      <Row className="align-items-center mb-3 g-2">
        <Col md>
          <h2 className="mb-0">Cuenta corriente</h2>
        </Col>
        <Col md="auto">
          <Card body className="py-2">
            <div className="text-muted small">Total adeudado</div>
            <div className="fs-4 fw-semibold">{formatearMonto(totalAdeudado)}</div>
          </Card>
        </Col>
      </Row>

      {error && <Alert variant="danger">{error}</Alert>}
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      <Row className="align-items-center g-2 mb-3">
        <Col md={6}>
          <Form.Control
            placeholder="Buscar por nombre, DNI o teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Col>
        <Col md="auto">
          <Form.Check
            type="checkbox"
            id="incluir-al-dia"
            label="Mostrar también los que están al día"
            checked={incluirAlDia}
            onChange={(e) => setIncluirAlDia(e.target.checked)}
          />
        </Col>
      </Row>

      {cargando ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
      ) : cuentas.length === 0 ? (
        <Alert variant="light" className="border">
          {busqueda
            ? 'Ningún cliente coincide con la búsqueda.'
            : incluirAlDia
              ? 'Todavía no hay clientes con cuenta corriente ni movimientos.'
              : 'Nadie debe nada. Todas las cuentas están al día.'}
        </Alert>
      ) : (
        <Table hover responsive className="align-middle">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th className="text-end">Saldo</th>
              <th>Último movimiento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cuentas.map((cuenta) => (
              <tr key={cuenta.clienteId}>
                <td>
                  {cuenta.apellido}, {cuenta.nombre}
                  {!cuenta.cuentaCorrienteHabilitada && cuenta.saldo > 0 && (
                    <Badge bg="warning" text="dark" className="ms-2">
                      sin cuenta habilitada
                    </Badge>
                  )}
                </td>
                <td className="text-muted">{cuenta.telefono ?? '—'}</td>
                <td className="text-end">
                  {cuenta.saldo < 0 ? (
                    <span className="text-success fw-semibold">
                      {formatearMonto(Math.abs(cuenta.saldo))} a favor
                    </span>
                  ) : (
                    <span className={cuenta.saldo > 0 ? 'text-danger fw-semibold' : 'text-muted'}>
                      {formatearMonto(cuenta.saldo)}
                    </span>
                  )}
                </td>
                <td className="text-muted small">
                  {cuenta.ultimoMovimiento ? formatearFechaHora(cuenta.ultimoMovimiento) : '—'}
                </td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => setClienteAbierto(cuenta.clienteId)}
                  >
                    Ver cuenta
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {clienteAbierto !== null && (
        <DetalleCuentaModal
          clienteId={clienteAbierto}
          onCerrar={() => setClienteAbierto(null)}
          onCobrado={handleCobrado}
          onAjusteAplicado={cargar}
        />
      )}
    </div>
  );
}

interface DetalleCuentaModalProps {
  clienteId: number;
  onCerrar: () => void;
  onCobrado: (nombre: string, monto: number, saldo: number) => void;
  /** Un ajuste aplicado cambia el saldo, así que el listado de atrás se recarga. */
  onAjusteAplicado: () => void;
}

/** Historial de la cuenta de un cliente y el formulario para descontarle un pago. */
function DetalleCuentaModal({ clienteId, onCerrar, onCobrado, onAjusteAplicado }: DetalleCuentaModalProps) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [detalle, setDetalle] = useState<cuentasApi.DetalleCuenta | null>(null);
  const [mensajeAjuste, setMensajeAjuste] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monto, setMonto] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [nota, setNota] = useState('');
  const [cobrando, setCobrando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    cuentasApi
      .obtenerCuenta(clienteId)
      .then((data) => {
        if (!activo) return;
        setDetalle(data);
        // Se propone saldar la cuenta entera, que es lo más frecuente.
        setMonto(data.saldo > 0 ? String(data.saldo) : '');
      })
      .catch((err) => {
        if (activo) setError(getApiErrorMessage(err, 'No se pudo cargar la cuenta'));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [clienteId]);

  const saldo = detalle?.saldo ?? 0;
  const montoNumero = Number(monto.replace(',', '.'));
  const montoValido = Number.isFinite(montoNumero) && montoNumero > 0 && montoNumero <= saldo;

  async function handleCobrar(e: FormEvent) {
    e.preventDefault();
    if (!detalle) return;
    setError(null);
    setCobrando(true);
    try {
      const resultado = await cuentasApi.registrarCobro(clienteId, {
        monto: montoNumero,
        medioPago,
        nota: nota.trim() || null
      });
      onCobrado(`${detalle.cliente.nombre} ${detalle.cliente.apellido}`, montoNumero, resultado.saldo);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo registrar el cobro'));
    } finally {
      setCobrando(false);
    }
  }

  return (
    <Modal show onHide={onCerrar} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          {detalle ? `${detalle.cliente.nombre} ${detalle.cliente.apellido}` : 'Cuenta del cliente'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        {cargando ? (
          <div className="d-flex justify-content-center py-4">
            <Spinner animation="border" />
          </div>
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
                        <Form.Group>
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
                        <Form.Group>
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
                        <Form.Group>
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
              onListo={(aplicada, nuevoSaldo) => {
                if (aplicada && nuevoSaldo !== undefined) {
                  setDetalle((previo) => (previo ? { ...previo, saldo: nuevoSaldo } : previo));
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
                        {m.tipo === 'cargo' || m.tipo === 'ajuste_debito'
                          ? formatearMonto(Number(m.monto))
                          : ''}
                      </td>
                      <td className="text-end text-success">
                        {m.tipo === 'pago' || m.tipo === 'ajuste_credito'
                          ? formatearMonto(Number(m.monto))
                          : ''}
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

interface FormularioAjusteProps {
  clienteId: number;
  esAdmin: boolean;
  onListo: (aplicada: boolean, saldo?: number) => void;
}

/**
 * Pedido de ajuste sobre la cuenta.
 *
 * Corregir un saldo no es cobrar: no entró ni salió plata, cambia lo que el
 * cliente debe. Por eso cualquiera lo puede pedir pero solo un admin lo aplica,
 * y el motivo es obligatorio porque es lo único que va a leer quien apruebe.
 */
function FormularioAjuste({ clienteId, esAdmin, onListo }: FormularioAjusteProps) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState('');
  const [direccion, setDireccion] = useState<'debito' | 'credito'>('credito');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNumero = Number(monto.replace(',', '.'));
  const listo = Number.isFinite(montoNumero) && montoNumero > 0 && motivo.trim() !== '';

  async function handleEnviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const resultado = await cuentasApi.solicitarAjuste(clienteId, {
        monto: montoNumero,
        direccion,
        motivo: motivo.trim()
      });
      setAbierto(false);
      setMonto('');
      setMotivo('');
      onListo(resultado.aplicada, resultado.saldo);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo pedir el ajuste'));
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <Button size="sm" variant="outline-secondary" className="mt-3" onClick={() => setAbierto(true)}>
        {esAdmin ? 'Ajustar saldo' : 'Solicitar ajuste de saldo'}
      </Button>
    );
  }

  return (
    <Card className="mt-3">
      <Card.Header>{esAdmin ? 'Ajustar saldo' : 'Solicitar ajuste de saldo'}</Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form onSubmit={handleEnviar}>
          <Row className="g-2">
            <Col sm={4}>
              <Form.Group>
                <Form.Label>Monto</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  disabled={enviando}
                  autoFocus
                />
              </Form.Group>
            </Col>
            <Col sm={8}>
              <Form.Group>
                <Form.Label>Qué hace</Form.Label>
                <Form.Select
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value as 'debito' | 'credito')}
                  disabled={enviando}
                >
                  <option value="credito">Descontar de lo que debe (a favor del cliente)</option>
                  <option value="debito">Sumar a lo que debe</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mt-2">
            <Form.Label>Motivo</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se cargó de más el repuesto en la orden ORD-000012"
              disabled={enviando}
            />
            <Form.Text className="text-muted">
              {esAdmin
                ? 'Se aplica en el acto y queda registrado que lo autorizaste.'
                : 'Lo va a leer quien apruebe. El saldo cambia recién cuando lo autoricen.'}
            </Form.Text>
          </Form.Group>
          <div className="d-flex gap-2 mt-3">
            <Button type="submit" size="sm" disabled={enviando || !listo}>
              {enviando ? <Spinner size="sm" animation="border" /> : esAdmin ? 'Aplicar' : 'Enviar pedido'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
