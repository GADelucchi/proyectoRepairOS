import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { env } from '../../config/env';
import { sequelize, Plan, Sucursal, Suscripcion, Taller, User } from '../../models';
import { errores } from '../../shared/http/http-error';
import { paramId } from '../../shared/http/request-context';
import { invalidarCacheCompleta } from '../../shared/middlewares/auth.middleware';
import { excesoDelPlan } from '../suscripciones/limites.service';
import { aPublica, hoyEnElTaller, SuscripcionPublica } from '../suscripciones/suscripcion.service';
import { actualizarSuscripcionSchema, listarQuery } from './plataforma.schemas';

const LIMITE_LISTADO = 500;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const haceDias = (dias: number) => new Date(Date.now() - dias * MS_POR_DIA);

/** Suscripciones de los talleres indicados (o de todos), ya evaluadas a hoy. */
async function suscripcionesPorTaller(tallerIds?: number[]): Promise<Map<number, SuscripcionPublica>> {
  const suscripciones = await Suscripcion.findAll({
    ...(tallerIds ? { where: { tallerId: tallerIds } } : {}),
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'codigo', 'nombre'] }]
  });
  const hoy = hoyEnElTaller();
  return new Map(suscripciones.map((s) => [s.tallerId, aPublica(s, hoy)]));
}

/** Id del taller de demo pública, para marcarlo y no confundirlo con un cliente real. */
async function idTallerDemo(): Promise<number | null> {
  if (!env.plataforma.demoEmail) return null;
  const usuario = await User.findOne({
    where: { email: env.plataforma.demoEmail },
    attributes: ['tallerId']
  });
  return usuario?.tallerId ?? null;
}

interface FilaTaller {
  id: number;
  nombre: string;
  createdAt: string;
  usuarios: number;
  sucursales: number;
  ordenes: number;
  ordenesUltimos30: number;
  ultimoAcceso: string | null;
  duenoNombre: string | null;
  duenoEmail: string | null;
}

/**
 * Talleres con lo que hace falta para saber si están vivos: usuarios, órdenes
 * del último mes y el último acceso de cualquiera de sus usuarios. Cada número
 * es una subconsulta para que un JOIN no multiplique los conteos.
 */
async function filasDeTalleres(filtro: { search?: string; tallerId?: number }): Promise<FilaTaller[]> {
  const condiciones = [
    filtro.tallerId ? 't.id = :tallerId' : null,
    filtro.search
      ? `(t.nombre LIKE :busqueda OR EXISTS (
           SELECT 1 FROM users u WHERE u.taller_id = t.id
              AND (u.email LIKE :busqueda OR CONCAT(u.nombre, ' ', u.apellido) LIKE :busqueda)))`
      : null
  ].filter(Boolean);

  const filas = await sequelize.query<FilaTaller>(
    `SELECT t.id, t.nombre, t.created_at AS createdAt,
            (SELECT COUNT(*) FROM users u WHERE u.taller_id = t.id AND u.activo = 1) AS usuarios,
            (SELECT COUNT(*) FROM sucursales s WHERE s.taller_id = t.id AND s.activo = 1) AS sucursales,
            (SELECT COUNT(*) FROM ordenes o WHERE o.taller_id = t.id) AS ordenes,
            (SELECT COUNT(*) FROM ordenes o WHERE o.taller_id = t.id AND o.created_at >= :hace30)
              AS ordenesUltimos30,
            (SELECT MAX(u.ultimo_acceso_at) FROM users u WHERE u.taller_id = t.id) AS ultimoAcceso,
            (SELECT CONCAT(u.nombre, ' ', u.apellido) FROM users u
              WHERE u.taller_id = t.id AND u.rol = 'admin' ORDER BY u.id LIMIT 1) AS duenoNombre,
            (SELECT u.email FROM users u
              WHERE u.taller_id = t.id AND u.rol = 'admin' ORDER BY u.id LIMIT 1) AS duenoEmail
       FROM talleres t
      ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
      ORDER BY t.created_at DESC
      LIMIT ${LIMITE_LISTADO}`,
    {
      replacements: { hace30: haceDias(30), busqueda: `%${filtro.search ?? ''}%`, tallerId: filtro.tallerId },
      type: QueryTypes.SELECT
    }
  );

  return filas.map((f) => ({
    ...f,
    usuarios: Number(f.usuarios),
    sucursales: Number(f.sucursales),
    ordenes: Number(f.ordenes),
    ordenesUltimos30: Number(f.ordenesUltimos30)
  }));
}

async function conSuscripcion(filas: FilaTaller[]) {
  const [suscripciones, demoId] = await Promise.all([
    suscripcionesPorTaller(filas.map((f) => f.id)),
    idTallerDemo()
  ]);
  return filas.map((f) => ({ ...f, esDemo: f.id === demoId, suscripcion: suscripciones.get(f.id) ?? null }));
}

