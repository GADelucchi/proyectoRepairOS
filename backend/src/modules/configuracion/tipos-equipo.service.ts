import { Transaction } from 'sequelize';
import { Sucursal, TipoEquipoPersonalizado } from '../../models';
import { errores } from '../../shared/http/http-error';

/**
 * Corta si el tipo de equipo no pertenece a una sucursal del taller.
 *
 * Los tipos cuelgan de la sucursal y no tienen `taller_id` propio, así que se
 * valida a través de ella: sin esto, un equipo podía quedar apuntando al tipo
 * de otro taller con solo conocer su id.
 */
export async function exigirTipoDelTaller(
  tipoId: number,
  tallerId: number,
  transaction?: Transaction
): Promise<TipoEquipoPersonalizado> {
  const tipo = await TipoEquipoPersonalizado.findOne({
    where: { id: tipoId },
    include: [{ model: Sucursal, as: 'sucursal', where: { tallerId }, attributes: [] }],
    transaction
  });
  if (!tipo) throw errores.noEncontrado('Tipo de equipo');
  return tipo;
}
