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
  /** Con qué datos factura. Cada taller carga los suyos. */
  fiscal?: DatosFiscales;
  /** Cada sucursal ve el stock de equipos de las demás. */
  stockEntreSucursales?: boolean;
  /** Se imprimen en el comprobante de cada venta de equipos. */
  terminosVenta?: string | null;
}

export type CondicionIvaEmisor = 'monotributo' | 'responsable_inscripto' | 'exento';

export type CondicionIvaReceptor =
  | 'consumidor_final'
  | 'responsable_inscripto'
  | 'monotributo'
  | 'exento'
  | 'no_categorizado'
  | 'monotributo_social'
  | 'monotributo_promovido'
  | 'iva_liberado'
  | 'iva_no_alcanzado'
  | 'cliente_exterior';

export interface DatosFiscales {
  razonSocial: string | null;
  cuit: string | null;
  condicionIva: CondicionIvaEmisor | null;
  domicilioFiscal: string | null;
  /** YYYY-MM-DD */
  inicioActividades: string | null;
  ingresosBrutos: string | null;
  puntoVenta: number | null;
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

export type TipoNotificacion = 'taller_nuevo' | 'usuario_nuevo' | 'autorizacion' | 'venta';

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
  condicionIva?: CondicionIvaReceptor;
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
  | 'en_espera'
  | 'listo_para_retirar'
  | 'no_reparado'
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
  /** Qué incluye el presupuesto, para el cliente: sale en el seguimiento, el aviso y el remito. */
  presupuestoDetalle?: string | null;
  /** Moneda del presupuesto de lista. */
  moneda: Moneda;
  /** En qué moneda se cobró al entregar: la de `montoTotal` y `montoAbonado`. */
  monedaCobro?: Moneda | null;
  /** Otros precios además del de lista. */
  precios?: OrdenPrecio[];
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
  /** Todos los saldos del cliente, uno por moneda: al entregar se puede cobrar en otra. */
  saldosCliente?: SaldoEnMoneda[];
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

export interface OrdenPrecio {
  id?: number;
  /** Vacío: vale para cualquier medio de pago. */
  medioPago?: MedioPago | null;
  moneda: Moneda;
  monto: Monto;
}

/** `tarjeta` es de los cobros anteriores a separar débito y crédito. */
export type MedioPago =
  'efectivo' | 'transferencia' | 'tarjeta_debito' | 'tarjeta_credito' | 'otro' | 'tarjeta';

/** Un asiento de la cuenta corriente: `cargo` suma deuda, `pago` la descuenta. */
export type TipoMovimiento =
  'cargo' | 'pago' | 'ajuste_debito' | 'ajuste_credito' | 'conversion_debito' | 'conversion_credito';

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
  /** Reparaciones, ventas de equipos, señas y señas devueltas (que restan). */
  porOrigen: GrupoCaja[];
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

/** De dónde viene la plata de la caja. */
export type OrigenCobro = 'reparacion' | 'venta' | 'sena' | 'devolucion';

export interface MovimientoCaja {
  id: number;
  origen: OrigenCobro;
  /** Negativo en una seña devuelta. */
  monto: string;
  moneda: Moneda;
  medioPago: MedioPago | null;
  nota: string | null;
  createdAt: string;
  clienteId: number;
  cliente: string;
  numeroOrden: string | null;
  ordenId: number | null;
  numeroVenta: number | null;
  ventaId: number | null;
  usuario: string;
  sucursal: string | null;
}

export type CondicionEquipo = 'nuevo' | 'usado';

/** Disponible se puede vender; reservado es sin pago y señado con pago parcial. */
export type EstadoStock = 'disponible' | 'reservado' | 'senado' | 'vendido' | 'baja';

/** Un costo agregado a un equipo del stock: "Batería US$ 35". Anulado, queda como registro y no suma. */
export interface CostoReparacion {
  id: number;
  concepto: string;
  /** YYYY-MM-DD */
  fecha: string;
  moneda: Moneda;
  monto: Monto;
  cotizacion: Monto | null;
  montoUsd: Monto;
  usuario?: { id: number; nombre: string; apellido: string };
  anuladoEn: string | null;
  anuladoPor?: { id: number; nombre: string; apellido: string } | null;
  createdAt: string;
}

/** Una unidad del stock de equipos para la venta, con su propio costo. */
export interface EquipoStock {
  id: number;
  /** Correlativo del taller: se muestra como #0042. */
  numero: number;
  sucursalId: number;
  sucursal?: { id: number; nombre: string };
  marca: string;
  modelo: string;
  color: string | null;
  /** 1 TB = 1024. */
  almacenamientoGb: number | null;
  condicion: CondicionEquipo;
  bateria: number | null;
  numeroSerie: string | null;
  imei: string | null;
  imei2: string | null;
  /** YYYY-MM-DD */
  fechaCompra: string;
  proveedor: string | null;
  monedaCosto: Moneda;
  /** Null para quien no es admin: los costos no salen del servidor. */
  costo: Monto | null;
  /** 1 US$ en la moneda del costo, el día de compra. */
  cotizacionCosto: Monto | null;
  /** Lo que se pagó al comprarlo, en US$. */
  costoCompraUsd: number | null;
  /** Lo que se le agregó después (reparaciones, repuestos), en US$. */
  costoReparacionesUsd: number | null;
  /** Compra más reparaciones, en US$: lo que resta en el informe de ventas. */
  costoUsd: number | null;
  /** Solo para admin, en el detalle del equipo. */
  costosReparacion?: CostoReparacion[];
  monedaPrecio: Moneda | null;
  precio: Monto | null;
  estado: EstadoStock;
  observaciones: string | null;
  bajaEn: string | null;
  motivoBaja: string | null;
  bajaPor?: { id: number; nombre: string; apellido: string } | null;
  /** La venta en la que el cliente lo dejó como parte de pago. */
  recibidoEnVentaId: number | null;
  /** La venta en la que está, si está apartado o vendido (no siempre viene). */
  venta?: {
    id: number;
    etiqueta: string;
    estado: EstadoVenta;
    precio: Monto;
    moneda: Moneda;
    fecha: string;
  } | null;
  createdAt: string;
}

export interface ResumenStock {
  disponibles: number;
  reservados: number;
  senados: number;
  vendidos: number;
  bajas: number;
  /** Lo que costó lo que queda sin vender, en US$. Null para quien no es admin. */
  costoStockUsd: number | null;
  /** Lo que hay de cada modelo, con cada costo por separado. */
  porModelo: {
    marca: string;
    modelo: string;
    almacenamientoGb: number | null;
    cantidad: number;
    costos: { moneda: Moneda; costo: number; cantidad: number }[];
  }[];
}

export type EstadoVenta = 'reservada' | 'senada' | 'completada' | 'cancelada' | 'vencida' | 'anulada';
export type TipoDescuento = 'porcentaje' | 'monto';
export type TipoPagoVenta = 'sena' | 'pago' | 'devolucion';

export interface VentaItem {
  id: number;
  equipoStockId: number;
  /** En la moneda de la venta. */
  precio: Monto;
  equipo: EquipoStock | null;
}

/** Un equipo que dejó el cliente como parte de pago. */
export interface VentaPartePago {
  id: number;
  marca: string;
  modelo: string;
  color: string | null;
  almacenamientoGb: number | null;
  condicion: CondicionEquipo;
  bateria: number | null;
  numeroSerie: string | null;
  imei: string | null;
  imei2: string | null;
  monto: Monto;
  observaciones: string | null;
  /** El equipo del stock en el que se convirtió al completar la venta. */
  equipoStockId: number | null;
}

export interface VentaPago {
  id: number;
  tipo: TipoPagoVenta;
  /** En la moneda en que entró la plata. */
  monto: Monto;
  moneda: Moneda;
  /** 1 US$ en la moneda que no es dólar, si el pago es en otra moneda que la venta. */
  cotizacion: Monto | null;
  /** Lo que cubre de la venta, en su moneda. */
  equivalente: Monto;
  medioPago: MedioPago | null;
  usuario?: { id: number; nombre: string; apellido: string };
  createdAt: string;
}

export interface Venta {
  id: number;
  numero: number;
  /** VTA-000042 */
  etiqueta: string;
  estado: EstadoVenta;
  cliente: Cliente;
  sucursalId: number;
  sucursal?: { id: number; nombre: string };
  vendedor?: { id: number; nombre: string; apellido: string } | null;
  canceladaPor?: { id: number; nombre: string; apellido: string } | null;
  moneda: Moneda;
  cotizacion: Monto | null;
  subtotal: Monto;
  descuentoTipo: TipoDescuento | null;
  descuentoValor: Monto | null;
  descuento: Monto;
  total: Monto;
  partePago: Monto;
  pagado: number;
  saldo: number;
  reservadaHasta: string | null;
  comentarioCliente: string | null;
  comentarioInterno: string | null;
  completadaEn: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
  items: VentaItem[];
  partesPago: VentaPartePago[];
  pagos: VentaPago[];
}

/** Una venta en el listado: lo justo para encontrarla y saber qué falta. */
export interface VentaEnLista {
  id: number;
  numero: number;
  etiqueta: string;
  estado: EstadoVenta;
  cliente: Pick<Cliente, 'id' | 'nombre' | 'apellido' | 'telefono'>;
  sucursal?: { id: number; nombre: string };
  vendedor: string | null;
  moneda: Moneda;
  total: Monto;
  partePago: Monto;
  pagado: number;
  saldo: number;
  reservadaHasta: string | null;
  senadaDesde: string | null;
  createdAt: string;
  completadaEn: string | null;
  equipos: Pick<
    EquipoStock,
    'id' | 'numero' | 'marca' | 'modelo' | 'color' | 'almacenamientoGb' | 'condicion' | 'bateria'
  >[];
}

export interface InformeVentas {
  rango: { desde: string; hasta: string };
  alcance: 'sucursal' | 'taller';
  resumen: {
    ventas: number;
    equipos: number;
    brutoUsd: number;
    costoUsd: number;
    gananciaUsd: number;
    /** Ganancia sobre el bruto, en %. */
    margen: number | null;
    /** Lo que se recibió en equipos (entró al stock). */
    partePagoUsd: number;
  };
  ventas: {
    id: number;
    etiqueta: string;
    completadaEn: string;
    cliente: string;
    vendedor: string | null;
    moneda: Moneda;
    total: number;
    cotizacion: number | null;
    equipos: { numero: number | null; marca: string; modelo: string; almacenamientoGb: number | null }[];
    brutoUsd: number;
    costoUsd: number;
    gananciaUsd: number;
    partePagoUsd: number;
  }[];
}
