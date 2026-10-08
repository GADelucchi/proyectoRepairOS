import { apiClient } from '@/shared/api/client';
import type { EstadoOrden, MedioPago, Moneda, TipoMovimiento } from '@/shared/types';

/** Lo que ve el cliente en el portal: sin notas internas ni credenciales. */
export interface DatosPortal {
  taller: string;
  cliente: {
    nombre: string;
    apellido: string;
    dniCuit: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    ciudad: string | null;
  };
  /** Positivo: debe; negativo: tiene a favor. */
  saldos: { moneda: Moneda; saldo: number }[];
  ordenes: {
    numeroOrden: string;
    estado: EstadoOrden;
    etiquetaEstado: string;
    fechaIngreso: string;
    fechaEntrega: string | null;
    equipo: string;
    presupuestoMonto: string | null;
    montoTotal: string | null;
    moneda: Moneda;
    codigoSeguimiento: string | null;
  }[];
  movimientos: {
    fecha: string;
    tipo: TipoMovimiento;
    monto: string;
    moneda: Moneda;
    medioPago: MedioPago | null;
    numeroOrden: string | null;
  }[];
}

export async function consultarPortal(
  codigoTaller: string,
  dni: string,
  telefono: string
): Promise<DatosPortal> {
  const { data } = await apiClient.post<DatosPortal>(`/portal/${encodeURIComponent(codigoTaller)}/consulta`, {
    dni,
    telefono
  });
  return data;
}
