import { apiClient } from '@/shared/api/client';
import type { CondicionEquipo, Moneda } from '@/shared/types';

/** Un equipo en venta tal como lo ve el público: sin costo, proveedor ni IMEI. */
export interface EquipoCatalogo {
  /** "#0042": con este número el cliente pregunta por el equipo. */
  codigo: string;
  marca: string;
  modelo: string;
  color: string | null;
  /** "128 GB" · "1 TB". */
  memoria: string | null;
  almacenamientoGb: number | null;
  condicion: CondicionEquipo;
  /** Salud de la batería en %, solo en usados. */
  bateria: number | null;
  precio: number;
  moneda: Moneda;
  /** Nombre de la sucursal donde está (ver `sucursales`). */
  sucursal: string | null;
}

export interface Catalogo {
  taller: string;
  /** ISO 3166-1 alfa-2: el prefijo de los links de WhatsApp. */
  pais: string;
  generado: string;
  total: number;
  sucursales: { nombre: string; direccion: string | null; telefono: string | null }[];
  equipos: EquipoCatalogo[];
}

export async function consultarCatalogo(codigo: string): Promise<Catalogo> {
  const { data } = await apiClient.get<Catalogo>(`/catalogo/${encodeURIComponent(codigo)}`);
  return data;
}
