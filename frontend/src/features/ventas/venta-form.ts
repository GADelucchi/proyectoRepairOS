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
  vencida: 'Reserva vencida',
  anulada: 'Anulada'
};

export const VARIANTE_ESTADO_VENTA: Record<EstadoVenta, string> = {
  reservada: 'primary',
  senada: 'warning',
  completada: 'success',
  cancelada: 'secondary',
  vencida: 'secondary',
  anulada: 'danger'
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
  /** Vacío en un pago de una venta (si es el único sin monto): es todo lo que falta. */
  monto: string;
  medioPago: MedioPago;
  /** null: la moneda de la venta, aunque después se cambie. */
  moneda: Moneda | null;
  /** 1 US$ en la moneda que no es dólar, si el pago es en otra moneda que la venta. */
  cotizacion: string;
}

export const PAGO_VACIO: PagoForm = { monto: '', medioPago: 'efectivo', moneda: null, cotizacion: '' };

export const monedaDelPago = (p: PagoForm, monedaVenta: Moneda): Moneda => p.moneda ?? monedaVenta;

/**
 * Por qué no se puede tomar un pago en otra moneda, o null. Las mismas reglas
 * que la API: la cotización es siempre contra el dólar, así que el pago o la
 * venta tiene que ser en dólares.
 */
export function problemaDePago(p: PagoForm, monedaVenta: Moneda): string | null {
  const moneda = monedaDelPago(p, monedaVenta);
  if (moneda === monedaVenta) return null;
  if (moneda !== 'USD' && monedaVenta !== 'USD') {
    return `Una venta en ${monedaVenta} se cobra en ${monedaVenta} o en dólares, no en ${moneda}.`;
  }
  if (!(aNumero(p.cotizacion) > 0)) return `Indicá la cotización del pago en ${moneda}.`;
  return null;
}

/** Lo que cubre de la venta un monto en la moneda del pago, o null si falta la cotización. */
export function equivalenteDe(monto: number, p: PagoForm, monedaVenta: Moneda): number | null {
  const moneda = monedaDelPago(p, monedaVenta);
  if (moneda === monedaVenta) return redondear(monto);
  if (problemaDePago(p, monedaVenta)) return null;
  const cotizacion = aNumero(p.cotizacion);
  return redondear(moneda === 'USD' ? monto * cotizacion : monto / cotizacion);
}

/** Lo inverso: cuánto hay que poner en la moneda del pago para cubrir un monto de la venta. */
export function enMonedaDelPago(montoVenta: number, p: PagoForm, monedaVenta: Moneda): number | null {
  const moneda = monedaDelPago(p, monedaVenta);
  if (moneda === monedaVenta) return redondear(montoVenta);
  if (problemaDePago(p, monedaVenta)) return null;
  const cotizacion = aNumero(p.cotizacion);
  return redondear(moneda === 'USD' ? montoVenta / cotizacion : montoVenta * cotizacion);
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
    pagos: [PAGO_VACIO],
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

function pagoAInput(p: PagoForm, monto: number, monedaVenta: Moneda): PagoInput {
  const moneda = monedaDelPago(p, monedaVenta);
  return {
    monto,
    medioPago: p.medioPago,
    moneda,
    cotizacion: moneda === monedaVenta ? null : aNumero(p.cotizacion)
  };
}

const pagosConMonto = (pagos: PagoForm[], monedaVenta: Moneda): PagoInput[] =>
  pagos.filter((p) => aNumero(p.monto) > 0).map((p) => pagoAInput(p, aNumero(p.monto), monedaVenta));

/**
 * Lo que falta cubrir del saldo con los pagos que tienen monto, en la moneda
 * de la venta. Los pagos en otra moneda sin cotización no cuentan.
 */
export function restoDelSaldo(pagos: PagoForm[], saldo: number, monedaVenta: Moneda): number {
  const cubierto = pagos
    .filter((p) => aNumero(p.monto) > 0)
    .reduce((t, p) => t + (equivalenteDe(aNumero(p.monto), p, monedaVenta) ?? 0), 0);
  return redondear(saldo - cubierto);
}

/**
 * Pagos que cancelan un saldo. Si un solo pago quedó sin monto, ese pago es lo
 * que falta, pasado a su moneda: "US$ 900 y el resto en pesos".
 */
export function pagosConSaldo(pagos: PagoForm[], saldo: number, monedaVenta: Moneda): PagoInput[] {
  const vacios = pagos.filter((p) => !p.monto.trim());
  if (vacios.length !== 1) return pagosConMonto(pagos, monedaVenta);
  const resto = restoDelSaldo(pagos, saldo, monedaVenta);
  const montoResto = resto > 0 ? enMonedaDelPago(resto, vacios[0], monedaVenta) : null;
  return pagos.flatMap((p) => {
    if (p === vacios[0]) return montoResto ? [pagoAInput(p, montoResto, monedaVenta)] : [];
    return aNumero(p.monto) > 0 ? [pagoAInput(p, aNumero(p.monto), monedaVenta)] : [];
  });
}

/** Lo que cubren los pagos, en la moneda de la venta. */
export function cubiertoPor(pagos: PagoInput[], monedaVenta: Moneda): number {
  return redondear(
    pagos.reduce((t, p) => {
      const pago = { ...PAGO_VACIO, moneda: p.moneda, cotizacion: String(p.cotizacion ?? '') };
      return t + (equivalenteDe(p.monto, pago, monedaVenta) ?? 0);
    }, 0)
  );
}

/** Los pagos como los espera la API. En una venta, el único pago sin monto es todo lo que falta. */
export function pagosDelFormulario(f: VentaForm, aPagar: number): PagoInput[] {
  if (f.modo === 'reserva') return [];
  return f.modo === 'venta' ? pagosConSaldo(f.pagos, aPagar, f.moneda) : pagosConMonto(f.pagos, f.moneda);
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

  if (f.modo !== 'reserva') {
    const problema = f.pagos.map((p) => problemaDePago(p, f.moneda)).find(Boolean);
    if (problema) return problema;
  }
  const pagado = cubiertoPor(pagosDelFormulario(f, t.aPagar), f.moneda);
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
