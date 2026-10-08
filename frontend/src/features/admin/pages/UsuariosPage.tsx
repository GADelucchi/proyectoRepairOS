import { useState } from 'react';
import { Alert, Badge, Button, Form } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { RolUsuario, Usuario } from '@/shared/types';
import { nombreCompleto } from '@/shared/utils/texto';
import * as usuariosApi from '../api/usuarios';
import { CambiarPasswordModal } from '../components/CambiarPasswordModal';
import { NuevoUsuarioModal } from '../components/NuevoUsuarioModal';
import { UsoDelPlanAviso } from '../components/UsoDelPlanAviso';
import { planLleno } from '../uso-plan';

/** Técnicos y administradores del taller. */
export function UsuariosPage() {
  // El perfil trae cuánto del plan se usa: se refresca después de cada alta o baja.
  const { usuario: yo, refrescar } = useAuth();
  const {
    datos: usuarios = [],
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(usuariosApi.listarUsuarios, [], 'No se pudieron cargar los usuarios');
  const { ejecutar } = useAccion(setError);

  const [creando, setCreando] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState<Usuario | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function actualizar(u: Usuario, cambios: Parameters<typeof usuariosApi.actualizarUsuario>[1]) {
    if (
      await ejecutar(() => usuariosApi.actualizarUsuario(u.id, cambios), 'No se pudo actualizar el usuario')
    ) {
      recargar();
      refrescar();
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Usuarios</h3>
        <Button onClick={() => setCreando(true)} disabled={planLleno(yo?.usoDelPlan, 'usuarios')}>
          + Nuevo usuario
        </Button>
      </div>
      <UsoDelPlanAviso recurso="usuarios" />

      <AlertaError error={error} onCerrar={() => setError(null)} />
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      {cargando ? (
        <Cargando />
      ) : (
        <TablaApilable striped bordered hover responsive>
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
            {usuarios.map((u) => {
              // Nadie se quita a sí mismo el rol ni se desactiva: el taller quedaría sin administrador.
              const soyYo = u.id === yo?.id;
              return (
                <tr key={u.id}>
                  <td>
                    {nombreCompleto(u)} {soyYo && <span className="text-muted small">(vos)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <Form.Select
                      size="sm"
                      aria-label={`Rol de ${nombreCompleto(u)}`}
                      value={u.rol}
                      disabled={soyYo}
                      onChange={(e) => actualizar(u, { rol: e.target.value as RolUsuario })}
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
                      onClick={() => setCambiandoPassword(u)}
                    >
                      Cambiar contraseña
                    </Button>
                    <Button
                      size="sm"
                      variant={u.activo ? 'outline-danger' : 'outline-success'}
                      disabled={soyYo}
                      onClick={() => actualizar(u, { activo: !u.activo })}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TablaApilable>
      )}

      <NuevoUsuarioModal
        show={creando}
        onCerrar={() => setCreando(false)}
        onCreado={() => {
          setCreando(false);
          recargar();
          refrescar();
        }}
      />
      <CambiarPasswordModal
        usuario={cambiandoPassword}
        onCerrar={() => setCambiandoPassword(null)}
        onCambiada={() => {
          setMensaje(`Contraseña de ${cambiandoPassword?.nombre} actualizada.`);
          setCambiandoPassword(null);
        }}
      />
    </div>
  );
}
