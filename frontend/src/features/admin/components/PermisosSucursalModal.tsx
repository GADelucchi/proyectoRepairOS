import { useState } from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Sucursal, Usuario } from '@/shared/types';
import { nombreCompleto } from '@/shared/utils/texto';
import * as sucursalesApi from '../api/sucursales';

interface PermisosSucursalModalProps {
  sucursal: Sucursal;
  usuarios: Usuario[];
  onCerrar: () => void;
}

/** Qué usuarios pueden trabajar en una sucursal. Los admins entran a todas igual. */
export function PermisosSucursalModal({ sucursal, usuarios, onCerrar }: PermisosSucursalModalProps) {
  const {
    datos: conAcceso = [],
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(
    () => sucursalesApi.listarPermisos(sucursal.id),
    [sucursal.id],
    'No se pudieron cargar los permisos'
  );
  const { enCurso, ejecutar } = useAccion(setError);
  const [aAgregar, setAAgregar] = useState<number | ''>('');

  const disponibles = usuarios.filter((u) => !conAcceso.some((a) => a.id === u.id));

  async function otorgar() {
    if (!aAgregar) return;
    if (
      await ejecutar(
        () => sucursalesApi.otorgarPermiso(sucursal.id, aAgregar),
        'No se pudo otorgar el permiso'
      )
    ) {
      setAAgregar('');
      recargar();
    }
  }

  async function revocar(usuarioId: number) {
    if (
      await ejecutar(
        () => sucursalesApi.revocarPermiso(sucursal.id, usuarioId),
        'No se pudo quitar el permiso'
      )
    ) {
      recargar();
    }
  }

  return (
    <Modal show onHide={onCerrar}>
      <Modal.Header closeButton>
        <Modal.Title>Permisos de {sucursal.nombre}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <AlertaError error={error} />
        <p className="text-muted small">Usuarios con acceso a esta sucursal:</p>
        {cargando ? (
          <Cargando />
        ) : (
          <Table size="sm" bordered>
            <tbody>
              {conAcceso.map((u) => (
                <tr key={u.id}>
                  <td>
                    {nombreCompleto(u)} <span className="text-muted small">({u.rol})</span>
                  </td>
                  <td className="text-end" style={{ width: 100 }}>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={enCurso}
                      onClick={() => revocar(u.id)}
                    >
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
              {conAcceso.length === 0 && (
                <tr>
                  <td className="text-center text-muted">Sin usuarios con acceso</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
        <div className="d-flex gap-2 mt-3">
          <Form.Select
            aria-label="Usuario a agregar"
            value={aAgregar}
            onChange={(e) => setAAgregar(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Seleccionar usuario...</option>
            {disponibles.map((u) => (
              <option key={u.id} value={u.id}>
                {nombreCompleto(u)} ({u.rol})
              </option>
            ))}
          </Form.Select>
          <Button onClick={otorgar} disabled={!aAgregar || enCurso}>
            Agregar
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
