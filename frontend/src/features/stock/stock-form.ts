import type { CondicionEquipo, EquipoStock, EstadoStock, Moneda } from '@/shared/types';
import { aNumero } from '@/shared/utils/dinero';
import { convertirAFormatoBackend, convertirDesdeBackend } from '@/shared/utils/fechas';
import { textoONull } from '@/shared/utils/texto';
import type { EquipoStockInput } from './api';

export const ETIQUETA_ESTADO_STOCK: Record<EstadoStock, string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  senado: 'Señado',
  vendido: 'Vendido',
  baja: 'Dado de baja'
};

/** Color del badge de cada estado (variantes de Bootstrap). */
export const VARIANTE_ESTADO_STOCK: Record<EstadoStock, string> = {
  disponible: 'success',
  reservado: 'primary',
  senado: 'warning',
  vendido: 'secondary',
  baja: 'dark'
};

/** Los tamaños más comunes, para elegir con un toque en vez de tipear. */
export const ALMACENAMIENTOS_GB = [64, 128, 256, 512, 1024];

/** #0042 */
export const etiquetaNumero = (numero: number) => `#${String(numero).padStart(4, '0')}`;

/** 128 GB · 1 TB */
export function textoAlmacenamiento(gb: number | null | undefined): string {
  if (!gb) return '';
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

/** "Apple iPhone 13 · 128 GB · Medianoche" */
export function describirEquipoStock(
  e: Pick<EquipoStock, 'marca' | 'modelo' | 'almacenamientoGb' | 'color'>
) {
  return [`${e.marca} ${e.modelo}`, textoAlmacenamiento(e.almacenamientoGb), e.color]
    .filter(Boolean)
    .join(' · ');
}

/** "Usado · Batería 86%" · "Nuevo" */
export function detalleCondicion(e: Pick<EquipoStock, 'condicion' | 'bateria'>): string {
  if (e.condicion === 'nuevo') return 'Nuevo';
  return e.bateria != null ? `Usado · Batería ${e.bateria}%` : 'Usado';
}

/** IMEI: 15 dígitos y el último es de control (Luhn). La API valida lo mismo. */
export function esImeiValido(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let suma = 0;
  for (let i = 0; i < 15; i++) {
    let digito = Number(imei[i]);
    if (i % 2 === 1) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
  }
  return suma % 10 === 0;
}

/** Saca espacios y guiones: el IMEI viene impreso así en las cajas. */
export const soloDigitos = (valor: string) => valor.replace(/\D/g, '');

/**
 * El IMEI que trae un código leído con la cámara, o null si no trae ninguno.
 * Un QR puede traer más datos ("IMEI1: 35… IMEI2: 35…"): se toma el primero
 * válido que no sea `distintoDe` (el que ya está cargado en el otro campo).
 */
export function imeiLeido(texto: string, distintoDe?: string): string | null {
  const candidatos = texto.match(/\d{15}/g) ?? [];
  return candidatos.find((c) => esImeiValido(c) && c !== soloDigitos(distintoDe ?? '')) ?? null;
}

/** Lo que se tipea en el formulario, todo como texto. */
export interface EquipoStockForm {
  marca: string;
  modelo: string;
  color: string;
  /** Número tal cual se escribió; la unidad va aparte. */
  almacenamiento: string;
  unidad: 'GB' | 'TB';
  condicion: CondicionEquipo;
  bateria: string;
  numeroSerie: string;
  imei: string;
  imei2: string;
  /** DD/MM/AAAA */
  fechaCompra: string;
  proveedor: string;
  monedaCosto: Moneda;
  costo: string;
  cotizacionCosto: string;
  monedaPrecio: Moneda;
  precio: string;
  observaciones: string;
}

export function formularioVacio(hoy: string): EquipoStockForm {
  return {
    marca: '',
    modelo: '',
    color: '',
    almacenamiento: '',
    unidad: 'GB',
    condicion: 'usado',
    bateria: '',
    numeroSerie: '',
    imei: '',
    imei2: '',
    fechaCompra: hoy,
    proveedor: '',
    // Los celulares se compran y se venden casi siempre en dólares.
    monedaCosto: 'USD',
    costo: '',
    cotizacionCosto: '',
    monedaPrecio: 'USD',
    precio: '',
    observaciones: ''
  };
}

/**
 * "Guardar y cargar otro igual": queda todo lo que suele repetirse en un lote
 * (modelo, costo, precio, proveedor) y se vacía lo propio de cada unidad.
 */
export function otroIgual(f: EquipoStockForm): EquipoStockForm {
  return { ...f, bateria: '', numeroSerie: '', imei: '', imei2: '', observaciones: '' };
}

export function equipoAFormulario(e: EquipoStock): EquipoStockForm {
  const enTb = e.almacenamientoGb != null && e.almacenamientoGb >= 1024 && e.almacenamientoGb % 1024 === 0;
  return {
    marca: e.marca,
    modelo: e.modelo,
    color: e.color ?? '',
    almacenamiento: e.almacenamientoGb ? String(enTb ? e.almacenamientoGb / 1024 : e.almacenamientoGb) : '',
    unidad: enTb ? 'TB' : 'GB',
    condicion: e.condicion,
    bateria: e.bateria != null ? String(e.bateria) : '',
    numeroSerie: e.numeroSerie ?? '',
    imei: e.imei ?? '',
    imei2: e.imei2 ?? '',
    fechaCompra: convertirDesdeBackend(e.fechaCompra),
    proveedor: e.proveedor ?? '',
    monedaCosto: e.monedaCosto,
    costo: e.costo != null ? String(aNumero(e.costo)) : '',
    cotizacionCosto: e.cotizacionCosto != null ? String(aNumero(e.cotizacionCosto)) : '',
    monedaPrecio: e.monedaPrecio ?? e.monedaCosto,
    precio: e.precio != null ? String(aNumero(e.precio)) : '',
    observaciones: e.observaciones ?? ''
  };
}

/**
 * Lo que falta o está mal, en el orden en que aparece en pantalla. Null si se
 * puede guardar. Sin `conCostos` (quien no es admin, al editar) no se revisa el
 * costo: no lo ve, y la API conserva el que tenía.
 */
export function validarFormulario(f: EquipoStockForm, conCostos = true): string | null {
  if (!f.marca.trim()) return 'Indicá la marca.';
  if (!f.modelo.trim()) return 'Indicá el modelo.';
  if (f.condicion === 'usado' && f.bateria.trim()) {
    const bateria = Number(f.bateria);
    if (!Number.isInteger(bateria) || bateria < 0 || bateria > 100) return 'La batería va de 0 a 100 %.';
  }
  if (!f.numeroSerie.trim() && !f.imei.trim()) {
    return 'Cargá el número de serie o el IMEI: es lo que identifica al equipo.';
  }
  for (const imei of [f.imei, f.imei2]) {
    if (imei.trim() && !esImeiValido(soloDigitos(imei))) {
      return `El IMEI ${imei.trim()} no es válido: son 15 dígitos y el último es de control.`;
    }
  }
  if (!convertirAFormatoBackend(f.fechaCompra)) return 'La fecha de compra no es válida.';
  if (!conCostos) return null;
  if (!f.costo.trim() || aNumero(f.costo) < 0) return 'Indicá el valor de compra.';
  if (f.monedaCosto !== 'USD' && !(aNumero(f.cotizacionCosto) > 0)) {
    return 'Indicá cuánto valía el dólar el día de compra: el informe se calcula en US$.';
  }
  return null;
}

/** El formulario ya validado, como lo espera la API. */
export function formularioAInput(f: EquipoStockForm): EquipoStockInput {
  const almacenamiento = f.almacenamiento.trim() ? Math.round(aNumero(f.almacenamiento)) : null;
  return {
    marca: f.marca.trim(),
    modelo: f.modelo.trim(),
    color: textoONull(f.color),
    almacenamientoGb: almacenamiento ? almacenamiento * (f.unidad === 'TB' ? 1024 : 1) : null,
    condicion: f.condicion,
    bateria: f.condicion === 'usado' && f.bateria.trim() ? Number(f.bateria) : null,
    numeroSerie: textoONull(f.numeroSerie),
    imei: f.imei.trim() ? soloDigitos(f.imei) : null,
    imei2: f.imei2.trim() ? soloDigitos(f.imei2) : null,
    fechaCompra: convertirAFormatoBackend(f.fechaCompra)!,
    proveedor: textoONull(f.proveedor),
    monedaCosto: f.monedaCosto,
    costo: aNumero(f.costo),
    cotizacionCosto: f.monedaCosto === 'USD' ? null : aNumero(f.cotizacionCosto),
    monedaPrecio: f.precio.trim() ? f.monedaPrecio : null,
    precio: f.precio.trim() ? aNumero(f.precio) : null,
    observaciones: textoONull(f.observaciones)
  };
}
