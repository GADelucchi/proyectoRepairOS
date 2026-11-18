import type {
  Articulo,
  CostoAgrupado,
  MovimientoInventario,
  TipoArticulo,
  TipoMovimientoInventario
} from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';

export const ETIQUETA_TIPO: Record<TipoArticulo, string> = {
  repuesto: 'Repuesto',
  accesorio: 'Accesorio',
  servicio: 'Servicio'
};

/** Clase del badge de cada grupo: se distinguen también por el texto, no solo por el color. */
export const BADGE_TIPO: Record<TipoArticulo, string> = {
  repuesto: 'badge-blue',
  accesorio: 'badge-violet',
  servicio: 'badge-amber'
};

/** "5 × US$ 100 · 5 × US$ 120": lo que queda, agrupado por lo que costó. */
export function textoCostos(costos: CostoAgrupado[]): string {
  return costos.map((c) => `${c.cantidad} × ${formatearMonto(c.costo, c.moneda)}`).join(' · ');
}

/** "Lista US$ 190": los precios con monto, en una línea cada uno. */
export function lineasDePrecios(articulo: Pick<Articulo, 'precios'>): string[] {
  return articulo.precios
    .filter((p) => p.monto != null && p.moneda)
    .map((p) => `${p.nombre} ${formatearMonto(p.monto!, p.moneda!)}`);
}

const TEXTO_MOVIMIENTO: Record<TipoMovimientoInventario, string> = {
  entrada: 'Entrada',
  orden: 'Usado en una orden',
  orden_devolucion: 'Volvió de una orden',
  perdida: 'Se perdió en una orden',
  venta: 'Vendido',
  venta_devolucion: 'Volvió de una venta',
  equipo_stock: 'Puesto en un equipo del stock',
  equipo_stock_devolucion: 'Volvió de un equipo del stock',
  pase_salida: 'Pase a otra sucursal',
  pase_entrada: 'Llegó por un pase',
  pase_cancelado: 'Pase cancelado: volvió',
  baja: 'Dado de baja',
  ajuste: 'Ajuste por conteo'
};

/** "Usado en la orden 0287", "Vendido en VTA-000021", "Pase P-0005". */
export function textoMovimiento(m: MovimientoInventario): string {
  if (m.orden) {
    const verbo = { orden: 'Usado en', orden_devolucion: 'Volvió de', perdida: 'Se perdió en' }[
      m.tipo as 'orden' | 'orden_devolucion' | 'perdida'
    ];
    if (verbo) return `${verbo} la orden ${m.orden.numero}`;
  }
  if (m.venta && (m.tipo === 'venta' || m.tipo === 'venta_devolucion')) {
    return `${m.tipo === 'venta' ? 'Vendido en' : 'Volvió de'} ${m.venta.etiqueta}`;
  }
  if (m.pase) return `${TEXTO_MOVIMIENTO[m.tipo]} ${m.pase.etiqueta}`;
  if (m.equipoStock) {
    return `${TEXTO_MOVIMIENTO[m.tipo]} #${String(m.equipoStock.numero).padStart(4, '0')}`;
  }
  return TEXTO_MOVIMIENTO[m.tipo];
}

/** Cantidad con signo para el historial: "+5", "−1", "0". */
export function cantidadConSigno(cantidad: number): string {
  if (cantidad > 0) return `+${cantidad}`;
  if (cantidad < 0) return `−${Math.abs(cantidad)}`;
  return '0';
}

/** Si el costo es en otra moneda, el equivalente en dólares: "AR$ 115.000 (US$ 100)". */
export function textoCostoUnitario(c: {
  moneda: CostoAgrupado['moneda'] | null;
  costo: number | null;
  costoUsd: number | null;
}): string {
  if (c.costo == null || !c.moneda) return '';
  const base = formatearMonto(c.costo, c.moneda);
  return c.moneda === 'USD' || c.costoUsd == null ? base : `${base} (${formatearMonto(c.costoUsd, 'USD')})`;
}
