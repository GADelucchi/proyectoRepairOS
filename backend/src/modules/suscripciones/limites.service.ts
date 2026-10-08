import { Op } from 'sequelize';
import { env } from '../../config/env';
import { sequelize, Plan, Sucursal, Suscripcion, User } from '../../models';
import { errores, HttpError } from '../../shared/http/http-error';
import { evaluarSuscripcion, hoyEnElTaller } from './suscripcion.service';

/**
 * Límites de cada plan: sucursales y usuarios activos (`max_sucursales` y
 * `max_usuarios` en la tabla de planes; NULL = sin tope).
 *
 * - Taller: 1 sucursal y 2 usuarios.
 * - Cadena: hasta 3 sucursales, usuarios sin tope.
 * - A medida: sin topes.
 *
 * Frenan las altas nuevas (crear o reactivar). Si el taller queda pasado del
 * límite (por ejemplo, al bajar de plan), no puede seguir usando el sistema
 * hasta que un admin elija qué sucursales y usuarios quedan activos: así nadie
 * contrata el plan chico y sigue usando todo lo del grande.
 *
 * Durante la prueba, o sin plan asignado, no hay límites: la idea es que
 * conozcan todo el sistema.
 */

export type RecursoLimitado = 'usuarios' | 'sucursales';

export interface UsoDelPlan {
  usados: number;
  /** Null: sin tope. */
  maximo: number | null;
}

const ETIQUETA: Record<RecursoLimitado, { singular: string; plural: string }> = {
  usuarios: { singular: 'usuario activo', plural: 'usuarios activos' },
  sucursales: { singular: 'sucursal activa', plural: 'sucursales activas' }
};

const contar = (tallerId: number, recurso: RecursoLimitado, exceptoId?: number) => {
  const where = { tallerId, activo: true, ...(exceptoId ? { id: { [Op.ne]: exceptoId } } : {}) };
  return recurso === 'usuarios' ? User.count({ where }) : Sucursal.count({ where });
};

/** El plan cuyos límites se aplican hoy, o null si no hay límites (prueba, sin plan, sin suscripción). */
async function planVigente(tallerId: number): Promise<Plan | null> {
  const suscripcion = await Suscripcion.findOne({
    where: { tallerId },
    include: [{ model: Plan, as: 'plan' }]
  });
  if (!suscripcion?.plan) return null;
  return evaluarSuscripcion(suscripcion, hoyEnElTaller()).estado === 'activa' ? suscripcion.plan : null;
}

const maximoDe = (plan: Plan, recurso: RecursoLimitado) =>
  recurso === 'usuarios' ? plan.maxUsuarios : plan.maxSucursales;

/** Cuánto usa el taller de cada recurso y cuánto le permite su plan (para mostrarlo en pantalla). */
export async function usoDelPlan(tallerId: number): Promise<Record<RecursoLimitado, UsoDelPlan> | null> {
  const plan = await planVigente(tallerId);
  if (!plan) return null;
  const [usuarios, sucursales] = await Promise.all([
    contar(tallerId, 'usuarios'),
    contar(tallerId, 'sucursales')
  ]);
  return {
    usuarios: { usados: usuarios, maximo: plan.maxUsuarios },
    sucursales: { usados: sucursales, maximo: plan.maxSucursales }
  };
}

/**
 * Corta si sumar un usuario o una sucursal activa supera el plan. `exceptoId`
 * es el registro que se está reactivando (no cuenta dos veces).
 *
 * El error lleva el plan sugerido y el contacto, para que la pantalla ofrezca
 * cambiar de plan por WhatsApp en vez de solo negarse.
 */
