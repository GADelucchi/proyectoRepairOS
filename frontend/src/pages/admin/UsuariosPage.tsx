import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import * as usuariosApi from '../../api/usuarios';
import { RolUsuario, Usuario } from '../../types';
import { getApiErrorMessage } from '../../api/client';
import { PasswordFields, passwordListo } from '../../components/PasswordFields';

const NUEVO_VACIO = {
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  passwordConfirmacion: '',
  rol: 'tecnico' as RolUsuario
};

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(NUEVO_VACIO);
  const [guardando, setGuardando] = useState(false);

  const [modalPassword, setModalPassword] = useState<Usuario | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [nuevaPasswordConfirmacion, setNuevaPasswordConfirmacion] = useState('');

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      setUsuarios(await usuariosApi.listarUsuarios());
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los usuarios'));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordListo(form.password, form.passwordConfirmacion)) {
      setError('Revisá la contraseña antes de guardar.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await usuariosApi.crearUsuario(form);
      setModalAbierto(false);
      setForm(NUEVO_VACIO);
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo crear el usuario'));
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(usuario: Usuario) {
    try {
      await usuariosApi.actualizarUsuario(usuario.id, { activo: !usuario.activo });
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar el usuario'));
    }
  }

  async function cambiarRol(usuario: Usuario, rol: RolUsuario) {
    try {
      await usuariosApi.actualizarUsuario(usuario.id, { rol });
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar el rol'));
    }
  }

  async function handleCambiarPassword(e: FormEvent) {
    e.preventDefault();
    if (!modalPassword) return;
    if (!passwordListo(nuevaPassword, nuevaPasswordConfirmacion)) {
      setError('Revisá la contraseña antes de guardar.');
      return;
    }
    try {
      await usuariosApi.cambiarPassword(modalPassword.id, nuevaPassword, nuevaPasswordConfirmacion);
      cerrarModalPassword();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cambiar la contraseña'));
    }
  }

  function cerrarModalPassword() {
    setModalPassword(null);
    setNuevaPassword('');
    setNuevaPasswordConfirmacion('');
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Usuarios</h3>
        <Button onClick={() => setModalAbierto(true)}>+ Nuevo usuario</Button>
      </div>

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
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.nombre} {u.apellido}
                </td>
                <td>{u.email}</td>
                <td>
                  <Form.Select
                    size="sm"
                    value={u.rol}
                    onChange={(e) => cambiarRol(u, e.target.value as RolUsuario)}
                    style={{ width: 130 }}
                  >
                    <option value="tecnico">Técnico</option>
                    <option value="admin">Admin</option>
                  </Form.Select>
                </td>
                <td>
                  <Badge bg={u.activo ? 'success' : 'secondary'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                </td>
                <td className="text-nowrap">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="me-2"
                    onClick={() => setModalPassword(u)}
                  >
                    Cambiar contraseña
                  </Button>
                  <Button
                    size="sm"
                    variant={u.activo ? 'outline-danger' : 'outline-success'}
                    onClick={() => toggleActivo(u)}
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
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
            <Modal.Title>Nuevo usuario</Modal.Title>
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
              <Form.Label>Apellido</Form.Label>
              <Form.Control
                required
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Form.Group>
            <PasswordFields
              password={form.password}
              confirmacion={form.passwordConfirmacion}
              onPasswordChange={(password) => setForm({ ...form, password })}
              onConfirmacionChange={(passwordConfirmacion) => setForm({ ...form, passwordConfirmacion })}
              disabled={guardando}
            />
            <Form.Group className="mb-2">
              <Form.Label>Rol</Form.Label>
              <Form.Select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as RolUsuario })}
              >
                <option value="tecnico">Técnico</option>
                <option value="admin">Admin</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={guardando || !passwordListo(form.password, form.passwordConfirmacion)}
            >
              {guardando ? <Spinner size="sm" animation="border" /> : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={!!modalPassword} onHide={cerrarModalPassword}>
        <Form onSubmit={handleCambiarPassword}>
          <Modal.Header closeButton>
            <Modal.Title>Cambiar contraseña de {modalPassword?.nombre}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <PasswordFields
              label="Nueva contraseña"
              password={nuevaPassword}
              confirmacion={nuevaPasswordConfirmacion}
              onPasswordChange={setNuevaPassword}
              onConfirmacionChange={setNuevaPasswordConfirmacion}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={cerrarModalPassword}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!passwordListo(nuevaPassword, nuevaPasswordConfirmacion)}>
              Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
