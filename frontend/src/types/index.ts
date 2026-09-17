export type RolUsuario = 'admin' | 'tecnico';

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

export interface Taller {
  id: number;
  nombre: string;
}

export type EstadoSuscripcion = 'prueba' | 'activa' | 'vencida' | 'cancelada';

export interface Suscripcion {
  estado: EstadoSuscripcion;
  /** Fecha (YYYY-MM-DD) hasta la que el taller puede operar sin haber pagado. */
  graciaHasta: string;
  diasRestantes: number;
  plan: { id: number; codigo: string; nombre: string } | null;
}

export interface Sucursal {
  id: number;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  activo: boolean;
}

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  dniCuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  fechaNacimiento?: string | null;
  direccion?: string | null;
  esGremio?: boolean | null;
  nombreGremio?: string | null;
  cuentaCorrienteHabilitada?: boolean;
  /** Saldo de la cuenta corriente: positivo significa que el cliente debe. */
  saldo?: number;
  createdAt?: string;
}

export type TipoEquipo = string;

export interface TipoEquipoPersonalizado {
  id: number;
  nombre: string;
  usuarioId: number;
  sucursalId: number;
  activo: boolean;
  createdAt?: string;
}

export interface OpcionChequeo {
  id?: number;
  etiqueta: string;
}

export interface ChequeoPersonalizado {
  id?: number;
  tipoEquipoPersonalizadoId?: number;
  texto: string;
  opciones: OpcionChequeo[];
}

export interface Equipo {
  id: number;
  clienteId: number;
  tipoEquipoPersonalizadoId: number;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  numeroSerie?: string | null;
  claveDesbloqueo?: string | null;
  cuentaUsuario?: string | null;
  cuentaPassword?: string | null;
  cliente?: { id: number; nombre: string; apellido: string };
  /** Viene embebido cuando la consulta lo incluye (listado y detalle de órdenes). */
  tipoEquipo?: { id: number; nombre: string };
  createdAt?: string;
}

export type EstadoOrden =
  | 'recibido'
  | 'en_diagnostico'
  | 'presupuestado'
  | 'aprobado'
  | 'rechazado'
  | 'en_reparacion'
  | 'listo_para_retirar'
  | 'entregado'
  | 'cancelado';

export interface OrdenChequeo {
  id: number;
  ordenId: number;
  item: string;
  /** Etiqueta elegida entre `opciones`. Null mientras no se respondió. */
  resultado?: string | null;
  /** Opciones con las que se recibió el equipo (congeladas al crear la orden). */
  opciones: OpcionChequeo[];
  orden: number;
}

export interface OrdenImagen {
  id: number;
  ordenId: number;
  url: string;
  descripcion?: string | null;
}

export interface OrdenHistorialEstado {
  id: number;
  estadoAnterior?: string | null;
  estadoNuevo: string;
  comentario?: string | null;
  createdAt: string;
  usuario?: { id: number; nombre: string; apellido: string };
}

export interface Orden {
  id: number;
  numeroOrden: string;
  clienteId: number;
  equipoId: number;
  sucursalId: number;
  tecnicoId: number;
  estado: EstadoOrden;
  fechaIngreso: string;
  fechaPactada?: string | null;
  detallesEsteticos?: string | null;
  reparacionSolicitada?: string | null;
  notasInternas?: string | null;
  presupuestoMonto?: number | null;
  presupuestoAprobado?: boolean | null;
  firmaClienteUrl?: string | null;
  /** Lo facturado y lo cobrado al entregar. Llegan como string (DECIMAL). */
  montoTotal?: string | null;
  montoAbonado?: string | null;
  /** Saldo a favor del cliente que se usó para cubrir esta orden. */
  creditoAplicado?: string | null;
  fechaEntrega?: string | null;
  /** Saldo de la cuenta del cliente: negativo es plata a favor. */
  saldoCliente?: number;
  cliente?: Cliente;
  equipo?: Equipo;
  sucursal?: Sucursal;
  tecnico?: { id: number; nombre: string; apellido: string };
  chequeos?: OrdenChequeo[];
  imagenes?: OrdenImagen[];
  historialEstados?: OrdenHistorialEstado[];
}

