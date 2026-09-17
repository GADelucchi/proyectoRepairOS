import { Suscripcion, Plan } from '../models';

/** Meses de uso sin pagar que se otorgan al registrarse. */
export const MESES_DE_GRACIA = 1;

/** Fecha (YYYY-MM-DD) hasta la que un taller recién registrado puede operar sin pagar. */
export function finDeGracia(desde: Date = new Date()): string {
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + MESES_DE_GRACIA);
  return hasta.toISOString().slice(0, 10);
}

export interface SuscripcionPublica {
  estado: string;
  graciaHasta: string;
  diasRestantes: number;
  plan: { id: number; codigo: string; nombre: string } | null;
}

/** Días que faltan para que se agote la gracia (0 si ya pasó). */
export function diasRestantesDeGracia(graciaHasta: string, hoy: Date = new Date()): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  const fin = Date.parse(`${graciaHasta}T00:00:00Z`);
  const inicio = Date.parse(`${hoy.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((fin - inicio) / MS_POR_DIA));
}

/** Estado de la suscripción tal como lo consume el frontend. */
export async function suscripcionDeTaller(tallerId: number): Promise<SuscripcionPublica | null> {
  const suscripcion = await Suscripcion.findOne({
    where: { tallerId },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'codigo', 'nombre'] }]
  });
  if (!suscripcion) return null;

  const plan = (suscripcion as any).plan as Plan | null;
  return {
    estado: suscripcion.estado,
    graciaHasta: suscripcion.graciaHasta,
    diasRestantes: diasRestantesDeGracia(suscripcion.graciaHasta),
    plan: plan ? { id: plan.id, codigo: plan.codigo, nombre: plan.nombre } : null
  };
}