/** Números generales de la plataforma y los últimos registros. */
export async function resumen(_req: Request, res: Response): Promise<void> {
  const [[contadores], suscripciones, demoId] = await Promise.all([
    sequelize.query<Record<string, string | number>>(
      `SELECT (SELECT COUNT(*) FROM talleres) AS talleres,
              (SELECT COUNT(*) FROM talleres WHERE created_at >= :hace7) AS talleresUltimos7,
              (SELECT COUNT(*) FROM talleres WHERE created_at >= :hace30) AS talleresUltimos30,
              (SELECT COUNT(*) FROM users WHERE activo = 1) AS usuarios,
              (SELECT COUNT(*) FROM users WHERE activo = 1 AND ultimo_acceso_at >= :hace1) AS usuariosHoy,
              (SELECT COUNT(*) FROM users WHERE activo = 1 AND ultimo_acceso_at >= :hace7) AS usuariosUltimos7,
              (SELECT COUNT(*) FROM ordenes WHERE created_at >= :hace30) AS ordenesUltimos30`,
      {
        replacements: { hace1: haceDias(1), hace7: haceDias(7), hace30: haceDias(30) },
        type: QueryTypes.SELECT
      }
    ),
    suscripcionesPorTaller(),
    idTallerDemo()
  ]);

  const porEstado: Record<string, number> = { prueba: 0, activa: 0, vencida: 0, cancelada: 0 };
  let porVencer = 0;
  for (const s of suscripciones.values()) {
    porEstado[s.estado] += 1;
    if (!s.bloqueada && s.diasRestantes !== null && s.diasRestantes <= 7) porVencer += 1;
  }

  const recientes = await conSuscripcion(
    (await filasDeTalleres({})).filter((t) => t.id !== demoId).slice(0, 8)
  );

  res.json({
    ...Object.fromEntries(Object.entries(contadores ?? {}).map(([clave, valor]) => [clave, Number(valor)])),
    suscripciones: {
      ...porEstado,
      porVencer,
      sinSuscripcion: Number(contadores?.talleres ?? 0) - suscripciones.size
    },
    recientes
  });
}

export async function listarPlanes(_req: Request, res: Response): Promise<void> {
  res.json(await Plan.findAll({ where: { activo: true }, order: [['orden', 'ASC']] }));
}

export async function listarTalleres(req: Request, res: Response): Promise<void> {
  const { search } = listarQuery.parse(req.query);
  res.json(await conSuscripcion(await filasDeTalleres({ search })));
}

/** Un taller con sus usuarios y sucursales. */
export async function detalleTaller(req: Request, res: Response): Promise<void> {
  const tallerId = paramId(req);
  const [fila] = await conSuscripcion(await filasDeTalleres({ tallerId }));
  if (!fila) throw errores.noEncontrado('Taller');

  const [usuarios, sucursales] = await Promise.all([
    User.findAll({
      where: { tallerId },
      attributes: ['id', 'nombre', 'apellido', 'email', 'rol', 'activo', 'ultimoAccesoAt', 'createdAt'],
      order: [
        ['activo', 'DESC'],
        ['nombre', 'ASC']
      ]
    }),
    Sucursal.findAll({
      where: { tallerId },
      attributes: ['id', 'nombre', 'activo'],
      order: [['nombre', 'ASC']]
    })
  ]);

  res.json({ ...fila, usuarios, sucursales });
}

/**
 * Cambia la suscripción de un taller: extender la prueba, activar un plan o
 * cancelar. Surte efecto en el próximo request de cada usuario del taller.
 */
export async function actualizarSuscripcion(req: Request, res: Response): Promise<void> {
  const tallerId = paramId(req);
  const { estado, planId, hasta } = actualizarSuscripcionSchema.parse(req.body);

  if (!(await Taller.count({ where: { id: tallerId } }))) throw errores.noEncontrado('Taller');
  if (planId && !(await Plan.count({ where: { id: planId } }))) throw errores.noEncontrado('Plan');

  const cambios = {
    estado,
    ...(planId !== undefined ? { planId } : {}),
    ...(estado === 'prueba' ? { graciaHasta: hasta! } : {}),
    ...(estado === 'activa' ? { periodoFin: hasta } : {})
  };

  const existente = await Suscripcion.findOne({ where: { tallerId } });
  if (existente) {
    await existente.update(cambios);
  } else {
    // Un taller sin suscripción (anterior a los planes) arranca a tenerla.
    await Suscripcion.create({ tallerId, graciaHasta: hasta ?? hoyEnElTaller(), ...cambios });
  }

  invalidarCacheCompleta();
  // Si el plan nuevo queda chico, la consola avisa que el taller va a tener que elegir qué dar de baja.
  res.json({
    ...((await suscripcionesPorTaller([tallerId])).get(tallerId) ?? {}),
    exceso: await excesoDelPlan(tallerId)
  });
}

/** Usuarios de todos los talleres, los que usaron la app más recientemente primero. */
export async function listarUsuarios(req: Request, res: Response): Promise<void> {
  const { search } = listarQuery.parse(req.query);
  const usuarios = await sequelize.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.activo,
            u.ultimo_acceso_at AS ultimoAccesoAt, u.created_at AS createdAt,
            t.id AS tallerId, t.nombre AS taller
       FROM users u
       JOIN talleres t ON t.id = u.taller_id
      ${
        search
          ? `WHERE u.email LIKE :busqueda OR CONCAT(u.nombre, ' ', u.apellido) LIKE :busqueda
                OR t.nombre LIKE :busqueda`
          : ''
      }
      ORDER BY u.ultimo_acceso_at IS NULL, u.ultimo_acceso_at DESC, u.created_at DESC
      LIMIT ${LIMITE_LISTADO}`,
    { replacements: { busqueda: `%${search ?? ''}%` }, type: QueryTypes.SELECT }
  );
  res.json((usuarios as Array<Record<string, unknown>>).map((u) => ({ ...u, activo: Boolean(u.activo) })));
}
