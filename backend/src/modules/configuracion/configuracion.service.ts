import { z } from 'zod';
import { Taller } from '../../models';
import { ATRIBUTOS_FISCALES } from '../../models/Taller';
import { errores } from '../../shared/http/http-error';
import { monedaDePais } from '../../shared/utils/paises';
import { actualizarTallerSchema } from './configuracion.schemas';

/** Solo los datos con los que factura el taller. */
export function datosFiscalesDe(taller: Taller) {
  return Object.fromEntries(ATRIBUTOS_FISCALES.map((campo) => [campo, taller[campo] ?? null]));
}

/** Nombre, país, opciones del stock y la venta, y datos fiscales del taller. Las órdenes ya cargadas conservan su moneda. */
export async function actualizarTaller(
  tallerId: number,
  { fiscal, ...datos }: z.infer<typeof actualizarTallerSchema>
) {
  const taller = await Taller.findByPk(tallerId);
  if (!taller) throw errores.noEncontrado('Taller');
  await taller.update({ ...datos, ...fiscal });
  return {
    id: taller.id,
    nombre: taller.nombre,
    pais: taller.pais,
    moneda: monedaDePais(taller.pais),
    stockEntreSucursales: taller.stockEntreSucursales,
    terminosVenta: taller.terminosVenta,
    fiscal: datosFiscalesDe(taller)
  };
}
