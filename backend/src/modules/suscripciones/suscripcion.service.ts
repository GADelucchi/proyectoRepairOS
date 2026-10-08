import { env } from '../../config/env';
import { Suscripcion, Plan, Taller } from '../../models';
import { errores, HttpError } from '../../shared/http/http-error';
import type { EstadoSuscripcion } from '../../models/Suscripcion';
import { fechaEnZona } from '../../shared/utils/fechas';

/** Meses de uso sin pagar que se otorgan al registrarse. */
export const MESES_DE_GRACIA = 1;

/** Desde cuántos días antes del vencimiento se avisa en pantalla a un taller con plan activo. */
export const DIAS_DE_AVISO = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Fecha (YYYY-MM-DD) hasta la que un taller recién registrado puede operar sin pagar. */
export function finDeGracia(desde: Date = new Date()): string {
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + MESES_DE_GRACIA);
  return hasta.toISOString().slice(0, 10);
}

/** Días de calendario entre hoy y `hasta` (0 si ya pasó). Las dos fechas en YYYY-MM-DD. */
export function diasEntre(hoy: string, hasta: string): number {
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  const inicio = Date.parse(`${hoy}T00:00:00Z`);
  return Math.max(0, Math.round((fin - inicio) / MS_POR_DIA));
}

/** "Hoy" en la zona del negocio: un plan que vence hoy sigue vigente hasta la medianoche local. */
export const hoyEnElTaller = () => fechaEnZona(new Date(), env.timezone);

export interface EvaluacionSuscripcion {
  /** El guardado, salvo que la fecha ya pasó: entonces `vencida` aunque nadie la haya marcado. */
  estado: EstadoSuscripcion;
  /** Último día con acceso (incluido). Null si no vence. */
  hasta: string | null;
  /** Días que faltan hasta `hasta`. Null si no vence. */
  diasRestantes: number | null;
  bloqueada: boolean;
}

/**
 * Reglas de acceso de un taller según su suscripción:
 *
 * - `prueba`: acceso hasta `graciaHasta` inclusive.
 * - `activa`: acceso hasta `periodoFin` inclusive; sin `periodoFin`, no vence.
 * - `vencida` o `cancelada`: sin acceso.
 *
 * El vencimiento se calcula con la fecha en cada consulta en vez de esperar a
 * que un proceso marque la suscripción como vencida: no hay un cron que pueda
 * fallar y dejar a un taller usando el sistema sin pagar.
 */
export function evaluarSuscripcion(
  s: { estado: EstadoSuscripcion; graciaHasta: string; periodoFin: string | null },
  hoy: string
): EvaluacionSuscripcion {
  if (s.estado === 'vencida' || s.estado === 'cancelada') {
    return { estado: s.estado, hasta: null, diasRestantes: null, bloqueada: true };
  }
  const hasta = s.estado === 'prueba' ? s.graciaHasta : s.periodoFin;
  if (!hasta) return { estado: s.estado, hasta: null, diasRestantes: null, bloqueada: false };
  if (hoy > hasta) return { estado: 'vencida', hasta, diasRestantes: 0, bloqueada: true };
  return { estado: s.estado, hasta, diasRestantes: diasEntre(hoy, hasta), bloqueada: false };
}

export interface SuscripcionPublica extends EvaluacionSuscripcion {
  /** Estado tal como está guardado (el de arriba ya contempla el vencimiento). */
  estadoGuardado: EstadoSuscripcion;
  graciaHasta: string;
  periodoFin: string | null;
  plan: { id: number; codigo: string; nombre: string } | null;
  /** Mostrar el aviso de vencimiento en pantalla. */
  avisar: boolean;
  /** A quién escribir para elegir un plan o renovar. */
  contacto: string | null;
  /** WhatsApp de soporte (con código de país, sin "+"). */
  contactoWhatsapp: string | null;
}

/** La suscripción guardada (con `plan` cargado si se quiere mostrar) evaluada a la fecha `hoy`. */
export function aPublica(suscripcion: Suscripcion, hoy: string): SuscripcionPublica {
  const evaluacion = evaluarSuscripcion(suscripcion, hoy);
  const { plan } = suscripcion;
  return {
    ...evaluacion,
    estadoGuardado: suscripcion.estado,
    graciaHasta: suscripcion.graciaHasta,
    periodoFin: suscripcion.periodoFin,
    plan: plan ? { id: plan.id, codigo: plan.codigo, nombre: plan.nombre } : null,
    // La prueba se avisa siempre (el taller tiene que saber que es temporal); un plan pago, al final.
    avisar:
      evaluacion.diasRestantes !== null &&
      (evaluacion.estado === 'prueba' || evaluacion.diasRestantes <= DIAS_DE_AVISO),
    contacto: env.plataforma.soporteEmail || null,
    contactoWhatsapp: env.plataforma.soporteWhatsapp || null
  };
}

/**
 * Estado de la suscripción tal como lo consume el frontend. Null si el taller
 * no tiene suscripción: es el caso del taller de demo y de los creados antes de
 * que existieran los planes, que no tienen restricción.
 */
export async function suscripcionDeTaller(tallerId: number): Promise<SuscripcionPublica | null> {
  const suscripcion = await Suscripcion.findOne({
    where: { tallerId },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'codigo', 'nombre'] }]
  });
  return suscripcion ? aPublica(suscripcion, hoyEnElTaller()) : null;
}

/**
 * Error para quien queda afuera porque el taller no tiene suscripción vigente.
 * Lleva lo que la pantalla necesita para ofrecer la salida: a quién escribir
 * (email y WhatsApp) y los planes con su precio.
 */
export async function errorDeBloqueo(tallerId: number): Promise<HttpError> {
  const [taller, planes] = await Promise.all([
    Taller.findByPk(tallerId, { attributes: ['nombre'] }),
    Plan.findAll({
      where: { activo: true },
      attributes: ['nombre', 'descripcion', 'precioMensual'],
      order: [['orden', 'ASC']]
    })
  ]);
  const { soporteEmail, soporteWhatsapp } = env.plataforma;
  return errores.suscripcionVencida(
    'La suscripción del taller no está vigente y el acceso quedó bloqueado para todos sus usuarios.',
    {
      taller: taller?.nombre ?? null,
      contacto: { email: soporteEmail || null, whatsapp: soporteWhatsapp || null },
      planes: planes.map((p) => ({
        nombre: p.nombre,
        descripcion: p.descripcion,
        precioMensual: p.precioMensual
      }))
    }
  );
}

/** Si el taller tiene el acceso bloqueado por su suscripción. */
export async function tallerBloqueado(tallerId: number): Promise<boolean> {
  const suscripcion = await Suscripcion.findOne({
    where: { tallerId },
    attributes: ['estado', 'graciaHasta', 'periodoFin']
  });
  return suscripcion ? evaluarSuscripcion(suscripcion, hoyEnElTaller()).bloqueada : false;
}
