import { apiClient } from '@/shared/api/client';
import type {
  CostosDeOrden,
  EstadoOrden,
  InventarioDeOrden,
  MedioPago,
  Moneda,
  OpcionChequeo,
  Orden,
  OrdenChequeo,
  OrdenImagen,
  ResultadoNotificacion,
  Solicitud
} from '@/shared/types';
import type { ClienteInput } from '@/features/clientes/api';

export interface ChequeoInput {
  item: string;
  resultado?: string | null;
  opciones?: OpcionChequeo[];
  orden?: number;
}

/** La orden vuelve con el detalle de qué pasó al avisarle al cliente. */
export type OrdenConNotificacion = Orden & { notificacion?: ResultadoNotificacion | null };

export interface NuevaOrdenInput {
  clienteId?: number;
  /** Mismos campos que el alta desde la pantalla de Clientes. */
  nuevoCliente?: ClienteInput;
  equipoId?: number;
  nuevoEquipo?: {
    tipoEquipoPersonalizadoId: number;
    marca?: string | null;
    modelo?: string | null;
    color?: string | null;
    numeroSerie?: string | null;
    claveDesbloqueo?: string | null;
    cuentaUsuario?: string | null;
    cuentaPassword?: string | null;
  };
  detallesEsteticos?: string | null;
  reparacionSolicitada: string;
  notasInternas?: string | null;
  fechaPactada?: string | null;
  presupuestoMonto?: number | null;
  presupuestoDetalle?: string | null;
  moneda?: Moneda;
  preciosAlternativos?: PrecioInput[];
  chequeos?: ChequeoInput[];
}

export interface FiltroOrdenes {
  estado?: EstadoOrden;
  /** Número de orden, serie, modelo o color del equipo, o nombre, teléfono o DNI del cliente. */
  search?: string;
  equipoId?: number;
}

export async function listarOrdenes(filtro: FiltroOrdenes = {}): Promise<Orden[]> {
  const params = Object.fromEntries(Object.entries(filtro).filter(([, valor]) => valor !== undefined));
  const { data } = await apiClient.get<Orden[]>('/ordenes', { params });
  return data;
}

export async function obtenerOrden(id: number): Promise<Orden> {
  const { data } = await apiClient.get<Orden>(`/ordenes/${id}`);
  return data;
}

export async function crearOrden(input: NuevaOrdenInput): Promise<Orden> {
  const { data } = await apiClient.post<Orden>('/ordenes', input);
  return data;
}

export interface CambioEstadoInput {
  estado: EstadoOrden;
  /** Sale impreso en el remito. */
  comentario?: string;
  /** Solo para el taller: queda en el historial pero no se imprime. */
  notaInterna?: string;
  forzar?: boolean;
  /** Al cancelar o dejar sin reparar: qué pasa con cada repuesto que tenía puesto. */
  repuestos?: DestinoRepuesto[];
}

export interface DestinoRepuesto {
  consumoId: number;
  destino: 'stock' | 'perdido';
  motivo?: string | null;
}

export async function cambiarEstadoOrden(
  id: number,
  input: CambioEstadoInput
): Promise<OrdenConNotificacion> {
  const { data } = await apiClient.put<OrdenConNotificacion>(`/ordenes/${id}/estado`, input);
  return data;
}

/** Precio alternativo al de lista, como lo espera la API. */
export interface PrecioInput {
  medioPago: MedioPago | null;
  moneda: Moneda;
  monto: number;
}

export interface EntregaInput {
  montoTotal: number;
  montoAbonado: number;
  /** En qué moneda se cobra. Sin indicar, la del presupuesto. */
  moneda?: Moneda;
  medioPago?: MedioPago | null;
  /** 1 US$ en la moneda del cobro: para el informe de reparaciones. */
  cotizacion?: number | null;
  comentario?: string | null;
  notaInterna?: string | null;
  forzar?: boolean;
}

/** La entrega devuelve el saldo resultante y cuánto crédito se usó. */
export type OrdenEntregada = OrdenConNotificacion & {
  saldoCliente: number;
  pendiente: number;
  creditoAplicado: number;
};

