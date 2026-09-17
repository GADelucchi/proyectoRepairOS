import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Image,
  ListGroup,
  Row,
  Spinner,
  Stack
} from 'react-bootstrap';
import * as ordenesApi from '../api/ordenes';
import * as equiposApi from '../api/equipos';
import { Orden, EstadoOrden, ESTADOS_ORDEN, Equipo, transicionesDesde, esEstadoFinal } from '../types';
import { getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SignaturePad } from '../components/SignaturePad';
import { ImageUploader } from '../components/ImageUploader';
import { ChecklistEditor, ChequeoItem } from '../components/ChecklistEditor';
import { EntregaModal, ResultadoEntrega } from '../components/EntregaModal';
import { formatearMonto } from '../utils/formato';
import { DateInput } from '../components/DateInput';
import { ESTADO_BADGE_CLASS } from '../estadoColors';
import { formatearFechaHora, convertirDesdeBackend, convertirAFormatoBackend } from '../utils/dateFormat';

const etiquetaDe = (estado: EstadoOrden) => ESTADOS_ORDEN.find((e) => e.value === estado)?.label ?? estado;

export function OrdenDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [orden, setOrden] = useState<Orden | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [equipoRevelado, setEquipoRevelado] = useState<Equipo | null>(null);

  const [nuevoEstado, setNuevoEstado] = useState<EstadoOrden | ''>('');
  const [comentarioEstado, setComentarioEstado] = useState('');
  const [forzarEstado, setForzarEstado] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const [presupuestoMonto, setPresupuestoMonto] = useState('');
  const [guardandoPresupuesto, setGuardandoPresupuesto] = useState(false);

  const [entregando, setEntregando] = useState(false);

  const [imagenesNuevas, setImagenesNuevas] = useState<File[]>([]);
  const [subiendoImagenes, setSubiendoImagenes] = useState(false);

  const [guardandoFirma, setGuardandoFirma] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  // Edición de los datos de la orden
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [formDatos, setFormDatos] = useState({
    detallesEsteticos: '',
    reparacionSolicitada: '',
    notasInternas: '',
    fechaPactada: ''
  });
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  // Edición del checklist
  const [editandoChequeos, setEditandoChequeos] = useState(false);
  const [chequeosEdit, setChequeosEdit] = useState<ChequeoItem[]>([]);
  const [guardandoChequeos, setGuardandoChequeos] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    setError(null);
    try {
      const data = await ordenesApi.obtenerOrden(Number(id));
      setOrden(data);
      setPresupuestoMonto(data.presupuestoMonto != null ? String(data.presupuestoMonto) : '');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar la orden'));
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const bloqueada = orden ? esEstadoFinal(orden.estado) : false;
  const puedeEditar = !bloqueada || esAdmin;
  // `entregado` no está en el desplegable: entregar mueve plata y va por su
  // propio flujo, que registra cuánto se cobró.
  const estadosPosibles = (
    orden
      ? forzarEstado && esAdmin
        ? ESTADOS_ORDEN.map((e) => e.value).filter((e) => e !== orden.estado)
        : transicionesDesde(orden.estado)
      : []
  ).filter((estado) => estado !== 'entregado');

  const puedeEntregar = orden
    ? orden.estado !== 'entregado' && (orden.estado === 'listo_para_retirar' || esAdmin)
    : false;

  /** Muestra lo que realmente pasó con el aviso al cliente, no un texto fijo. */
  function informarNotificacion(
    base: string,
    notificacion?: ordenesApi.OrdenConNotificacion['notificacion']
  ) {
    setMensaje(notificacion ? `${base} ${notificacion.detalle}` : base);
  }

  async function toggleRevelarEquipo() {
    if (!orden) return;
    if (equipoRevelado) {
      setEquipoRevelado(null);
      return;
    }
    try {
      setEquipoRevelado(await equiposApi.obtenerEquipo(orden.equipoId, true));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron revelar los datos del equipo'));
    }
  }

  async function handleCambiarEstado() {
    if (!orden || !nuevoEstado) return;
    setCambiandoEstado(true);
    setError(null);
    try {
      const actualizada = await ordenesApi.cambiarEstadoOrden(
        orden.id,
        nuevoEstado,
        comentarioEstado || undefined,
        forzarEstado || undefined
      );
      setComentarioEstado('');
      setNuevoEstado('');
      setForzarEstado(false);
      informarNotificacion('Estado actualizado.', actualizada.notificacion);
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cambiar el estado'));
    } finally {
      setCambiandoEstado(false);
    }
  }

  function handleEntregado(resultado: ResultadoEntrega) {
    setEntregando(false);
    const saldo = resultado.saldoCliente;
    const credito = resultado.creditoAplicado ?? 0;

    const base =
      saldo > 0
        ? `Equipo entregado. El cliente queda debiendo ${formatearMonto(saldo)}.`
        : saldo < 0
          ? `Equipo entregado. Le quedan ${formatearMonto(Math.abs(saldo))} a favor.`
          : 'Equipo entregado y cobrado.';

    informarNotificacion(
      credito > 0 ? `${base} Se aplicaron ${formatearMonto(credito)} de saldo a favor.` : base,
      resultado.notificacion
    );
    cargar();
  }

  function handleAutorizacionPedida() {
    setEntregando(false);
    setMensaje(
      'Pedido enviado. El equipo se entrega cuando un supervisor lo autorice; podés seguirlo en Autorizaciones.'
    );
    cargar();
  }

  async function handleGuardarPresupuesto(aprobado?: boolean) {
    if (!orden) return;
    setGuardandoPresupuesto(true);
    setError(null);
    try {
      const actualizada = await ordenesApi.actualizarPresupuesto(orden.id, {
        monto: presupuestoMonto ? Number(presupuestoMonto) : null,
        aprobado
      });
      informarNotificacion('Presupuesto actualizado.', actualizada.notificacion);
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar el presupuesto'));
    } finally {
      setGuardandoPresupuesto(false);
    }
  }

  function abrirEdicionDatos() {
    if (!orden) return;
    setFormDatos({
      detallesEsteticos: orden.detallesEsteticos ?? '',
      reparacionSolicitada: orden.reparacionSolicitada ?? '',
      notasInternas: orden.notasInternas ?? '',
      fechaPactada: convertirDesdeBackend(orden.fechaPactada)
    });
    setErrorFecha(null);
    setEditandoDatos(true);
  }

  async function handleGuardarDatos() {
    if (!orden) return;
    if (errorFecha) {
      setError('Revisá la fecha pactada antes de guardar.');
      return;
    }
    if (!formDatos.reparacionSolicitada.trim()) {
      setError('La reparación solicitada no puede quedar vacía.');
      return;
    }
    setGuardandoDatos(true);
    setError(null);
    try {
      await ordenesApi.editarOrden(orden.id, {
        detallesEsteticos: formDatos.detallesEsteticos || null,
        reparacionSolicitada: formDatos.reparacionSolicitada,
        notasInternas: formDatos.notasInternas || null,
        fechaPactada: convertirAFormatoBackend(formDatos.fechaPactada)
      });
      setEditandoDatos(false);
      setMensaje('Datos de la orden actualizados.');
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron guardar los cambios'));
    } finally {
      setGuardandoDatos(false);
    }
  }

  function abrirEdicionChequeos() {
    if (!orden) return;
    setChequeosEdit(
      (orden.chequeos ?? []).map((c) => ({
        item: c.item,
        resultado: c.resultado ?? null,
        opciones: c.opciones ?? [],
        orden: c.orden
      }))
    );
    setEditandoChequeos(true);
  }

  async function handleGuardarChequeos() {
    if (!orden) return;
    setGuardandoChequeos(true);
    setError(null);
    try {
      await ordenesApi.reemplazarChequeos(
        orden.id,
        chequeosEdit.map((c, i) => ({ ...c, orden: i }))
      );
      setEditandoChequeos(false);
      setMensaje('Chequeo actualizado.');
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el chequeo'));
    } finally {
      setGuardandoChequeos(false);
    }
  }

  async function handleSubirImagenes() {
    if (!orden || imagenesNuevas.length === 0) return;
    setSubiendoImagenes(true);
    setError(null);
    try {
      await ordenesApi.subirImagenes(orden.id, imagenesNuevas);
      setImagenesNuevas([]);
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron subir las imágenes'));
    } finally {
      setSubiendoImagenes(false);
    }
  }

  async function handleEliminarImagen(imagenId: number) {
    if (!orden) return;
    if (!window.confirm('¿Eliminar esta imagen?')) return;
    try {
      await ordenesApi.eliminarImagen(orden.id, imagenId);
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar la imagen'));
    }
  }

  async function handleGuardarFirma(dataUrl: string) {
    if (!orden) return;
    setGuardandoFirma(true);
    setError(null);
    try {
      await ordenesApi.guardarFirma(orden.id, dataUrl);
      setMensaje('Firma guardada correctamente.');
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar la firma'));
    } finally {
      setGuardandoFirma(false);
    }
  }

  async function handleDescargarPdf() {
    if (!orden) return;
    setDescargandoPdf(true);
    try {
      const blob = await ordenesApi.descargarPdfUrl(orden.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${orden.numeroOrden}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo descargar el PDF'));
    } finally {
      setDescargandoPdf(false);
    }
  }

  if (cargando) return <Spinner animation="border" />;
  if (!orden) return <Alert variant="danger">{error ?? 'Orden no encontrada'}</Alert>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-0 font-mono">Orden {orden.numeroOrden}</h3>
          <Badge className={`${ESTADO_BADGE_CLASS[orden.estado]} mt-1`}>{etiquetaDe(orden.estado)}</Badge>
        </div>
        <Stack direction="horizontal" gap={2}>
          <Link className="btn btn-outline-secondary" to="/ordenes">
            Volver
          </Link>
          <Button variant="outline-dark" onClick={handleDescargarPdf} disabled={descargandoPdf}>
            {descargandoPdf ? <Spinner size="sm" animation="border" /> : 'Descargar PDF'}
          </Button>
        </Stack>
      </div>

      {bloqueada && (
        <Alert variant="secondary" className="py-2">
          Esta orden está <strong>{etiquetaDe(orden.estado).toLowerCase()}</strong> y no admite más cambios de
          estado.
          {esAdmin && ' Como administrador podés seguir editando sus datos.'}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      <Row className="g-3">
        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Cliente</Card.Header>
            <Card.Body>
              {orden.cliente ? (
                <>
                  <div>
                    <strong>
                      {orden.cliente.nombre} {orden.cliente.apellido}
                    </strong>
                  </div>
                  <div>DNI/CUIT: {orden.cliente.dniCuit ?? '-'}</div>
                  <div>Teléfono: {orden.cliente.telefono ?? '-'}</div>
                  <div>Email: {orden.cliente.email ?? '-'}</div>
                  {orden.cliente.esGremio && orden.cliente.nombreGremio && (
                    <div>Gremio: {orden.cliente.nombreGremio}</div>
                  )}
                </>
              ) : (
                '-'
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Equipo</Card.Header>
            <Card.Body>
              {orden.equipo && (
                <>
                  <div>
                    <strong>
                      {orden.equipo.marca} {orden.equipo.modelo}
                    </strong>{' '}
                    <Badge bg="secondary">{orden.equipo.tipoEquipo?.nombre ?? 'Sin especificar'}</Badge>
                  </div>
                  <div>Color: {orden.equipo.color ?? '-'}</div>
                  <div>Nº de serie: {orden.equipo.numeroSerie ?? '-'}</div>
                  <hr className="my-2" />
                  {equipoRevelado ? (
                    <div className="small">
                      <div>Clave de desbloqueo: {equipoRevelado.claveDesbloqueo ?? '-'}</div>
                      <div>Usuario de cuenta: {equipoRevelado.cuentaUsuario ?? '-'}</div>
                      <div>Contraseña de cuenta: {equipoRevelado.cuentaPassword ?? '-'}</div>
                    </div>
                  ) : (
                    <div className="text-muted small">Datos sensibles ocultos</div>
                  )}
                  <Button size="sm" variant="link" className="ps-0" onClick={toggleRevelarEquipo}>
                    {equipoRevelado ? 'Ocultar' : 'Revelar datos sensibles'}
                  </Button>
                  {!equipoRevelado && (
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                      Cada consulta queda registrada.
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={12}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Detalles de la orden</span>
              {puedeEditar &&
                (editandoDatos ? (
                  <Stack direction="horizontal" gap={2}>
                    <Button size="sm" variant="outline-secondary" onClick={() => setEditandoDatos(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleGuardarDatos} disabled={guardandoDatos || !!errorFecha}>
                      {guardandoDatos ? <Spinner size="sm" animation="border" /> : 'Guardar'}
                    </Button>
                  </Stack>
                ) : (
                  <Button size="sm" variant="outline-primary" onClick={abrirEdicionDatos}>
                    Editar
                  </Button>
                ))}
            </Card.Header>
            <Card.Body>
              {editandoDatos ? (
                <Row className="g-3">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Reparación o revisión solicitada *</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={formDatos.reparacionSolicitada}
                        onChange={(e) => setFormDatos({ ...formDatos, reparacionSolicitada: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Detalles estéticos</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={formDatos.detallesEsteticos}
                        onChange={(e) => setFormDatos({ ...formDatos, detallesEsteticos: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Form.Group>
                      <Form.Label>Notas internas (no visibles para el cliente)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={formDatos.notasInternas}
                        onChange={(e) => setFormDatos({ ...formDatos, notasInternas: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <DateInput
                      label="Fecha pactada de entrega"
                      value={formDatos.fechaPactada}
                      onChange={(v) => setFormDatos({ ...formDatos, fechaPactada: v })}
                      onValidityChange={setErrorFecha}
                    />
                  </Col>
                </Row>
              ) : (
                <Row className="g-3">
                  <Col md={6}>
                    <div className="text-muted small">Reparación solicitada</div>
                    <div>{orden.reparacionSolicitada || '-'}</div>
                  </Col>
                  <Col md={6}>
                    <div className="text-muted small">Detalles estéticos</div>
                    <div>{orden.detallesEsteticos || 'Sin detalles registrados'}</div>
                  </Col>
                  <Col md={6}>
                    <div className="text-muted small">Notas internas</div>
                    <div>{orden.notasInternas || '-'}</div>
                  </Col>
                  <Col md={6}>
                    <div className="text-muted small">Fecha pactada</div>
                    <div>{convertirDesdeBackend(orden.fechaPactada) || '-'}</div>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={12}>
          <Card>
            <Card.Header>Imágenes del equipo</Card.Header>
            <Card.Body>
              <Row xs={2} md={4} lg={6} className="g-2 mb-3">
                {orden.imagenes?.map((img) => (
                  <Col key={img.id}>
                    <div className="position-relative">
                      <Image src={img.url} alt={img.descripcion ?? 'Foto del equipo'} thumbnail />
                      {puedeEditar && (
                        <Button
                          size="sm"
                          variant="danger"
                          className="position-absolute top-0 end-0"
                          onClick={() => handleEliminarImagen(img.id)}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </Col>
                ))}
                {(orden.imagenes?.length ?? 0) === 0 && (
                  <Col xs={12}>
                    <span className="text-muted">Sin imágenes cargadas</span>
                  </Col>
                )}
              </Row>
              {puedeEditar && (
                <>
                  <ImageUploader
                    files={imagenesNuevas}
                    onChange={setImagenesNuevas}
                    disabled={subiendoImagenes}
                  />
                  {imagenesNuevas.length > 0 && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={handleSubirImagenes}
                      disabled={subiendoImagenes}
                    >
                      {subiendoImagenes ? <Spinner size="sm" animation="border" /> : 'Subir imágenes'}
                    </Button>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={12}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Chequeo de recepción</span>
              {puedeEditar &&
                (editandoChequeos ? (
                  <Stack direction="horizontal" gap={2}>
                    <Button size="sm" variant="outline-secondary" onClick={() => setEditandoChequeos(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleGuardarChequeos} disabled={guardandoChequeos}>
                      {guardandoChequeos ? <Spinner size="sm" animation="border" /> : 'Guardar'}
                    </Button>
                  </Stack>
                ) : (
                  <Button size="sm" variant="outline-primary" onClick={abrirEdicionChequeos}>
                    Editar
                  </Button>
                ))}
            </Card.Header>
            <Card.Body>
              {editandoChequeos ? (
                <ChecklistEditor
                  value={chequeosEdit}
                  onChange={setChequeosEdit}
                  disabled={guardandoChequeos}
                />
              ) : orden.chequeos && orden.chequeos.length > 0 ? (
                <ListGroup variant="flush">
                  {orden.chequeos.map((c) => (
                    <ListGroup.Item key={c.id} className="d-flex justify-content-between px-0">
                      <span>{c.item}</span>
                      <Badge bg={c.resultado ? 'light' : 'secondary'} text={c.resultado ? 'dark' : undefined}>
                        {c.resultado ?? 'Sin responder'}
                      </Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <span className="text-muted">Sin chequeos registrados</span>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Presupuesto</Card.Header>
            <Card.Body>
              <Form.Group className="mb-2">
                <Form.Label>Monto</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  value={presupuestoMonto}
                  disabled={!puedeEditar}
                  onChange={(e) => setPresupuestoMonto(e.target.value)}
                />
              </Form.Group>
              <div className="mb-2">
                Respuesta del cliente:{' '}
                {orden.presupuestoAprobado === true && <Badge bg="success">Aprobado</Badge>}
                {orden.presupuestoAprobado === false && <Badge bg="danger">Rechazado</Badge>}
                {orden.presupuestoAprobado == null && <Badge bg="secondary">Pendiente</Badge>}
              </div>
              <Stack direction="horizontal" gap={2}>
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => handleGuardarPresupuesto()}
                  disabled={guardandoPresupuesto || !puedeEditar}
                >
                  Guardar monto
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => handleGuardarPresupuesto(true)}
                  disabled={guardandoPresupuesto || !puedeEditar}
                >
                  Cliente aprobó
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleGuardarPresupuesto(false)}
                  disabled={guardandoPresupuesto || !puedeEditar}
                >
                  Cliente rechazó
                </Button>
              </Stack>
              {orden.montoTotal != null && (
                <div className="mt-3 pt-3 border-top small">
                  <div className="fw-semibold mb-1">Cobro al entregar</div>
                  <div>Total: {formatearMonto(Number(orden.montoTotal))}</div>
                  <div>Abonó: {formatearMonto(Number(orden.montoAbonado ?? 0))}</div>
                  {Number(orden.creditoAplicado ?? 0) > 0 && (
                    <div className="text-success">
                      Saldo a favor aplicado: {formatearMonto(Number(orden.creditoAplicado))}
                    </div>
                  )}
                  {(() => {
                    const adeudado =
                      Number(orden.montoTotal) -
                      Number(orden.montoAbonado ?? 0) -
                      Number(orden.creditoAplicado ?? 0);
                    return adeudado > 0 ? (
                      <div className="text-danger">
                        Quedó debiendo {formatearMonto(adeudado)} —{' '}
                        <Link to="/cuentas">ver cuenta corriente</Link>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
              <Form.Text className="text-muted d-block mt-2">
                Guardar el monto deja la orden como presupuestada.
              </Form.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Cambiar estado</Card.Header>
            <Card.Body>
              {puedeEntregar && (
                <div className="mb-3">
                  <Button variant="success" onClick={() => setEntregando(true)}>
                    Entregar equipo
                  </Button>
                  <Form.Text className="text-muted d-block">
                    Al entregar se registra cuánto abona el cliente.
                  </Form.Text>
                </div>
              )}
              {estadosPosibles.length === 0 && !esAdmin ? (
                <span className="text-muted">
                  La orden está {etiquetaDe(orden.estado).toLowerCase()}: no hay más cambios posibles.
                </span>
              ) : (
                <>
                  <Form.Group className="mb-2">
                    <Form.Select
                      value={nuevoEstado}
                      onChange={(e) => setNuevoEstado(e.target.value as EstadoOrden)}
                    >
                      <option value="">Seleccionar nuevo estado...</option>
                      {estadosPosibles.map((estado) => (
                        <option key={estado} value={estado}>
                          {etiquetaDe(estado)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Control
                      placeholder={
                        forzarEstado ? 'Motivo del cambio forzado (obligatorio)' : 'Comentario (opcional)'
                      }
                      value={comentarioEstado}
                      onChange={(e) => setComentarioEstado(e.target.value)}
                    />
                  </Form.Group>
                  {esAdmin && (
                    <Form.Check
                      type="checkbox"
                      id="forzar-estado"
                      className="mb-2 small"
                      label="Forzar un estado fuera del circuito normal"
                      checked={forzarEstado}
                      onChange={(e) => {
                        setForzarEstado(e.target.checked);
                        setNuevoEstado('');
                      }}
                    />
                  )}
                  <Button
                    size="sm"
                    onClick={handleCambiarEstado}
                    disabled={!nuevoEstado || cambiandoEstado || (forzarEstado && !comentarioEstado.trim())}
                  >
                    {cambiandoEstado ? <Spinner size="sm" animation="border" /> : 'Actualizar estado'}
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Firma del cliente</Card.Header>
            <Card.Body>
              {orden.firmaClienteUrl ? (
                <>
                  <Image
                    src={orden.firmaClienteUrl}
                    alt="Firma del cliente"
                    thumbnail
                    style={{ maxWidth: 300 }}
                  />
                  <div className="text-muted small mt-2">Firmada en la recepción.</div>
                </>
              ) : (
                <SignaturePad onGuardar={handleGuardarFirma} disabled={guardandoFirma || !puedeEditar} />
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Historial de estados</Card.Header>
            <Card.Body>
              {orden.historialEstados && orden.historialEstados.length > 0 ? (
                <ListGroup variant="flush">
                  {orden.historialEstados.map((h) => (
                    <ListGroup.Item key={h.id} className="px-0">
                      <div className="d-flex justify-content-between">
                        <span>
                          {h.estadoAnterior ? `${etiquetaDe(h.estadoAnterior as EstadoOrden)} → ` : ''}
                          <strong>{etiquetaDe(h.estadoNuevo as EstadoOrden)}</strong>
                          {h.usuario && ` — ${h.usuario.nombre} ${h.usuario.apellido}`}
                        </span>
                        <span className="text-muted small">{formatearFechaHora(h.createdAt)}</span>
                      </div>
                      {h.comentario && <div className="text-muted small">{h.comentario}</div>}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <span className="text-muted">Sin historial</span>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <EntregaModal
        orden={orden}
        show={entregando}
        esAdmin={esAdmin}
        onCerrar={() => setEntregando(false)}
        onEntregado={handleEntregado}
        onAutorizacionPedida={handleAutorizacionPedida}
      />
    </div>
  );
}
