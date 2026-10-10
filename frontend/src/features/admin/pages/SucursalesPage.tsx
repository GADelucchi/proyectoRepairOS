import { useState } from 'react';
import { Alert, Badge, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Sucursal } from '@/shared/types';
import { filaClickeable } from '@/shared/utils/filas';
import * as sucursalesApi from '../api/sucursales';
import * as usuariosApi from '../api/usuarios';
import { PermisosSucursalModal } from '../components/PermisosSucursalModal';
import { SucursalModal } from '../components/SucursalModal';
import { UsoDelPlanAviso } from '../components/UsoDelPlanAviso';
import { planLleno } from '../uso-plan';

export function SucursalesPage() {
  const navigate = useNavigate();
  const { usuario, refrescar } = useAuth();
  const { datos, cargando, error, setError, recargar } = useConsulta(
    async () => {
      const [sucursales, usuarios] = await Promise.all([
        sucursalesApi.listarSucursales(),
        usuariosApi.listarUsuarios()
      ]);
      return { sucursales, usuarios };
    },
    [],
    'No se pudieron cargar las sucursales',
    'sucursales'
  );
  const { ejecutar } = useAccion(setError);
  const sucursales = datos?.sucursales ?? [];

  // `undefined` = modal cerrado; `null` = alta de una sucursal nueva.
  const [editando, setEditando] = useState<Sucursal | null | undefined>(undefined);
  const [permisos, setPermisos] = useState<Sucursal | null>(null);
  const [habilitada, setHabilitada] = useState<Sucursal | null>(null);

  /** Las sucursales disponibles del menú salen del perfil: se refresca al cambiarlas. */
  function despuesDeCambiar() {
    recargar();
    refrescar();
  }

  async function alternarActiva(s: Sucursal) {
    const ok = await ejecutar(
      () =>
        s.activo
          ? sucursalesApi.desactivarSucursal(s.id)
          : sucursalesApi.actualizarSucursal(s.id, { activo: true }),
      'No se pudo actualizar la sucursal'
    );
    if (ok) {
      if (!s.activo) setHabilitada(s);
      despuesDeCambiar();
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Sucursales</h3>
        <Button onClick={() => setEditando(null)} disabled={planLleno(usuario?.usoDelPlan, 'sucursales')}>
          + Nueva sucursal
        </Button>
      </div>
      <UsoDelPlanAviso recurso="sucursales" />

      {habilitada && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setHabilitada(null)}
          className="d-flex justify-content-between align-items-center"
        >
          <span>✓ Sucursal "{habilitada.nombre}" lista para usar</span>
          <Button size="sm" variant="success" onClick={() => navigate('/seleccionar-sucursal?cambiar=true')}>
            Ir a seleccionar sucursal
          </Button>
        </Alert>
      )}

      <AlertaError error={error} onCerrar={() => setError(null)} />

      {cargando ? (
        <Cargando />
      ) : (
        <TablaApilable striped bordered hover responsive>
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
              <tr key={s.id} {...filaClickeable(() => setEditando(s))}>
                <td>{s.nombre}</td>
                <td>{s.direccion ?? '-'}</td>
                <td>{s.telefono ?? '-'}</td>
                <td>
                  <Badge bg={s.activo ? 'success' : 'secondary'}>{s.activo ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="text-nowrap">
                  <Button size="sm" variant="outline-primary" className="me-2" onClick={() => setEditando(s)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="me-2"
                    onClick={() => setPermisos(s)}
                  >
                    Permisos
                  </Button>
                  <Button
                    size="sm"
                    variant={s.activo ? 'outline-danger' : 'outline-success'}
                    onClick={() => alternarActiva(s)}
                  >
                    {s.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {sucursales.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  Todavía no hay sucursales. Creá la primera para empezar a trabajar.
                </td>
              </tr>
            )}
          </tbody>
        </TablaApilable>
      )}

      <SucursalModal
        show={editando !== undefined}
        sucursal={editando ?? null}
        onCerrar={() => setEditando(undefined)}
        onGuardada={(sucursal, nueva) => {
          setEditando(undefined);
          if (nueva) setHabilitada(sucursal);
          despuesDeCambiar();
        }}
      />
      {permisos && (
        <PermisosSucursalModal
          sucursal={permisos}
          usuarios={datos?.usuarios ?? []}
          onCerrar={() => setPermisos(null)}
        />
      )}
    </div>
  );
}