/**
 * Entrega el equipo y registra el cobro en una sola llamada.
 * Lo que no se abone queda en la cuenta corriente del cliente.
 */
export async function entregarOrden(id: number, input: EntregaInput): Promise<OrdenEntregada> {
  const { data } = await apiClient.post<OrdenEntregada>(`/ordenes/${id}/entrega`, input);
  return data;
}

export interface SolicitudFiadoInput {
  montoTotal: number;
  montoAbonado: number;
  moneda?: Moneda;
  medioPago?: MedioPago | null;
  cotizacion?: number | null;
  motivo: string;
}

/**
 * Pide autorización para entregar dejando saldo en un cliente sin cuenta
 * corriente. Si quien pide es admin, la entrega se hace en el acto.
 */
export async function solicitarFiado(
  id: number,
  input: SolicitudFiadoInput
): Promise<{
  solicitud: Solicitud;
  autorizada: boolean;
  saldoCliente?: number;
  creditoAplicado?: number;
  notificacion?: ResultadoNotificacion;
}> {
  const { data } = await apiClient.post(`/ordenes/${id}/entrega/solicitar`, input);
  return data;
}

export async function actualizarPresupuesto(
  id: number,
  payload: {
    monto?: number | null;
    moneda?: Moneda;
    detalle?: string | null;
    preciosAlternativos?: PrecioInput[];
    aprobado?: boolean | null;
  }
): Promise<OrdenConNotificacion> {
  const { data } = await apiClient.put<OrdenConNotificacion>(`/ordenes/${id}/presupuesto`, payload);
  return data;
}

export async function reemplazarChequeos(id: number, chequeos: ChequeoInput[]): Promise<OrdenChequeo[]> {
  const { data } = await apiClient.put<OrdenChequeo[]>(`/ordenes/${id}/chequeos`, chequeos);
  return data;
}

export interface EditarOrdenInput {
  detallesEsteticos?: string | null;
  reparacionSolicitada?: string;
  notasInternas?: string | null;
  fechaPactada?: string | null;
}

export async function editarOrden(id: number, input: EditarOrdenInput): Promise<Orden> {
  const { data } = await apiClient.put<Orden>(`/ordenes/${id}`, input);
  return data;
}

export async function subirImagenes(id: number, files: File[]): Promise<OrdenImagen[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('imagenes', file));
  // Sin Content-Type explícito: el navegador lo arma con el boundary correcto.
  const { data } = await apiClient.post<OrdenImagen[]>(`/ordenes/${id}/imagenes`, formData);
  return data;
}

export async function eliminarImagen(ordenId: number, imagenId: number): Promise<void> {
  await apiClient.delete(`/ordenes/${ordenId}/imagenes/${imagenId}`);
}

export async function guardarFirma(id: number, firmaBase64: string): Promise<{ firmaClienteAt: string }> {
  const { data } = await apiClient.post(`/ordenes/${id}/firma`, { firmaBase64 });
  return data;
}

/**
 * Descarga la firma como blob.
 *
 * No se puede poner la URL directa en un `<img src>`: el endpoint exige el
 * token de sesión, y una etiqueta `img` no manda el header Authorization.
 */
export async function obtenerFirma(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/ordenes/${id}/firma`, { responseType: 'blob' });
  return data;
}

export async function descargarPdf(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/ordenes/${id}/pdf`, { responseType: 'blob' });
  return data;
}

// ---------------------------------------------------------------------------
// Tercerización
// ---------------------------------------------------------------------------

export interface DestinoEnRepairOS {
  id: number;
  nombre: string;
  razonSocial?: string | null;
  cuit: string;
  sucursales: { id: number; nombre: string; direccion?: string | null; telefono?: string | null }[];
}

export interface DatosDestino {
  nombre: string;
  dniCuit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
}

export interface BusquedaDestino {
  /** El DNI o CUIT es de un taller que usa RepairOS. */
  taller: DestinoEnRepairOS | null;
  /** Los datos con que este taller le mandó un equipo la última vez. */
  anterior: DatosDestino | null;
}

