/**
 * Entidades tal como las devuelve la API.
 *
 * Solo tipos: las etiquetas y reglas de cada dominio viven en su feature
 * (por ejemplo, la máquina de estados en `features/ordenes/estado-orden.ts`).
 */

export type RolUsuario = 'admin' | 'tecnico';

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

/** Lo mínimo de un usuario que viene embebido en otras entidades. */
export interface UsuarioResumen {
  id: number;
  nombre: string;
  apellido: string;
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
  /** Fecha en que se anonimizó por un pedido de supresión. */
  anonimizadoEn?: string | null;
  /** Saldo de la cuenta corriente: positivo significa que el cliente debe. */
  saldo?: number;
  createdAt?: string;
}

export interface TipoEquipoPersonalizado {
  id: number;
  nombre: string;
  usuarioId: number | null;
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
  /** Enmascaradas (••••••••) salvo que se pidan con `reveal`. */
  claveDesbloqueo?: string | null;
  cuentaUsuario?: string | null;
  cuentaPassword?: string | null;
  cliente?: UsuarioResumen;
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
  estadoAnterior?: EstadoOrden | null;
  estadoNuevo: EstadoOrden;
  comentario?: string | null;
  createdAt: string;
  usuario?: UsuarioResumen;
}

/** Los montos llegan como string: la API los guarda como DECIMAL. */
export type Monto = string | number;

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
  presupuestoMonto?: Monto | null;
  presupuestoAprobado?: boolean | null;
  /** Solo para firmas anteriores al cifrado; las nuevas se piden a /ordenes/:id/firma. */
  firmaClienteUrl?: string | null;
  /** Cuándo firmó el cliente. Si viene, la orden tiene firma guardada. */
  firmaClienteAt?: string | null;
  montoTotal?: Monto | null;
  montoAbonado?: Monto | null;
  /** Saldo a favor del cliente que se usó para cubrir esta orden. */
  creditoAplicado?: Monto | null;
  fechaEntrega?: string | null;
  /** Saldo de la cuenta del cliente: negativo es plata a favor. */
  saldoCliente?: number;
  cliente?: Cliente;
  equipo?: Equipo;
  sucursal?: Sucursal;
  tecnico?: UsuarioResumen;
  chequeos?: OrdenChequeo[];
  imagenes?: OrdenImagen[];
  historialEstados?: OrdenHistorialEstado[];
}

/** Detalle de qué pasó al avisarle al cliente un cambio de estado. */
export interface ResultadoNotificacion {
  email: 'enviado' | 'sin_direccion' | 'no_configurado' | 'error';
  whatsapp: 'enviado' | 'sin_telefono' | 'no_configurado' | 'error';
  detalle: string;
}

export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

/** Un asiento de la cuenta corriente: `cargo` suma deuda, `pago` la descuenta. */
export type TipoMovimiento = 'cargo' | 'pago' | 'ajuste_debito' | 'ajuste_credito';

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
  usuario?: UsuarioResumen | null;
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
  cliente?: UsuarioResumen & { cuentaCorrienteHabilitada: boolean };
  orden?: { id: number; numeroOrden: string; estado: EstadoOrden } | null;
  solicitante?: UsuarioResumen;
  resueltoPor?: UsuarioResumen | null;
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
