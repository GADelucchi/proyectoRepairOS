import type { ConfigInventarioGuardada } from '../../models/Taller';
import type { TipoArticulo } from '../../models/Articulo';

export interface ConfigInventario {
  /**
   * Nombres de los tres precios. null es una posición que el taller no usa: no
   * se muestra en los productos (los montos que tenían se conservan).
   */
  precios: [string | null, string | null, string | null];
  /** Con el que arranca cada producto nuevo. */
  stockMinimoPorDefecto: number;
  /** Cuando una sucursal queda por debajo del mínimo: aviso en la app a sus usuarios. */
  avisoApp: boolean;
  /** ...y correo a los admins. */
  avisoEmail: boolean;
  /** Con qué empieza el código que se genera para cada tipo. */
  prefijos: Record<TipoArticulo, string>;
}

export const CONFIG_INVENTARIO_DE_FABRICA: ConfigInventario = {
  precios: ['Lista', 'Efectivo', 'Tarjeta'],
  stockMinimoPorDefecto: 0,
  avisoApp: true,
  avisoEmail: true,
  prefijos: { repuesto: 'R-', accesorio: 'A-', servicio: 'S-' }
};

/** La configuración del taller, con los valores de fábrica en lo que no definió. */
export function configDeInventario(guardada: ConfigInventarioGuardada | null | undefined): ConfigInventario {
  const fabrica = CONFIG_INVENTARIO_DE_FABRICA;
  const precios = guardada?.precios;
  return {
    precios: [0, 1, 2].map((i) =>
      precios ? precios[i]?.trim() || null : fabrica.precios[i]
    ) as ConfigInventario['precios'],
    stockMinimoPorDefecto: guardada?.stockMinimoPorDefecto ?? fabrica.stockMinimoPorDefecto,
    avisoApp: guardada?.avisoApp ?? fabrica.avisoApp,
    avisoEmail: guardada?.avisoEmail ?? fabrica.avisoEmail,
    prefijos: { ...fabrica.prefijos, ...guardada?.prefijos }
  };
}

/** "R-0012": el código que se genera para el número `n` del tipo. */
export const codigoGenerado = (prefijo: string, n: number) => `${prefijo}${String(n).padStart(4, '0')}`;

/** "E-0041" y "P-0005": cómo se nombran una entrada y un pase. */
export const etiquetaEntrada = (n: number) => `E-${String(n).padStart(4, '0')}`;
export const etiquetaPase = (n: number) => `P-${String(n).padStart(4, '0')}`;