export async function buscarDestino(dniCuit: string): Promise<BusquedaDestino> {
  const { data } = await apiClient.get<BusquedaDestino>('/ordenes/tercerizacion/destino', {
    params: { dniCuit }
  });
  return data;
}

export interface TercerizarInput extends DatosDestino {
  /** Qué tiene que hacer el destino. */
  trabajo: string;
  notaInterna?: string | null;
  /** Taller de RepairOS que devolvió `buscarDestino`: se le arma la orden. */
  tallerDestinoId?: number | null;
  sucursalDestinoId?: number | null;
  /** Pasarle la clave de desbloqueo y las cuentas del equipo. */
  compartirClaves?: boolean;
}

export async function tercerizarOrden(id: number, input: TercerizarInput): Promise<OrdenConNotificacion> {
  const { data } = await apiClient.post<OrdenConNotificacion>(`/ordenes/${id}/tercerizar`, input);
  return data;
}

/** "Recibí el equipo" en una orden que armó otro taller: con qué tipo de equipo propio se carga. */
export async function recibirTercerizado(
  id: number,
  tipoEquipoPersonalizadoId: number
): Promise<OrdenConNotificacion> {
  const { data } = await apiClient.post<OrdenConNotificacion>(`/ordenes/${id}/recepcion`, {
    tipoEquipoPersonalizadoId
  });
  return data;
}

/** Lo que devuelven las acciones sobre los repuestos: cómo quedó la orden y, para un admin, su costo. */
export interface InventarioActualizado {
  inventario: InventarioDeOrden;
  costos: CostosDeOrden | null;
}

/** Agrega un servicio (con sus repuestos) o un repuesto suelto: salen del stock de la sucursal. */
export async function agregarRepuesto(
  id: number,
  input: { servicioId?: number; articuloId?: number; cantidad?: number; entradaId?: number | null }
): Promise<InventarioActualizado> {
  const { data } = await apiClient.post<InventarioActualizado>(`/ordenes/${id}/repuestos`, input);
  return data;
}

/** Saca un repuesto: vuelve a la entrada de la que salió. */
export async function quitarRepuesto(id: number, consumoId: number): Promise<InventarioActualizado> {
  const { data } = await apiClient.delete<InventarioActualizado>(`/ordenes/${id}/repuestos/${consumoId}`);
  return data;
}

/** Saca un servicio: sus repuestos vuelven al stock. */
export async function quitarServicio(id: number, ordenServicioId: number): Promise<InventarioActualizado> {
  const { data } = await apiClient.delete<InventarioActualizado>(
    `/ordenes/${id}/servicios/${ordenServicioId}`
  );
  return data;
}

/** Se rompió al colocarlo: no vuelve al stock y queda como costo. */
export async function repuestoPerdido(
  id: number,
  consumoId: number,
  motivo: string | null
): Promise<InventarioActualizado> {
  const { data } = await apiClient.post<InventarioActualizado>(
    `/ordenes/${id}/repuestos/${consumoId}/perdido`,
    {
      motivo
    }
  );
  return data;
}

export async function cambiarEntradaRepuesto(
  id: number,
  consumoId: number,
  entradaId: number
): Promise<InventarioActualizado> {
  const { data } = await apiClient.post<InventarioActualizado>(
    `/ordenes/${id}/repuestos/${consumoId}/entrada`,
    {
      entradaId
    }
  );
  return data;
}

/** La cotización del cobro, si no se cargó al entregar (solo admin). */
export async function guardarCotizacion(id: number, cotizacion: number): Promise<InventarioActualizado> {
  const { data } = await apiClient.put<InventarioActualizado>(`/ordenes/${id}/cotizacion`, { cotizacion });
  return data;
}

/** Lo que cobró el taller externo (solo admin). */
export async function guardarCostoExterno(
  id: number,
  tercerizacionId: number,
  input: { moneda: Moneda; monto: number; cotizacion: number | null }
): Promise<void> {
  await apiClient.put(`/ordenes/${id}/tercerizaciones/${tercerizacionId}/costo`, input);
}
