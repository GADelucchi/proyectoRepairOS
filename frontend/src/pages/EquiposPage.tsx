import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table, Badge } from 'react-bootstrap';
import * as equiposApi from '../api/equipos';
import * as clientesApi from '../api/clientes';
import * as configuracionApi from '../api/configuracion';
import { Equipo, Cliente, TipoEquipoPersonalizado } from '../types';
import { getApiErrorMessage } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';

const EQUIPO_VACIO = {
  clienteId: 0,
  tipoEquipoPersonalizadoId: 0,
  marca: '',
  modelo: '',
  color: '',
  numeroSerie: '',
  claveDesbloqueo: '',
  cuentaUsuario: '',
  cuentaPassword: ''
};

export function EquiposPage() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tiposEquipo, setTiposEquipo] = useState<TipoEquipoPersonalizado[]>([]);
  const [cargandoTipos, setCargandoTipos] = useState(true);

  const [clientesOpciones, setClientesOpciones] = useState<Cliente[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const busquedaClienteDebounced = useDebounce(busquedaCliente);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Equipo | null>(null);
  const [form, setForm] = useState(EQUIPO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [revelados, setRevelados] = useState<Record<number, Equipo>>({});

  async function cargar(search?: string) {
    setCargando(true);
    setError(null);
    try {
      const data = await equiposApi.listarEquipos({ search });
      setEquipos(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los equipos'));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTipos();
  }, []);

  useEffect(() => {
    cargar(busquedaDebounced || undefined);
  }, [busquedaDebounced]);

  async function cargarTipos() {
    try {
      const data = await configuracionApi.listarTiposEquipo();
      setTiposEquipo(data);
    } catch (err) {
      console.error('Error cargando tipos de equipo:', err);
    } finally {
      setCargandoTipos(false);
    }
  }

  useEffect(() => {
    let activo = true;
    if (busquedaClienteDebounced.trim().length < 2) {
      setClientesOpciones([]);
      return;
    }
    clientesApi
      .listarClientes(busquedaClienteDebounced)
      .then((data) => {
        if (activo) setClientesOpciones(data);
      })
      .catch(() => {
        if (activo) setClientesOpciones([]);
      });
    return () => {
      activo = false;
    };
  }, [busquedaClienteDebounced]);

  function abrirNuevo() {
    setEditando(null);
    setForm(EQUIPO_VACIO);
    setBusquedaCliente('');
    setClientesOpciones([]);
    setModalAbierto(true);
  }

  async function abrirEdicion(equipo: Equipo) {
    try {
      const completo = await equiposApi.obtenerEquipo(equipo.id, true);
      setEditando(completo);
      setForm({
        clienteId: completo.clienteId,
        tipoEquipoPersonalizadoId: completo.tipoEquipoPersonalizadoId,
        marca: completo.marca ?? '',
        modelo: completo.modelo ?? '',
        color: completo.color ?? '',
        numeroSerie: completo.numeroSerie ?? '',
        claveDesbloqueo: completo.claveDesbloqueo ?? '',
        cuentaUsuario: completo.cuentaUsuario ?? '',
        cuentaPassword: completo.cuentaPassword ?? ''
      });
      setBusquedaCliente(completo.cliente ? `${completo.cliente.nombre} ${completo.cliente.apellido}` : '');
      setModalAbierto(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar el equipo'));
    }
  }

  async function handleGenerarNumeroSerie() {
    setGenerando(true);
    setError(null);
    try {
      const numeroSerie = await equiposApi.generarNumeroSerie();
      setForm({ ...form, numeroSerie });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo generar el número de serie'));
    } finally {
      setGenerando(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.clienteId) {
      setError('Debés seleccionar un cliente dueño del equipo');
      return;
    }
    if (!form.numeroSerie.trim()) {
      setError('El número de serie es requerido. Ingresa uno manualmente o toca Generar.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await equiposApi.actualizarEquipo(editando.id, form);
      } else {
        await equiposApi.crearEquipo(form);
      }
      setModalAbierto(false);
      await cargar(busquedaDebounced || undefined);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el equipo'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(equipo: Equipo) {
    if (!window.confirm(`¿Eliminar el equipo ${equipo.marca ?? ''} ${equipo.modelo ?? ''}?`)) return;
    try {
      await equiposApi.eliminarEquipo(equipo.id);
      await cargar(busquedaDebounced || undefined);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el equipo'));
    }
  }

  async function toggleRevelar(equipo: Equipo) {
    if (revelados[equipo.id]) {
      setRevelados((prev) => {
        const copia = { ...prev };
        delete copia[equipo.id];
        return copia;
      });
      return;
    }
    try {
      const completo = await equiposApi.obtenerEquipo(equipo.id, true);
      setRevelados((prev) => ({ ...prev, [equipo.id]: completo }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron revelar los datos'));
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Equipos</h3>
        <Button onClick={abrirNuevo}>+ Nuevo equipo</Button>
      </div>

      <Form className="mb-3" onSubmit={(e) => e.preventDefault()}>
        <Form.Control
          placeholder="Buscar por número de serie, marca o modelo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </Form>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {cargando ? (
        <Spinner animation="border" />
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Marca / Modelo</th>
              <th>Color</th>
              <th>Nº de serie</th>
              <th>Dueño</th>
              <th>Datos sensibles</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((eq) => {
              const revelado = revelados[eq.id];
              return (
                <tr key={eq.id}>
                  <td>
                    <Badge bg="secondary">{eq.tipoEquipo?.nombre ?? 'Sin especificar'}</Badge>
                  </td>
                  <td className="font-mono">
                    {eq.marca ?? '-'} {eq.modelo ?? ''}
                  </td>
                  <td>{eq.color ?? '-'}</td>
                  <td className="font-mono">{eq.numeroSerie ?? '-'}</td>
                  <td>{eq.cliente ? `${eq.cliente.nombre} ${eq.cliente.apellido}` : '-'}</td>
                  <td>
                    {revelado ? (
                      <div className="small">
                        <div>Clave: {revelado.claveDesbloqueo ?? '-'}</div>
                        <div>Usuario: {revelado.cuentaUsuario ?? '-'}</div>
                        <div>Contraseña: {revelado.cuentaPassword ?? '-'}</div>
                      </div>
                    ) : (
                      <span className="text-muted">••••••••</span>
                    )}
                    <Button size="sm" variant="link" onClick={() => toggleRevelar(eq)}>
                      {revelado ? 'Ocultar' : 'Revelar'}
                    </Button>
                  </td>
                  <td className="text-nowrap">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      onClick={() => abrirEdicion(eq)}
                    >
                      Editar
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleEliminar(eq)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              );
            })}
            {equipos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted">
                  No hay equipos cargados
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <Modal show={modalAbierto} onHide={() => setModalAbierto(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editando ? 'Editar equipo' : 'Nuevo equipo'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label>Cliente dueño del equipo</Form.Label>
              <Form.Control
                placeholder="Buscar cliente por nombre, apellido o DNI..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
              />
              {clientesOpciones.length > 0 && (
                <div className="border rounded mt-1 bg-white" style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {clientesOpciones.map((c) => (
                    <div
                      key={c.id}
                      className="px-2 py-1"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setForm({ ...form, clienteId: c.id });
                        setBusquedaCliente(`${c.nombre} ${c.apellido}`);
                        setClientesOpciones([]);
                      }}
                    >
                      {c.nombre} {c.apellido} {c.dniCuit ? `(${c.dniCuit})` : ''}
                    </div>
                  ))}
                </div>
              )}
              {form.clienteId > 0 && <div className="text-success small mt-1">Cliente seleccionado ✓</div>}
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Tipo de equipo</Form.Label>
              <Form.Select
                value={form.tipoEquipoPersonalizadoId}
                onChange={(e) => setForm({ ...form, tipoEquipoPersonalizadoId: Number(e.target.value) })}
                disabled={cargandoTipos || tiposEquipo.length === 0}
              >
                <option value="">Selecciona un tipo de equipo</option>
                {tiposEquipo.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>Marca</Form.Label>
                  <Form.Control
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>Modelo</Form.Label>
                  <Form.Control
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  />
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>Color</Form.Label>
                  <Form.Control
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>
                    Número de serie <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      value={form.numeroSerie}
                      onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
                      placeholder="ej: SN-20260726143022-A7F2Q9X1"
                    />
                    {!editando && (
                      <Button
                        variant="outline-secondary"
                        onClick={handleGenerarNumeroSerie}
                        disabled={generando || !!form.numeroSerie.trim()}
                        title={
                          form.numeroSerie.trim()
                            ? 'Limpia el campo para generar uno nuevo'
                            : 'Generar número de serie único'
                        }
                      >
                        {generando ? <Spinner size="sm" animation="border" /> : 'Generar'}
                      </Button>
                    )}
                  </div>
                </Form.Group>
              </div>
            </div>

            <hr />
            <p className="text-muted small">Los siguientes datos se guardan cifrados en la base de datos.</p>
            <Form.Group className="mb-2">
              <Form.Label>Clave de desbloqueo</Form.Label>
              <Form.Control
                value={form.claveDesbloqueo}
                onChange={(e) => setForm({ ...form, claveDesbloqueo: e.target.value })}
              />
            </Form.Group>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>Usuario de cuenta vinculada</Form.Label>
                  <Form.Control
                    value={form.cuentaUsuario}
                    onChange={(e) => setForm({ ...form, cuentaUsuario: e.target.value })}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-2">
                  <Form.Label>Contraseña de cuenta vinculada</Form.Label>
                  <Form.Control
                    value={form.cuentaPassword}
                    onChange={(e) => setForm({ ...form, cuentaPassword: e.target.value })}
                  />
                </Form.Group>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? <Spinner size="sm" animation="border" /> : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
