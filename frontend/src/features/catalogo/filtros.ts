import type { CondicionEquipo } from '@/shared/types';
import type { EquipoCatalogo } from './api';

export type OrdenCatalogo = 'precio_asc' | 'precio_desc' | 'modelo';

export interface FiltrosCatalogo {
  texto: string;
  condicion: CondicionEquipo | 'todos';
  marca: string;
  sucursal: string;
  orden: OrdenCatalogo;
}

export const FILTROS_INICIALES: FiltrosCatalogo = {
  texto: '',
  condicion: 'todos',
  marca: '',
  sucursal: '',
  orden: 'precio_asc'
};

/** Sin tildes ni mayúsculas: "galaxy s23" encuentra "Galaxy S23". */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Los equipos que pasan los filtros, ordenados. El buscador acepta varias
 * palabras en cualquier orden ("13 iphone 128").
 *
 * Los precios en monedas distintas no se comparan entre sí: ordena primero por
 * moneda y después por precio.
 */
export function filtrarCatalogo(equipos: EquipoCatalogo[], f: FiltrosCatalogo): EquipoCatalogo[] {
  const palabras = normalizar(f.texto).split(/\s+/).filter(Boolean);
  const filtrados = equipos.filter((e) => {
    if (f.condicion !== 'todos' && e.condicion !== f.condicion) return false;
    if (f.marca && e.marca !== f.marca) return false;
    if (f.sucursal && e.sucursal !== f.sucursal) return false;
    const texto = normalizar([e.marca, e.modelo, e.memoria, e.color, e.codigo].filter(Boolean).join(' '));
    return palabras.every((p) => texto.includes(p));
  });

  const porModelo = (a: EquipoCatalogo, b: EquipoCatalogo) =>
    `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, 'es', { numeric: true }) ||
    (a.almacenamientoGb ?? 0) - (b.almacenamientoGb ?? 0);
  return filtrados.sort((a, b) => {
    if (f.orden === 'modelo') return porModelo(a, b);
    const moneda = a.moneda.localeCompare(b.moneda);
    if (moneda) return moneda;
    return f.orden === 'precio_asc' ? a.precio - b.precio : b.precio - a.precio;
  });
}

/** Verde con 85% o más, amarillo desde 80% (el umbral con el que se considera gastada) y rojo debajo. */
export function nivelBateria(bateria: number): 'success' | 'warning' | 'danger' {
  if (bateria >= 85) return 'success';
  if (bateria >= 80) return 'warning';
  return 'danger';
}
