import { esImeiValido, soloDigitos } from '@/features/stock/stock-form';
import type { EquipoStock, EstadoVenta, MedioPago, Moneda, TipoDescuento } from '@/shared/types';
import { aNumero, redondear } from '@/shared/utils/dinero';
import { convertirAFormatoBackend } from '@/shared/utils/fechas';
import { textoONull } from '@/shared/utils/texto';
import type { CrearVentaInput, ModoVenta, PagoInput, PartePagoInput } from './api';

export const ETIQUETA_ESTADO_VENTA: Record<EstadoVenta, string> = {
  reservada: 'Reservada',
  senada: 'Señada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  vencida: 'Reserva vencida'
};

export const VARIANTE_ESTADO_VENTA: Record<EstadoVenta, string> = {
  reservada: 'primary',
  senada: 'warning',
  completada: 'success',
  cancelada: 'secondary',
  vencida: 'secondary'
};

/** A partir de estos días sin completar, una seña se marca y se avisa a los admins. Igual que la API. */
export const DIAS_AVISO_SENA = 15;

export const ETIQUETA_MODO: Record<ModoVenta, string> = {
  venta: 'Vender',
  sena: 'Señar',
  reserva: 'Reservar'
};

/** Un equipo del stock en la venta. `editado`: el precio lo cambió el vendedor y ya no sigue al de lista. */
export interface ItemVentaForm {
  equipo: EquipoStock;
  precio: string;
  editado: boolean;
}

/** Un equipo que deja el cliente, todo como texto. */
export interface PartePagoForm {
  marca: string;
  modelo: string;
  color: string;
  almacenamientoGb: string;
  bateria: string;
  numeroSerie: string;
  imei: string;
  imei2: string;
  monto: string;
  observaciones: string;
}

export const PARTE_VACIA: PartePagoForm = {
  marca: '',
  modelo: '',
  color: '',
  almacenamientoGb: '',
  bateria: '',
  numeroSerie: '',
  imei: '',
  imei2: '',
  monto: '',
  observaciones: ''
};

export interface PagoForm {
  /** Vacío en el único pago de una venta: es todo lo que falta. */
  monto: string;
  medioPago: MedioPago;
}

export interface VentaForm {
  moneda: Moneda;
  /** 1 US$ en la moneda de la venta. */
  cotizacion: string;
  items: ItemVentaForm[];
  descuentoTipo: TipoDescuento;
  descuentoValor: string;
  partes: PartePagoForm[];
  modo: ModoVenta;
  pagos: PagoForm[];
  /** DD/MM/AAAA */
  reservadaHasta: string;
  comentarioCliente: string;
  comentarioInterno: string;
}

export function ventaVacia(moneda: Moneda): VentaForm {
  return {
    moneda,
    cotizacion: '',
    items: [],
    descuentoTipo: 'porcentaje',
    descuentoValor: '',
    partes: [],
    modo: 'venta',
    pagos: [{ monto: '', medioPago: 'efectivo' }],
    reservadaHasta: '',
    comentarioCliente: '',
    comentarioInterno: ''
  };
}

/**
 * El precio de lista del equipo en la moneda de la venta. Si la lista está en
 * dólares y se vende en otra moneda, se multiplica por la cotización. Si no se
 * puede convertir (falta la cotización, o la lista es en otra moneda), null.
 */
export function precioEnMoneda(equipo: EquipoStock, moneda: Moneda, cotizacion: number): number | null {
  if (equipo.precio == null || !equipo.monedaPrecio) return null;
  const precio = aNumero(equipo.precio);
  if (equipo.monedaPrecio === moneda) return precio;
  if (equipo.monedaPrecio === 'USD' && cotizacion > 0) return redondear(precio * cotizacion);
  if (moneda === 'USD' && cotizacion > 0) return redondear(precio / cotizacion);
  return null;
}

/** Los precios que no tocó el vendedor siguen al de lista, en la moneda y cotización actuales. */
export function conPreciosDeLista(f: VentaForm): VentaForm {
  const cotizacion = aNumero(f.cotizacion);
  return {
    ...f,
    items: f.items.map((item) => {
      if (item.editado) return item;
      const precio = precioEnMoneda(item.equipo, f.moneda, cotizacion);
      // Sin poder convertir, mejor vacío que el número de otra moneda.
      return { ...item, precio: precio != null ? String(precio) : '' };
    })
  };
}

export interface TotalesVenta {
  subtotal: number;
  descuento: number;
  /** Lo que vale la venta. */
  total: number;
  partePago: number;
  /** Lo que se paga en plata. */
  aPagar: number;
}

/** Las mismas cuentas que hace la API: la parte de pago baja lo que se paga, no lo que vale la venta. */
export function totalesDeVenta(
  precios: number[],
  descuento: { tipo: TipoDescuento; valor: number } | null,
  partesPago: number[]
): TotalesVenta {
  const sumar = (montos: number[]) => redondear(montos.reduce((a, b) => a + b, 0));
  const subtotal = sumar(precios);
  const rebaja = !descuento
    ? 0
    : descuento.tipo === 'porcentaje'
      ? redondear((subtotal * descuento.valor) / 100)
      : redondear(descuento.valor);
  const total = redondear(subtotal - rebaja);
  const partePago = sumar(partesPago);
  return { subtotal, descuento: rebaja, total, partePago, aPagar: redondear(total - partePago) };
}

function descuentoDe(f: VentaForm) {
  const valor = aNumero(f.descuentoValor);
  return valor > 0 ? { tipo: f.descuentoTipo, valor } : null;
}

export function totalesDelFormulario(f: VentaForm): TotalesVenta {
  return totalesDeVenta(
    f.items.map((i) => aNumero(i.precio)),
    descuentoDe(f),
    f.partes.map((p) => aNumero(p.monto))
  );
}