/**
 * Transiciones válidas del ciclo de vida de una orden.
 * Copia exacta de `backend/src/models/estadoOrden.ts`: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, EstadoOrden[]> = {
  recibido: ['en_diagnostico', 'presupuestado', 'cancelado'],
  en_diagnostico: ['presupuestado', 'en_reparacion', 'cancelado'],
  presupuestado: ['aprobado', 'rechazado', 'cancelado'],
  aprobado: ['en_reparacion', 'cancelado'],
  rechazado: ['listo_para_retirar', 'presupuestado', 'cancelado'],
  en_reparacion: ['listo_para_retirar', 'presupuestado', 'cancelado'],
  listo_para_retirar: ['entregado', 'en_reparacion'],
  entregado: [],
  cancelado: []
};

export function transicionesDesde(actual: EstadoOrden): EstadoOrden[] {
  return TRANSICIONES_ORDEN[actual] ?? [];
}

export function esEstadoFinal(estado: EstadoOrden): boolean {
  return transicionesDesde(estado).length === 0;
}

/** Detalle de qué pasó al avisarle al cliente un cambio de estado. */
export interface ResultadoNotificacion {
  email: 'enviado' | 'sin_direccion' | 'no_configurado' | 'error';
  whatsapp: 'enviado' | 'sin_telefono' | 'no_configurado' | 'error';
  detalle: string;
}

export const ESTADOS_ORDEN: { value: EstadoOrden; label: string }[] = [
  { value: 'recibido', label: 'Recibido' },
  { value: 'en_diagnostico', label: 'En diagnóstico' },
  { value: 'presupuestado', label: 'Presupuestado' },
  { value: 'aprobado', label: 'Aprobado por el cliente' },
  { value: 'rechazado', label: 'Rechazado por el cliente' },
  { value: 'en_reparacion', label: 'En reparación' },
  { value: 'listo_para_retirar', label: 'Listo para retirar' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' }
];

export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'otro'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro'
};

/** Un asiento de la cuenta corriente: `cargo` suma deuda, `pago` la descuenta. */
export type TipoMovimiento = 'cargo' | 'pago' | 'ajuste_debito' | 'ajuste_credito';

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  cargo: 'Cargo',
  pago: 'Cobro',
  ajuste_debito: 'Ajuste (suma deuda)',
  ajuste_credito: 'Ajuste (a favor)'
};

export interface CuentaMovimiento {
  id: number;
  clienteId: number;
  ordenId?: number | null;
  tipo: TipoMovimiento;
  monto: string;
  medioPago?: MedioPago | null;
  nota?: string | null;
  createdAt: string;
  orden?: { id: number; numeroOrden: string } | null;
  usuario?: { id: number; nombre: string; apellido: string } | null;
}

export interface CuentaResumen {
  clienteId: number;
  nombre: string;
  apellido: string;
  telefono?: string | null;
  cuentaCorrienteHabilitada: boolean;
  saldo: number;
  ultimoMovimiento?: string | null;
}

export type TipoSolicitud = 'fiado' | 'ajuste';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export const ETIQUETA_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada'
};

export const COLOR_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  pendiente: 'warning',
  aprobada: 'success',
  rechazada: 'danger',
  cancelada: 'secondary'
};

/** Pedido de autorización a un supervisor: fiar una entrega o ajustar un saldo. */
export interface Solicitud {
  id: number;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  clienteId: number;
  ordenId?: number | null;
  monto: string;
  datos?: { montoTotal?: number; montoAbonado?: number; direccion?: 'debito' | 'credito' } | null;
  motivo: string;
  respuesta?: string | null;
  resueltoEn?: string | null;
  createdAt: string;
  cliente?: { id: number; nombre: string; apellido: string; cuentaCorrienteHabilitada: boolean };
  orden?: { id: number; numeroOrden: string; estado: EstadoOrden } | null;
  solicitante?: { id: number; nombre: string; apellido: string };
  resueltoPor?: { id: number; nombre: string; apellido: string } | null;
}

/** Un corte de caja: qué plata entró en un período y por qué vía. */
export interface GrupoCaja {
  clave: string;
  etiqueta: string | null;
  total: number;
  cantidad: number;
}

export interface ResumenCaja {
  rango: { desde: string; hasta: string };
  alcance: 'sucursal' | 'taller';
  cobrado: number;
  facturado: number;
  ajustes: { debito: number; credito: number };
  porMedioDePago: GrupoCaja[];
  porUsuario: GrupoCaja[];
  porSucursal: GrupoCaja[];
}

export interface MovimientoCaja {
  id: number;
  tipo: TipoMovimiento;
  monto: string;
  medioPago: MedioPago | null;
  nota: string | null;
  createdAt: string;
  clienteId: number;
  cliente: string;
  numeroOrden: string | null;
  usuario: string;
  sucursal: string | null;
}
