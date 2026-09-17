import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import * as clientesApi from '../api/clientes';
import { Cliente } from '../types';
import { getApiErrorMessage } from '../api/client';
import {
  ClienteFormFields,
  ClienteFormData,
  CLIENTE_FORM_VACIO,
  clienteAFormulario
} from '../components/ClienteFormFields';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { formatearMonto } from '../utils/formato';

export function ClientesPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteFormData>(CLIENTE_FORM_VACIO);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    clientesApi
      .listarClientes(busquedaDebounced || undefined)
      .then((data) => {
        if (activo) setClientes(data);
      })
      .catch((err) => {
        if (activo) setError(getApiErrorMessage(err, 'No se pudieron cargar los clientes'));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [busquedaDebounced]);

  async function recargar() {
    try {
      setClientes(await clientesApi.listarClientes(busquedaDebounced || undefined));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los clientes'));
    }
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(CLIENTE_FORM_VACIO);
    setErrorFecha(null);
    setModalAbierto(true);
  }

  function abrirEdicion(cliente: Cliente) {
    setEditando(cliente);
    setForm(clienteAFormulario(cliente));
    setErrorFecha(null);
    setModalAbierto(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (errorFecha) {
      setError('Revisá la fecha de nacimiento antes de guardar.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const payload = clientesApi.formularioAClienteInput(form);
      if (editando) {
        await clientesApi.actualizarCliente(editando.id, payload);
      } else {
        await clientesApi.crearCliente(payload);
      }
      setModalAbierto(false);
      await recargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el cliente'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(cliente: Cliente) {
    if (!window.confirm(`¿Eliminar a ${cliente.nombre} ${cliente.apellido}?`)) return;
    try {
      await clientesApi.eliminarCliente(cliente.id);
      await recargar();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el cliente'));
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Clientes</h3>
        <Button onClick={abrirNuevo}>+ Nuevo cliente</Button>
      </div>

      <Form className="mb-3" onSubmit={(e) => e.preventDefault()}>
        <Form.Control
          placeholder="Buscar por nombre, apellido, DNI/CUIT, teléfono o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </Form>

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
              <th>DNI/CUIT</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Dirección</th>
              <th>Gremio</th>
              <th className="text-end">Saldo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.nombre} {c.apellido}
                </td>
                <td>{c.dniCuit ?? '-'}</td>
                <td>{c.telefono ?? '-'}</td>
                <td>{c.email ?? '-'}</td>
                <td>{c.direccion ?? '-'}</td>
                <td>{c.esGremio ? (c.nombreGremio ?? 'Sí') : '-'}</td>
                <td className="text-end">
                  {c.saldo && c.saldo > 0 ? (
                    <Link to="/cuentas" className="text-danger fw-semibold text-decoration-none">
                      {formatearMonto(c.saldo)}
                    </Link>
                  ) : (
                    <span className="text-muted">{c.cuentaCorrienteHabilitada ? 'Al día' : '-'}</span>
                  )}
                </td>
                <td className="text-nowrap">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    className="me-2"
                    onClick={() => abrirEdicion(c)}
                  >
                    Editar
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => handleEliminar(c)}>
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  No hay clientes cargados
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <Modal show={modalAbierto} onHide={() => setModalAbierto(false)}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editando ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ClienteFormFields
              value={form}
              onChange={setForm}
              disabled={guardando}
              onFechaInvalida={setErrorFecha}
              puedeEditarCuentaCorriente={esAdmin}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || !!errorFecha}>
              {guardando ? <Spinner size="sm" animation="border" /> : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
