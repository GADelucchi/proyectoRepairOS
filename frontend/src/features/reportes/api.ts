import { apiClient } from '@/shared/api/client';
import type { EstadoOrden, Moneda } from '@/shared/types';
import type { RangoCaja } from '@/features/caja/api';

/** Una orden en las listas del tablero y de los reportes. */
export interface OrdenEnLista {
  id: number;
  numeroOrden: string;
  estado: EstadoOrden;
  fechaPactada: string | null;
  codigoSeguimiento: string | null;
  presupuestoMonto: string | null;
  moneda: Moneda;
  clienteNombre: string;
  clienteApellido: string;
  clienteTelefono: string | null;
  marca: string | null;
  modelo: string | null;
  /** Desde cuándo está en el estado actual. */
  desde: string | null;
}

export interface ListaDeOrdenes {
  /** Cuántas cumplen la condición; `ordenes` trae solo las primeras. */
  total: number;
  ordenes: OrdenEnLista[];
}

export interface Tablero {
  hoy: { ingresadas: number; entregadas: number; cobrado: { moneda: Moneda; total: number }[] };
  abiertasPorEstado: Partial<Record<EstadoOrden, number>>;
  atrasadas: ListaDeOrdenes;
  listasSinRetirar: ListaDeOrdenes;
  esperandoRespuesta: ListaDeOrdenes;
  primerosPasos: { tiposEquipo: number; usuarios: number; clientes: number; ordenes: number };
}

export interface Reportes {
  rango: { desde: string; hasta: string };
  alcance: 'sucursal' | 'taller';
  ordenes: {
    ingresadas: number;
    entregadas: number;
    canceladas: number;
    diasPromedioReparacion: number | null;
  };
  presupuestos: { aprobados: number; rechazados: number; sinRespuesta: number };
  porTipoDeEquipo: { tipo: string; ingresadas: number; entregadas: number; diasPromedio: number | null }[];
  porUsuario: { usuario: string; recibidas: number; terminadas: number; entregadas: number }[];
  facturacionPorMes: { mes: string; moneda: Moneda; facturado: number; cobrado: number }[];
  abandonados: ListaDeOrdenes & { diasMinimos: number };
}

export async function obtenerTablero(): Promise<Tablero> {
  const { data } = await apiClient.get<Tablero>('/reportes/tablero');
  return data;
}

export async function obtenerReportes(rango: RangoCaja): Promise<Reportes> {
  const { data } = await apiClient.get<Reportes>('/reportes/resumen', {
    params: {
      desde: rango.desde,
      hasta: rango.hasta,
      ...(rango.todasLasSucursales ? { todasLasSucursales: 'true' } : {})
    }
  });
  return data;
}

/** Los datos del aviso de WhatsApp a partir de un renglón de las listas. */
export const datosAvisoDeLista = (o: OrdenEnLista) => ({
  numeroOrden: o.numeroOrden,
  estado: o.estado,
  codigoSeguimiento: o.codigoSeguimiento,
  presupuestoMonto: o.presupuestoMonto,
  moneda: o.moneda,
  clienteNombre: o.clienteNombre,
  clienteTelefono: o.clienteTelefono,
  marca: o.marca,
  modelo: o.modelo
});
