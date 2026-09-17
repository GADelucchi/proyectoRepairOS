import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import * as clientesApi from '../api/clientes';
import * as equiposApi from '../api/equipos';
import * as ordenesApi from '../api/ordenes';
import * as configuracionApi from '../api/configuracion';
import { Cliente, Equipo, TipoEquipoPersonalizado, ChequeoPersonalizado } from '../types';
import { getApiErrorMessage } from '../api/client';
import { ChecklistEditor, ChequeoItem, OPCIONES_POR_DEFECTO } from '../components/ChecklistEditor';
import { ImageUploader } from '../components/ImageUploader';
import { DateInput } from '../components/DateInput';
import { ClienteFormFields, ClienteFormData, CLIENTE_FORM_VACIO } from '../components/ClienteFormFields';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { convertirAFormatoBackend } from '../utils/dateFormat';

const NUEVO_EQUIPO_VACIO = {
  tipoEquipoPersonalizadoId: 0,
  marca: '',
  modelo: '',
  color: '',
  numeroSerie: '',
  claveDesbloqueo: '',
  cuentaUsuario: '',
  cuentaPassword: ''
};

export function OrdenNuevaPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  // Tipos de equipo personalizados
  const [tiposEquipo, setTiposEquipo] = useState<TipoEquipoPersonalizado[]>([]);
  const [cargandoTipos, setCargandoTipos] = useState(true);
  const [tipoEquipoSeleccionado, setTipoEquipoSeleccionado] = useState<TipoEquipoPersonalizado | null>(null);
  const [chequeosDelTipo, setChequeosDelTipo] = useState<ChequeoPersonalizado[]>([]);

  // Cliente
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const busquedaClienteDebounced = useDebounce(busquedaCliente);
  const [opcionesCliente, setOpcionesCliente] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState<ClienteFormData>(CLIENTE_FORM_VACIO);
  const [errorFechaCliente, setErrorFechaCliente] = useState<string | null>(null);

  // Equipo
  const [busquedaEquipo, setBusquedaEquipo] = useState('');
  const busquedaEquipoDebounced = useDebounce(busquedaEquipo);
  const [opcionesEquipo, setOpcionesEquipo] = useState<Equipo[]>([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<Equipo | null>(null);
  const [creandoEquipo, setCreandoEquipo] = useState(false);
  const [nuevoEquipo, setNuevoEquipo] = useState(NUEVO_EQUIPO_VACIO);

  // Detalles de la orden
  const [detallesEsteticos, setDetallesEsteticos] = useState('');
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [chequeos, setChequeos] = useState<ChequeoItem[]>([]);
  const [reparacionSolicitada, setReparacionSolicitada] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [fechaPactada, setFechaPactada] = useState('');
  const [presupuestoMonto, setPresupuestoMonto] = useState('');

  // Cargar tipos de equipo personalizados
  useEffect(() => {
    async function cargarTipos() {
      try {
        const data = await configuracionApi.listarTiposEquipo();
        setTiposEquipo(data);
        if (data.length === 0) {
          setToastMensaje('No hay tipos de equipo configurados. Crea uno en la pestaña de Configuración.');
        }
      } catch (err) {
        console.error('Error cargando tipos de equipo:', err);
        setToastMensaje('Error al cargar los tipos de equipo. Intenta nuevamente.');
      } finally {
        setCargandoTipos(false);
      }
    }
    cargarTipos();
  }, []);

  // Cargar chequeos cuando se selecciona un tipo de equipo
  useEffect(() => {
    async function cargarChequeos() {
      if (!tipoEquipoSeleccionado) {
        setChequeosDelTipo([]);
        return;
      }
      try {
        const data = await configuracionApi.listarChequeos(tipoEquipoSeleccionado.id);
        setChequeosDelTipo(data);
        // Se copian las opciones configuradas para este tipo: son las que va a ver
        // el técnico al responder, y quedan guardadas junto con la orden.
        const chequeosFormato: ChequeoItem[] = data.map((c, i) => ({
          item: c.texto,
          resultado: null,
          opciones: c.opciones?.length ? c.opciones : OPCIONES_POR_DEFECTO,
          orden: i
        }));
        setChequeos(chequeosFormato);
      } catch (err) {
        console.error('Error cargando chequeos:', err);
        setChequeosDelTipo([]);
        setChequeos([]);
      }
    }
    cargarChequeos();
  }, [tipoEquipoSeleccionado]);

  function seleccionarTipoEquipo(tipoId: number) {
    const tipo = tiposEquipo.find((t) => t.id === tipoId);
    if (tipo) {
      setTipoEquipoSeleccionado(tipo);
    }
  }

  useEffect(() => {
    let activo = true;
    if (busquedaClienteDebounced.trim().length < 2 || clienteSeleccionado) {
      setOpcionesCliente([]);
      return;
    }
    clientesApi
      .listarClientes(busquedaClienteDebounced)
      .then((data) => {
        if (activo) setOpcionesCliente(data);
      })
      .catch(() => {
        if (activo) setOpcionesCliente([]);
      });
    return () => {
      activo = false;
    };
  }, [busquedaClienteDebounced, clienteSeleccionado]);

  useEffect(() => {
    let activo = true;
    if (busquedaEquipoDebounced.trim().length < 2 || equipoSeleccionado) {
      setOpcionesEquipo([]);
      return;
    }
    equiposApi
      .listarEquipos({
        search: busquedaEquipoDebounced,
        clienteId: clienteSeleccionado?.id
      })
      .then((data) => {
        if (activo) setOpcionesEquipo(data);
      })
      .catch(() => {
        if (activo) setOpcionesEquipo([]);
      });
    return () => {
      activo = false;
    };
  }, [busquedaEquipoDebounced, equipoSeleccionado, clienteSeleccionado]);

  function seleccionarCliente(c: Cliente) {
    setClienteSeleccionado(c);
    setBusquedaCliente(`${c.nombre} ${c.apellido}`);
    setOpcionesCliente([]);
    setCreandoCliente(false);
  }

  function quitarCliente() {
    setClienteSeleccionado(null);
    setBusquedaCliente('');
  }

  function seleccionarEquipo(eq: Equipo) {
    setEquipoSeleccionado(eq);
    setBusquedaEquipo(`${eq.marca ?? ''} ${eq.modelo ?? ''} ${eq.numeroSerie ? `(${eq.numeroSerie})` : ''}`);
    setOpcionesEquipo([]);
    setCreandoEquipo(false);
  }

  function quitarEquipo() {
    setEquipoSeleccionado(null);
    setBusquedaEquipo('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clienteSeleccionado && !creandoCliente) {
      setError('Buscá y seleccioná un cliente, o cargá uno nuevo.');
      return;
    }
    if (!equipoSeleccionado && !creandoEquipo) {
      setError('Buscá y seleccioná un equipo, o cargá uno nuevo.');
      return;
    }
    if (creandoEquipo && !tipoEquipoSeleccionado) {
      setError('Selecciona un tipo de equipo de la configuración.');
      return;
    }
    if (!reparacionSolicitada.trim()) {
      setError('Indicá la reparación o revisión a realizar.');
      return;
    }
    if (creandoCliente && errorFechaCliente) {
      setError('Revisá la fecha de nacimiento del cliente antes de continuar.');
      return;
    }
    if (fechaPactada && convertirAFormatoBackend(fechaPactada) === null) {
      setError('La fecha pactada de entrega no es una fecha válida.');
      return;
    }

    setEnviando(true);
    try {
      const orden = await ordenesApi.crearOrden({
        clienteId: clienteSeleccionado?.id,
        nuevoCliente: creandoCliente ? clientesApi.formularioAClienteInput(nuevoCliente) : undefined,
        equipoId: equipoSeleccionado?.id,
        nuevoEquipo: creandoEquipo
          ? {
              ...nuevoEquipo,
              tipoEquipoPersonalizadoId: tipoEquipoSeleccionado!.id
            }
          : undefined,
        detallesEsteticos: detallesEsteticos || null,
        reparacionSolicitada,
        notasInternas: notasInternas || null,
        fechaPactada: convertirAFormatoBackend(fechaPactada),
        presupuestoMonto: presupuestoMonto ? Number(presupuestoMonto) : null,
        chequeos
      });

      if (imagenes.length > 0) {
        await ordenesApi.subirImagenes(orden.id, imagenes);
      }

      navigate(`/ordenes/${orden.id}`, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo crear la orden'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h3 className="mb-3">Nueva orden de reparación</h3>
      {error && <Alert variant="danger">{error}</Alert>}

      <ToastContainer position="top-end" className="p-3">
        {toastMensaje && (
          <Toast show onClose={() => setToastMensaje(null)} delay={5000} autohide bg="warning">
            <Toast.Body>{toastMensaje}</Toast.Body>
          </Toast>
        )}
      </ToastContainer>

      <Form onSubmit={handleSubmit}>
        <Row className="g-3">
          <Col md={6}>
            <Card className="h-100">
              <Card.Header>1. Cliente</Card.Header>
              <Card.Body>
                {!creandoCliente ? (
                  <>
                    <Form.Control
                      placeholder="Buscar cliente por nombre, apellido o DNI..."
                      value={busquedaCliente}
                      onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        setClienteSeleccionado(null);
                      }}
                    />
                    {opcionesCliente.length > 0 && (
                      <div
                        className="border rounded mt-1 bg-white"
                        style={{ maxHeight: 150, overflowY: 'auto' }}
                      >
                        {opcionesCliente.map((c) => (
                          <div
                            key={c.id}
                            className="px-2 py-1 text-dark"
                            style={{
                              cursor: 'pointer',
                              backgroundColor: '#fff',
                              borderBottom: '1px solid #eee'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#e8f0ff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fff';
                            }}
                            onClick={() => seleccionarCliente(c)}
                          >
                            <strong>
                              {c.nombre} {c.apellido}
                            </strong>{' '}
                            {c.dniCuit ? `(${c.dniCuit})` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {clienteSeleccionado && (
                      <Alert variant="success" className="mt-2 mb-0 py-2 d-flex justify-content-between">
                        <span>
                          Seleccionado: {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
                        </span>
                        <Button variant="link" size="sm" onClick={quitarCliente}>
                          Cambiar
                        </Button>
                      </Alert>
                    )}
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="mt-2"
                      type="button"
                      onClick={() => {
                        setCreandoCliente(true);
                        setClienteSeleccionado(null);
                      }}
                    >
                      + El cliente no existe, cargar uno nuevo
                    </Button>
                  </>
                ) : (
                  <>
                    <ClienteFormFields
                      value={nuevoCliente}
                      onChange={setNuevoCliente}
                      layout="grilla"
                      disabled={enviando}
                      onFechaInvalida={setErrorFechaCliente}
                      puedeEditarCuentaCorriente={usuario?.rol === 'admin'}
                    />
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="mt-2"
                      type="button"
                      onClick={() => setCreandoCliente(false)}
                    >
                      Volver a buscar un cliente existente
                    </Button>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="h-100">
              <Card.Header>2. Equipo</Card.Header>
              <Card.Body>
                {!creandoEquipo ? (
                  <>
                    <Form.Control
                      placeholder="Buscar equipo por marca, modelo o número de serie..."
                      value={busquedaEquipo}
                      onChange={(e) => {
                        setBusquedaEquipo(e.target.value);
                        setEquipoSeleccionado(null);
                      }}
                    />
                    {opcionesEquipo.length > 0 && (
                      <div
                        className="border rounded mt-1 bg-white"
                        style={{ maxHeight: 150, overflowY: 'auto' }}
                      >
                        {opcionesEquipo.map((eq) => (
                          <div
                            key={eq.id}
                            className="px-2 py-1"
                            style={{ cursor: 'pointer' }}
                            onClick={() => seleccionarEquipo(eq)}
                          >
                            {eq.marca} {eq.modelo} {eq.numeroSerie ? `(${eq.numeroSerie})` : ''} —{' '}
                            {eq.cliente ? `${eq.cliente.nombre} ${eq.cliente.apellido}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {equipoSeleccionado && (
                      <Alert variant="success" className="mt-2 mb-0 py-2 d-flex justify-content-between">
                        <span>
                          Seleccionado: {equipoSeleccionado.marca} {equipoSeleccionado.modelo}
                        </span>
                        <Button variant="link" size="sm" onClick={quitarEquipo}>
                          Cambiar
                        </Button>
                      </Alert>
                    )}
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="mt-2"
                      type="button"
                      onClick={() => {
                        setCreandoEquipo(true);
                        setEquipoSeleccionado(null);
                        setTipoEquipoSeleccionado(null);
                        setNuevoEquipo(NUEVO_EQUIPO_VACIO);
                      }}
                    >
                      + El equipo no existe, cargar uno nuevo
                    </Button>
                  </>
                ) : (
                  <>
                    <Row className="g-2">
                      <Col md={12}>
                        <Form.Label className="small">
                          Tipo de equipo <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select
                          value={tipoEquipoSeleccionado?.id || ''}
                          onChange={(e) => seleccionarTipoEquipo(Number(e.target.value))}
                          disabled={cargandoTipos || tiposEquipo.length === 0}
                          required
                        >
                          <option value="">Selecciona el tipo de equipo</option>
                          {tiposEquipo.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nombre}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={6}>
                        <Form.Control
                          placeholder="Marca"
                          value={nuevoEquipo.marca}
                          onChange={(e) =>
                            setNuevoEquipo({
                              ...nuevoEquipo,
                              marca: e.target.value
                            })
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Control
                          placeholder="Modelo"
                          value={nuevoEquipo.modelo}
                          onChange={(e) =>
                            setNuevoEquipo({
                              ...nuevoEquipo,
                              modelo: e.target.value
                            })
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Control
                          placeholder="Color"
                          value={nuevoEquipo.color}
                          onChange={(e) =>
                            setNuevoEquipo({
                              ...nuevoEquipo,
                              color: e.target.value
                            })
                          }
                        />
                      </Col>
                      <Col md={12}>
                        <Form.Control
                          placeholder="Número de serie"
                          value={nuevoEquipo.numeroSerie}
                          onChange={(e) =>
                            setNuevoEquipo({
                              ...nuevoEquipo,
                              numeroSerie: e.target.value
                            })
                          }
                        />
                      </Col>
                      <Col md={12}>
                        <Form.Control
                          placeholder="Clave de desbloqueo (se guarda cifrada)"
                          value={nuevoEquipo.claveDesbloqueo}
                          onChange={(e) =>
                            setNuevoEquipo({
                              ...nuevoEquipo,
                              claveDesbloqueo: e.target.value
                            })
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Control
                          placeholder="Usuario de cuenta vinculada"
                          value={nuevoEquipo.cuentaUsuario}
                          onChange={(e) =>
                            setNuevoEquipo({
                              ...nuevoEquipo,
                              cuentaUsuario: e.target.value
                            })
                          }
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Control
                          placeholder="Contraseña de cuenta vinculada"
                          value={nuevoEquipo.cuentaPassword}
                          onChange={(e) =>
                            setNuevoEquipo({
                              ...nuevoEquipo,
                              cuentaPassword: e.target.value
                            })
                          }
                        />
                      </Col>
                    </Row>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="mt-2"
                      type="button"
                      onClick={() => setCreandoEquipo(false)}
                    >
                      Volver a buscar un equipo existente
                    </Button>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={12}>
            <Card>
              <Card.Header>3. Estado estético e imágenes</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Detalles estéticos (rayones, golpes, faltantes, etc.)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={detallesEsteticos}
                    onChange={(e) => setDetallesEsteticos(e.target.value)}
                  />
                </Form.Group>
                <Form.Label>Fotos del equipo</Form.Label>
                <ImageUploader files={imagenes} onChange={setImagenes} />
              </Card.Body>
            </Card>
          </Col>

          <Col md={12}>
            <Card>
              <Card.Header>4. Chequeo inicial</Card.Header>
              <Card.Body>
                {!tipoEquipoSeleccionado ? (
                  <p className="text-muted mb-0">
                    Selecciona un tipo de equipo para ver los chequeos predeterminados.
                  </p>
                ) : chequeosDelTipo.length === 0 ? (
                  <p className="text-muted mb-0">
                    Este tipo de equipo no tiene chequeos configurados. Ve a Configuración para agregarlos.
                  </p>
                ) : (
                  <>
                    <p className="text-muted small mb-2">
                      Chequeos cargados automáticamente para: <strong>{tipoEquipoSeleccionado.nombre}</strong>
                    </p>
                    <ChecklistEditor value={chequeos} onChange={setChequeos} />
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={12}>
            <Card>
              <Card.Header>5. Reparación / revisión y condiciones</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Reparación o revisión a realizar *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    required
                    value={reparacionSolicitada}
                    onChange={(e) => setReparacionSolicitada(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Notas internas (no visibles para el cliente)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={notasInternas}
                    onChange={(e) => setNotasInternas(e.target.value)}
                  />
                </Form.Group>
                <Row className="g-3">
                  <Col md={6}>
                    <DateInput
                      label="Fecha pactada de entrega"
                      value={fechaPactada}
                      onChange={setFechaPactada}
                      placeholder="DD/MM/YYYY"
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Monto de presupuesto (estimado)</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        step="0.01"
                        value={presupuestoMonto}
                        onChange={(e) => setPresupuestoMonto(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button variant="secondary" type="button" onClick={() => navigate('/ordenes')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? <Spinner size="sm" animation="border" /> : 'Crear orden'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
