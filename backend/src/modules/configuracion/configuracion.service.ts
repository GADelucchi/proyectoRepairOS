import { z } from 'zod';
import { Taller } from '../../models';
import { errores } from '../../shared/http/http-error';
import { monedaDePais } from '../../shared/utils/paises';
import { actualizarTallerSchema } from './configuracion.schemas';

/** Nombre y país del taller. Las órdenes ya cargadas conservan su moneda. */
export async function actualizarTaller(tallerId: number, datos: z.infer<typeof actualizarTallerSchema>) {
  const taller = await Taller.findByPk(tallerId);
  if (!taller) throw errores.noEncontrado('Taller');
  await taller.update(datos);
  return { id: taller.id, nombre: taller.nombre, pais: taller.pais, moneda: monedaDePais(taller.pais) };
}
