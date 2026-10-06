import { apiClient } from '@/shared/api/client';
import type {
  CuentaMovimiento,
  CuentaResumen,
  MedioPago,
  Moneda,
  SaldoEnMoneda,
  Solicitud
} from '@/shared/types';

export interface CuentasResponse {
  cuentas: CuentaResumen[];
  /** Suma de los saldos deudores del taller, una por moneda. */
  totalesAdeudados: { moneda: Moneda; total: number }[];
}

export interface DetalleCuenta {
  cliente: {
    id: number;
    nombre: string;
    apellido: string;
    telefono?: string | null;
    email?: string | null;
    cuentaCorrienteHabilitada: boolean;
  };
  /** Saldos distintos de cero, uno por moneda. Vacío si está al día. */
  saldos: SaldoEnMoneda[];
  movimientos: CuentaMovimiento[];
}

/** Por defecto trae solo a los que deben; `todos` suma a los que están al día. */
export async function listarCuentas(params?: { search?: string; todos?: boolean }): Promise<CuentasResponse> {
  const { data } = await apiClient.get<CuentasResponse>('/cuentas', {
    params: {
      ...(params?.search ? { search: params.search } : {}),
      ...(params?.todos ? { todos: 'true' } : {})
    }
  });
  return data;
}

export async function obtenerCuenta(clienteId: number): Promise<DetalleCuenta> {
  const { data } = await apiClient.get<DetalleCuenta>(`/cuentas/${clienteId}`);
  return data;
}

export async function registrarCobro(
  clienteId: number,
  payload: { monto: number; moneda: Moneda; medioPago?: MedioPago | null; nota?: string | null }
): Promise<{ movimiento: CuentaMovimiento; saldo: number }> {
  const { data } = await apiClient.post(`/cuentas/${clienteId}/pagos`, payload);
  return data;
}

export interface SolicitudAjusteInput {
  monto: number;
  moneda: Moneda;
  /** `debito` suma deuda al cliente; `credito` se la descuenta. */
  direccion: 'debito' | 'credito';
  motivo: string;
}

/**
 * Pide un ajuste sobre la cuenta. Si quien lo pide es admin se aplica al
 * instante (`aplicada: true`); si no, queda esperando aprobación.
 */
export async function solicitarAjuste(
  clienteId: number,
  input: SolicitudAjusteInput
): Promise<{ solicitud: Solicitud; aplicada: boolean; saldo?: number }> {
  const { data } = await apiClient.post(`/cuentas/${clienteId}/ajustes`, input);
  return data;
}
