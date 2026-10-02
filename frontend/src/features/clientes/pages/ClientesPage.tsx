import { useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Cliente } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFechaHora } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as clientesApi from '../api';
import { ClienteModal } from '../components/ClienteModal';

const AVISO_ANONIMIZAR =
  'Se borran de forma irreversible sus datos de contacto, las claves de desbloqueo y credenciales de sus ' +
  'equipos, y las firmas de sus órdenes.\n\nLas órdenes se conservan para el respaldo contable, sin vínculo ' +
  'con una persona identificable. Esta acción no se puede deshacer.';

export function ClientesPage() {
  const { esAdmin } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const {
    datos: clientes = [],
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(
    () => clientesApi.listarClientes(busquedaDebounced || undefined),
    [busquedaDebounced],
    'No se pudieron cargar los clientes'
  );
  const { ejecutar } = useAccion(setError);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);

  function abrirModal(cliente: Cliente | null) {
    setEditando(cliente);
    setModalAbierto(true);
  }

  async function eliminar(cliente: Cliente) {
    if (!window.confirm(`¿Eliminar a ${nombreCompleto(cliente)}?`)) return;
    if (await ejecutar(() => clientesApi.eliminarCliente(cliente.id), 'No se pudo eliminar el cliente'))
      recargar();
  }

  /**
   * Un cliente con órdenes no se puede eliminar sin romper el respaldo
   * contable: anonimizar es la vía para atender un pedido de supresión.
   */
  async function anonimizar(cliente: Cliente) {
    if (!window.confirm(`¿Anonimizar a ${nombreCompleto(cliente)}?\n\n${AVISO_ANONIMIZAR}`)) return;
    if (await ejecutar(() => clientesApi.anonimizarCliente(cliente.id), 'No se pudo anonimizar el cliente')) {
      recargar();
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Clientes</h3>
        <Button onClick={() => abrirModal(null)}>+ Nuevo cliente</Button>
      </div>

      <Form.Control
        className="mb-3"
        placeholder="Buscar por nombre, apellido, DNI/CUIT, teléfono o email..."
        aria-label="Buscar clientes"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <AlertaError error={error} onCerrar={() => setError(null)} />

      {cargando ? (
        <Cargando />
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
                <td>{nombreCompleto(c)}</td>
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
                  {c.anonimizadoEn ? (
                    <span className="text-muted small">
                      Anonimizado el {formatearFechaHora(c.anonimizadoEn)}
                    </span>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={() => abrirModal(c)}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="outline-danger" className="me-2" onClick={() => eliminar(c)}>
                        Eliminar
                      </Button>
                      {esAdmin && (
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          title="Atiende un pedido de supresión conservando el historial contable"
                          onClick={() => anonimizar(c)}
                        >
                          Anonimizar
                        </Button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  {busqueda ? 'Ningún cliente coincide con la búsqueda' : 'No hay clientes cargados'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <ClienteModal
        show={modalAbierto}
        cliente={editando}
        esAdmin={esAdmin}
        onCerrar={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
        }}
      />
    </div>
  );
}
