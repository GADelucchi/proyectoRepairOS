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
  /** ISO 3166-1 alfa-2: define la moneda por defecto y el prefijo de WhatsApp. */
  pais: string;
  /** Moneda con la que arrancan órdenes, cobros y ajustes. */
  moneda: Moneda;
  /** Link donde sus clientes consultan sus datos y su cuenta corriente. */
  portalClientes?: string;
}

export type EstadoSuscripcion = 'prueba' | 'activa' | 'vencida' | 'cancelada';

export interface Suscripcion {
  /** Ya contempla el vencimiento: una prueba cuya fecha pasó llega como `vencida`. */
  estado: EstadoSuscripcion;
  /** Como está guardada, sin evaluar la fecha. */
  estadoGuardado: EstadoSuscripcion;
  /** Último día con acceso (YYYY-MM-DD). Null si no vence. */
  hasta: string | null;
  diasRestantes: number | null;
  bloqueada: boolean;
  /** Fin de la prueba. */
  graciaHasta: string;
  /** Fin del período pago. */
  periodoFin: string | null;
  plan: { id: number; codigo: string; nombre: string } | null;
  /** Mostrar el aviso de vencimiento. */
  avisar: boolean;
  contacto: string | null;
  contactoWhatsapp: string | null;
}

/** Cuánto usa el taller de cada recurso limitado y cuánto permite su plan (null = sin tope). */
export interface UsoDelPlan {
  usuarios: { usados: number; maximo: number | null };
  sucursales: { usados: number; maximo: number | null };
}

/** El taller tiene más usuarios o sucursales activos de los que permite su plan. */
export interface ExcesoDelPlan extends UsoDelPlan {
  plan: string;
}

export interface Plan {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioMensual?: number | null;
}

export type TipoNotificacion = 'taller_nuevo' | 'usuario_nuevo' | 'autorizacion';

/** Aviso de la campanita. */
export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje?: string | null;
  /** Ruta de la app adonde lleva al tocarlo. */
  link?: string | null;
  leidaEn?: string | null;
  createdAt: string;
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
  ciudad?: string | null;
  esGremio?: boolean | null;
  nombreGremio?: string | null;
  cuentaCorrienteHabilitada?: boolean;
  /** Fecha en que se anonimizó por un pedido de supresión. */
  anonimizadoEn?: string | null;
  /** Saldos distintos de cero de la cuenta corriente, uno por moneda. */
  saldos?: SaldoEnMoneda[];
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
  /** Sale impreso en el remito. */
  comentario?: string | null;
  /** Solo para el taller: no se imprime. */
  notaInterna?: string | null;
  createdAt: string;
  usuario?: UsuarioResumen;
}

/** Los montos llegan como string: la API los guarda como DECIMAL. */
export type Monto = string | number;

/** Código ISO 4217. La lista con sus nombres está en `shared/constants/monedas`. */
export type Moneda = 'ARS' | 'USD' | 'EUR' | 'CLP' | 'UYU' | 'BRL' | 'PYG' | 'BOB' | 'PEN' | 'MXN' | 'COP';

/** Saldo de cuenta corriente en una moneda: positivo significa que el cliente debe. */
export interface SaldoEnMoneda {
  moneda: Moneda;
  saldo: number;
}

export interface Orden {
  id: number;
  numeroOrden: string;
  /** Código del link público `/seguimiento/:codigo`. */
  codigoSeguimiento?: string | null;
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
  /** Moneda del presupuesto y del cobro. */
  moneda: Moneda;
  /** Solo para firmas anteriores al cifrado; las nuevas se piden a /ordenes/:id/firma. */
  firmaClienteUrl?: string | null;
  /** Cuándo firmó el cliente. Si viene, la orden tiene firma guardada. */
  firmaClienteAt?: string | null;
  montoTotal?: Monto | null;
  montoAbonado?: Monto | null;
  /** Saldo a favor del cliente que se usó para cubrir esta orden. */
  creditoAplicado?: Monto | null;
  fechaEntrega?: string | null;
  /** Saldo de la cuenta del cliente en la moneda de la orden: negativo es plata a favor. */
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

/** `tarjeta` es de los cobros anteriores a separar débito y crédito. */
export type MedioPago =
  'efectivo' | 'transferencia' | 'tarjeta_debito' | 'tarjeta_credito' | 'otro' | 'tarjeta';

/** Un asiento de la cuenta corriente: `cargo` suma deuda, `pago` la descuenta. */
export type TipoMovimiento = 'cargo' | 'pago' | 'ajuste_debito' | 'ajuste_credito';

export interface CuentaMovimiento {
  id: number;
  clienteId: number;
  ordenId?: number | null;
  tipo: TipoMovimiento;
  monto: string;
  moneda: Moneda;
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
  /** Hay un renglón por cliente y moneda. */
  moneda: Moneda;
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
  moneda: Moneda;
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
  moneda: Moneda;
  total: number;
  cantidad: number;
}

export interface ResumenCaja {
  rango: { desde: string; hasta: string };
  alcance: 'sucursal' | 'taller';
  /** Un renglón por moneda que tuvo movimientos en el período. */
  totales: TotalesCaja[];
  porMedioDePago: GrupoCaja[];
  porUsuario: GrupoCaja[];
  porSucursal: GrupoCaja[];
}

export interface TotalesCaja {
  moneda: Moneda;
  cobrado: number;
  facturado: number;
  ajustes: { debito: number; credito: number };
}

export interface MovimientoCaja {
  id: number;
  tipo: TipoMovimiento;
  monto: string;
  moneda: Moneda;
  medioPago: MedioPago | null;
  nota: string | null;
  createdAt: string;
  clienteId: number;
  cliente: string;
  numeroOrden: string | null;
  usuario: string;
  sucursal: string | null;
}
