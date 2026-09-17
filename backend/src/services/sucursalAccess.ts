import { Sucursal, User } from '../models';

/**
 * Sucursales en las que un usuario puede trabajar.
 *
 * Regla única del sistema: el admin entra a cualquier sucursal activa de su
 * taller; el técnico, solo a las que tiene asignadas en `usuario_sucursales`.
 *
 * Vive acá porque antes estaba escrita por duplicado —en `/auth/me` y en
 * `seleccionarSucursal`— con criterios distintos, y esa discrepancia dejaba al
 * admin rebotando entre la selección de sucursal y el listado de órdenes.
 */
export async function sucursalesDisponiblesPara(user: User): Promise<Sucursal[]> {
  if (user.rol === 'admin') {
    return Sucursal.findAll({
      where: { tallerId: user.tallerId, activo: true },
      order: [['nombre', 'ASC']]
    });
  }

  const conSucursales = await User.findByPk(user.id, {
    include: [
      {
        model: Sucursal,
        as: 'sucursales',
        where: { activo: true, tallerId: user.tallerId },
        required: false
      }
    ],
    order: [[{ model: Sucursal, as: 'sucursales' }, 'nombre', 'ASC']]
  });

  return ((conSucursales as any)?.sucursales ?? []) as Sucursal[];
}

/** true si el usuario puede seleccionar esa sucursal. */
export async function puedeAccederASucursal(user: User, sucursalId: number): Promise<boolean> {
  const disponibles = await sucursalesDisponiblesPara(user);
  return disponibles.some((s) => s.id === sucursalId);
}
