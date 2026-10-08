import { apiClient } from '@/shared/api/client';
import type { EstadoOrden, Moneda } from '@/shared/types';

/** Lo que ve el cliente con el link del remito: sin datos personales ni notas internas. */
export interface SeguimientoPublico {
  numeroOrden: string;
  estado: EstadoOrden;
  etiquetaEstado: string;
  nombreCliente: string | null;
  fechaIngreso: string;
  fechaPactada: string | null;
  fechaEntrega: string | null;
  reparacionSolicitada: string | null;
  equipo: { tipo: string | null; marca: string | null; modelo: string | null };
  presupuesto: { monto: string; moneda: Moneda; aprobado: boolean | null } | null;
  taller: string | null;
  /** Código del portal de clientes del taller ("mis datos y mi cuenta"). */
  codigoPortal: string | null;
  sucursal: { nombre: string; direccion: string | null; telefono: string | null } | null;
  historial: { estado: EstadoOrden; etiqueta: string; comentario: string | null; fecha: string }[];
}

export async function consultarSeguimiento(codigo: string): Promise<SeguimientoPublico> {
  const { data } = await apiClient.get<SeguimientoPublico>(`/seguimiento/${encodeURIComponent(codigo)}`);
  return data;
}