const pagosConMonto = (pagos: PagoForm[]): PagoInput[] =>
  pagos.filter((p) => aNumero(p.monto) > 0).map((p) => ({ monto: aNumero(p.monto), medioPago: p.medioPago }));

/** Pagos que cancelan un saldo: un solo pago sin monto es el saldo completo. */
export function pagosConSaldo(pagos: PagoForm[], saldo: number): PagoInput[] {
  if (pagos.length === 1 && !pagos[0].monto.trim()) {
    return saldo > 0 ? [{ monto: saldo, medioPago: pagos[0].medioPago }] : [];
  }
  return pagosConMonto(pagos);
}

/** Los pagos como los espera la API. En una venta con un solo pago sin monto, ese pago es todo lo que falta. */
export function pagosDelFormulario(f: VentaForm, aPagar: number): PagoInput[] {
  if (f.modo === 'reserva') return [];
  return f.modo === 'venta' ? pagosConSaldo(f.pagos, aPagar) : pagosConMonto(f.pagos);
}

export function validarParte(p: PartePagoForm): string | null {
  if (!p.marca.trim() || !p.modelo.trim()) return 'Indicá marca y modelo del equipo que deja.';
  if (!p.numeroSerie.trim() && !p.imei.trim()) {
    return 'Cargá el IMEI o el serial del equipo que deja: entra al stock y es lo que lo identifica.';
  }
  for (const imei of [p.imei, p.imei2]) {
    if (imei.trim() && !esImeiValido(soloDigitos(imei))) return `El IMEI ${imei.trim()} no es válido.`;
  }
  if (p.bateria.trim()) {
    const bateria = Number(p.bateria);
    if (!Number.isInteger(bateria) || bateria < 0 || bateria > 100) return 'La batería va de 0 a 100 %.';
  }
  if (!(aNumero(p.monto) > 0)) return 'Indicá cuánto se le toma por el equipo.';
  return null;
}

export function parteAInput(p: PartePagoForm): PartePagoInput {
  return {
    marca: p.marca.trim(),
    modelo: p.modelo.trim(),
    color: textoONull(p.color),
    almacenamientoGb: p.almacenamientoGb ? Number(p.almacenamientoGb) : null,
    condicion: 'usado',
    bateria: p.bateria.trim() ? Number(p.bateria) : null,
    numeroSerie: textoONull(p.numeroSerie),
    imei: p.imei.trim() ? soloDigitos(p.imei) : null,
    imei2: p.imei2.trim() ? soloDigitos(p.imei2) : null,
    monto: aNumero(p.monto),
    observaciones: textoONull(p.observaciones)
  };
}

/** Lo que falta o está mal para confirmar la venta, o null. */
export function validarVenta(f: VentaForm, hoyIso: string): string | null {
  if (f.items.length === 0) return 'Agregá al menos un equipo del stock.';
  if (f.items.some((i) => !i.precio.trim() || aNumero(i.precio) < 0)) return 'Poné el precio de cada equipo.';
  if (f.moneda !== 'USD' && !(aNumero(f.cotizacion) > 0)) {
    return 'Indicá cuánto vale el dólar hoy: el informe de ventas se calcula en US$.';
  }
  if (f.descuentoTipo === 'porcentaje' && aNumero(f.descuentoValor) > 100) {
    return 'El descuento no puede pasar del 100 %.';
  }
  const t = totalesDelFormulario(f);
  if (t.descuento > t.subtotal) return 'El descuento no puede ser mayor que el precio de los equipos.';
  if (t.partePago > t.total) return 'Lo que deja el cliente vale más que la venta.';

  const pagado = redondear(pagosDelFormulario(f, t.aPagar).reduce((s, p) => s + p.monto, 0));
  if (f.modo === 'venta' && Math.abs(pagado - t.aPagar) >= 0.005) {
    return pagado < t.aPagar
      ? 'Para llevarse el equipo tiene que pagar todo. Si deja una parte, elegí Señar.'
      : 'Los pagos superan lo que hay que pagar.';
  }
  if (f.modo === 'sena') {
    if (pagado <= 0) return 'Indicá cuánto deja de seña.';
    if (pagado >= t.aPagar) return 'La seña cubre todo: elegí Vender.';
  }
  if (f.modo === 'reserva') {
    const hasta = convertirAFormatoBackend(f.reservadaHasta);
    if (!hasta) return 'Indicá hasta qué día se reserva.';
    if (hasta < hoyIso) return 'La reserva tiene que ser hasta hoy o una fecha posterior.';
  }
  return null;
}

/** El formulario ya validado, sin el cliente (que se elige aparte). */
export function formularioAVentaInput(f: VentaForm): Omit<CrearVentaInput, 'clienteId' | 'nuevoCliente'> {
  const t = totalesDelFormulario(f);
  return {
    items: f.items.map((i) => ({ equipoStockId: i.equipo.id, precio: aNumero(i.precio) })),
    moneda: f.moneda,
    cotizacion: f.moneda === 'USD' ? null : aNumero(f.cotizacion),
    descuento: descuentoDe(f),
    partesPago: f.partes.map(parteAInput),
    modo: f.modo,
    pagos: pagosDelFormulario(f, t.aPagar),
    reservadaHasta: f.modo === 'reserva' ? convertirAFormatoBackend(f.reservadaHasta) : null,
    comentarioCliente: textoONull(f.comentarioCliente),
    comentarioInterno: textoONull(f.comentarioInterno)
  };
}

/** Días enteros desde una fecha hasta hoy. */
export function diasDesde(fecha: string | Date, ahora = new Date()): number {
  return Math.floor((ahora.getTime() - new Date(fecha).getTime()) / (24 * 60 * 60 * 1000));
}
