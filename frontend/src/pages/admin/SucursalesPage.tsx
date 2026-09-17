import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import * as sucursalesApi from '../../api/sucursales';
import * as usuariosApi from '../../api/usuarios';
import { Sucursal, Usuario } from '../../types';
import { getApiErrorMessage } from '../../api/client';

const NUEVA_VACIA = { nombre: '', direccion: '', telefono: '' };

export function SucursalesPage() {
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sucursalCreada, setSucursalCreada] = useState<Sucursal | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Sucursal | null>(null);
  const [form, setForm] = useState(NUEVA_VACIA);
  const [guardando, setGuardando] = useState(false);

  const [modalPermisos, setModalPermisos] = useState<Sucursal | null>(null);
  const [usuariosConAcceso, setUsuariosConAcceso] = useState<Usuario[]>([]);
  const [usuarioAAgregar, setUsuarioAAgregar] = useState<number | ''>('');

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [suc, usr] = await Promise.all([sucursalesApi.listarSucursales(), usuariosApi.listarUsuarios()]);
      setSucursales(suc);
      setUsuarios(usr);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las sucursales'));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirNueva() {
    setEditando(null);
    setForm(NUEVA_VACIA);
    setModalAbierto(true);
  }

  function abrirEdicion(s: Sucursal) {
    setEditando(s);
    setForm({ nombre: s.nombre, direccion: s.direccion ?? '', telefono: s.telefono ?? '' });
    setModalAbierto(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await sucursalesApi.actualizarSucursal(editando.id, form);
      } else {
        const nuevaSucursal = await sucursalesApi.crearSucursal(form);
        setSucursalCreada(nuevaSucursal);
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar la sucursal'));
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActiva(s: Sucursal) {
    try {
      if (s.activo) {
        await sucursalesApi.desactivarSucursal(s.id);
      } else {
        await sucursalesApi.actualizarSucursal(s.id, { activo: true });
        setSucursalCreada(s); // Mostrar botón para ir a seleccionar sucursal
      }
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar la sucursal'));
    }
  }

  async function abrirPermisos(s: Sucursal) {
    setModalPermisos(s);
    try {
      setUsuariosConAcceso(await sucursalesApi.listarPermisos(s.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los permisos'));
    }
  }

  async function handleOtorgarPermiso() {
    if (!modalPermisos || !usuarioAAgregar) return;
    try {
      await sucursalesApi.otorgarPermiso(modalPermisos.id, Number(usuarioAAgregar));
      setUsuariosConAcceso(await sucursalesApi.listarPermisos(modalPermisos.id));
      setUsuarioAAgregar('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo otorgar el permiso'));
    }
  }

  async function handleRevocarPermiso(usuarioId: number) {
    if (!modalPermisos) return;
    try {
      await sucursalesApi.revocarPermiso(modalPermisos.id, usuarioId);
      setUsuariosConAcceso(await sucursalesApi.listarPermisos(modalPermisos.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo revocar el permiso'));
    }
  }

  const usuariosDisponibles = usuarios.filter((u) => !usuariosConAcceso.some((a) => a.id === u.id));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Sucursales</h3>
        <Button onClick={abrirNueva}>+ Nueva sucursal</Button>
      </div>

      {sucursalCreada && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setSucursalCreada(null)}
          className="d-flex justify-content-between align-items-center"
        >
          <span>✓ Sucursal "{sucursalCreada.nombre}" creada/activada exitosamente</span>
          <Button size="sm" variant="success" onClick={() => navigate('/seleccionar-sucursal')}>
            Ir a seleccionar sucursal
          </Button>
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {cargando ? (
        <Spinner animation="border" />
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sucursales.map((s) => (
              <tr key={s.id}>
                <td>{s.nombre}</td>
                <td>{s.direccion ?? '-'}</td>
                <td>{s.telefono ?? '-'}</td>
                <td>
                  <Badge bg={s.activo ? 'success' : 'secondary'}>{s.activo ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="text-nowrap">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    className="me-2"
                    onClick={() => abrirEdicion(s)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="me-2"
                    onClick={() => abrirPermisos(s)}
                  >
                    Permisos
                  </Button>
                  <Button
                    size="sm"
                    variant={s.activo ? 'outline-danger' : 'outline-success'}
                    onClick={() => toggleActiva(s)}
                  >
                    {s.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={modalAbierto} onHide={() => setModalAbierto(false)}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editando ? 'Editar sucursal' : 'Nueva sucursal'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Dirección</Form.Label>
              <Form.Control
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </Form.Group>
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

      <Modal show={!!modalPermisos} onHide={() => setModalPermisos(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Permisos de {modalPermisos?.nombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">Usuarios con acceso a esta sucursal:</p>
          <Table size="sm" bordered>
            <tbody>
              {usuariosConAcceso.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.nombre} {u.apellido} <span className="text-muted small">({u.rol})</span>
                  </td>
                  <td className="text-end" style={{ width: 100 }}>
                    <Button size="sm" variant="outline-danger" onClick={() => handleRevocarPermiso(u.id)}>
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
              {usuariosConAcceso.length === 0 && (
                <tr>
                  <td className="text-center text-muted">Sin usuarios con acceso</td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="d-flex gap-2 mt-3">
            <Form.Select
              value={usuarioAAgregar}
              onChange={(e) => setUsuarioAAgregar(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Seleccionar usuario...</option>
              {usuariosDisponibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} ({u.rol})
                </option>
              ))}
            </Form.Select>
            <Button onClick={handleOtorgarPermiso} disabled={!usuarioAAgregar}>
              Agregar
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