export async function exigirLugarEnPlan(
  tallerId: number,
  recurso: RecursoLimitado,
  exceptoId?: number
): Promise<void> {
  const plan = await planVigente(tallerId);
  const maximo = plan ? maximoDe(plan, recurso) : null;
  if (!plan || maximo === null) return;
  if ((await contar(tallerId, recurso, exceptoId)) < maximo) return;

  // El plan más chico que tenga lugar para uno más.
  const planes = await Plan.findAll({ where: { activo: true }, order: [['orden', 'ASC']] });
  const sugerido = planes.find((p) => p.orden > plan.orden && (maximoDe(p, recurso) ?? Infinity) > maximo);
  const { singular, plural } = ETIQUETA[recurso];

  throw new HttpError(
    409,
    `Tu plan ${plan.nombre} incluye hasta ${maximo} ${maximo === 1 ? singular : plural}.` +
      (sugerido ? ` Para sumar más, pasate al plan ${sugerido.nombre}.` : ''),
    {
      codigo: 'LIMITE_DEL_PLAN',
      recurso,
      plan: plan.nombre,
      limite: maximo,
      planSugerido: sugerido
        ? {
            nombre: sugerido.nombre,
            precioMensual: sugerido.precioMensual,
            descripcion: sugerido.descripcion
          }
        : null,
      contacto: {
        email: env.plataforma.soporteEmail || null,
        whatsapp: env.plataforma.soporteWhatsapp || null
      }
    }
  );
}

const excede = (u: UsoDelPlan) => u.maximo !== null && u.usados > u.maximo;

export interface ExcesoDelPlan {
  plan: string;
  usuarios: UsoDelPlan;
  sucursales: UsoDelPlan;
}

/** Si el taller tiene más usuarios o sucursales activos de los que permite su plan. */
export async function excesoDelPlan(tallerId: number): Promise<ExcesoDelPlan | null> {
  const plan = await planVigente(tallerId);
  if (!plan) return null;
  const uso = await usoDelPlan(tallerId);
  if (!uso || (!excede(uso.usuarios) && !excede(uso.sucursales))) return null;
  return { plan: plan.nombre, ...uso };
}

/**
 * Deja activos solo los usuarios y sucursales elegidos, para que el taller
 * vuelva a entrar en su plan. Es baja lógica: el historial queda intacto y,
 * con un plan más grande, se pueden reactivar.
 *
 * Un recurso que no se pasa del plan no se toca aunque no venga en el pedido.
 */
export async function ajustarAlPlan(
  tallerId: number,
  adminId: number,
  elegidos: { usuarios?: number[]; sucursales?: number[] }
): Promise<void> {
  const exceso = await excesoDelPlan(tallerId);
  if (!exceso) throw errores.conflicto('El taller ya está dentro de su plan');

  await sequelize.transaction(async (transaction) => {
    if (excede(exceso.usuarios)) {
      const ids = [...new Set(elegidos.usuarios ?? [])];
      const maximo = exceso.usuarios.maximo!;
      if (!ids.includes(adminId)) {
        throw errores.solicitudInvalida('Tenés que dejarte activo a vos: sos quien administra el taller');
      }
      if (ids.length > maximo) {
        throw errores.solicitudInvalida(`El plan ${exceso.plan} permite hasta ${maximo} usuarios activos`);
      }
      const validos = await User.count({ where: { id: ids, tallerId, activo: true }, transaction });
      if (validos !== ids.length)
        throw errores.solicitudInvalida('Hay usuarios elegidos que no son del taller');
      await User.update(
        { activo: false },
        { where: { tallerId, activo: true, id: { [Op.notIn]: ids } }, transaction }
      );
    }

    if (excede(exceso.sucursales)) {
      const ids = [...new Set(elegidos.sucursales ?? [])];
      const maximo = exceso.sucursales.maximo!;
      if (ids.length === 0) throw errores.solicitudInvalida('Elegí al menos una sucursal');
      if (ids.length > maximo) {
        throw errores.solicitudInvalida(`El plan ${exceso.plan} permite hasta ${maximo} sucursales activas`);
      }
      const validas = await Sucursal.count({ where: { id: ids, tallerId, activo: true }, transaction });
      if (validas !== ids.length)
        throw errores.solicitudInvalida('Hay sucursales elegidas que no son del taller');
      await Sucursal.update(
        { activo: false },
        { where: { tallerId, activo: true, id: { [Op.notIn]: ids } }, transaction }
      );
    }
  });
}
