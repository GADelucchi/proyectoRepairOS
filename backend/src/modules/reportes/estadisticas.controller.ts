import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { env } from '../../config/env';
import { sequelize } from '../../models';
import { sucursalIdDe, tallerIdDe } from '../../shared/http/request-context';
import { redondearMonto } from '../../shared/utils/dinero';
import { desfasajeSql, fechaEnZona, inicioDelDia, sumarDias } from '../../shared/utils/fechas';
import { filtroDeCaja } from './reportes.controller';

/** Días sin retirar a partir de los que un equipo listo se considera abandonado. */
export const DIAS_ABANDONO = 90;
const LIMITE_LISTA = 10;
const ESTADOS_CERRADOS = "('entregado', 'cancelado')";

type Parametros = Record<string, unknown>;

const consultar = <T extends object>(sql: string, replacements: Parametros) =>
  sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT });

const aNumeros = <T extends Record<string, unknown>>(fila: T | undefined): Record<keyof T, number> =>
  Object.fromEntries(Object.entries(fila ?? {}).map(([k, v]) => [k, Number(v ?? 0)])) as Record<
    keyof T,
    number
  >;

/** Una orden en las listas del tablero y de los reportes: lo justo para actuar (incluido avisar por WhatsApp). */
interface OrdenEnLista {
  id: number;
  numeroOrden: string;
  estado: string;
  fechaPactada: string | null;
  codigoSeguimiento: string | null;
  presupuestoMonto: string | null;
  moneda: string;
  clienteNombre: string;
  clienteApellido: string;
  clienteTelefono: string | null;
  marca: string | null;
  modelo: string | null;
  /** Cuándo entró al estado en el que está. */
  desde: string | null;
  /** Cuántas órdenes cumplen la condición (la lista trae solo las primeras). */
  total: number;
}

function listaDeOrdenes(condicion: string, orden: string, replacements: Parametros, limite = LIMITE_LISTA) {
  return consultar<OrdenEnLista>(
    `SELECT * FROM (
       SELECT o.id, o.numero_orden AS numeroOrden, o.estado, o.fecha_pactada AS fechaPactada,
              o.codigo_seguimiento AS codigoSeguimiento, o.presupuesto_monto AS presupuestoMonto, o.moneda,
              c.nombre AS clienteNombre, c.apellido AS clienteApellido, c.telefono AS clienteTelefono,
              e.marca, e.modelo,
              (SELECT MAX(h.created_at) FROM orden_historial_estados h
                WHERE h.orden_id = o.id AND h.estado_nuevo = o.estado) AS desde,
              COUNT(*) OVER () AS total
         FROM ordenes o
         JOIN clientes c ON c.id = o.cliente_id
         JOIN equipos e ON e.id = o.equipo_id
        WHERE ${condicion}
     ) AS lista
     ORDER BY ${orden}
     LIMIT ${limite}`,
    replacements
  );
}

const resumenDeLista = (filas: OrdenEnLista[]) => ({
  total: Number(filas[0]?.total ?? 0),
  ordenes: filas.map(({ total: _total, ...o }) => o)
});

/**
 * Tablero de inicio de la sucursal: lo que hay que mirar al abrir el local.
 *
 * - Atrasadas: pasó la fecha pactada y el equipo no está listo.
 * - Listas sin retirar: el cliente ya puede venir a buscarlo.
 * - Esperando respuesta: presupuestadas que el cliente todavía no aprobó.
 */
export async function tablero(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const sucursalId = sucursalIdDe(req);
  const hoy = fechaEnZona(new Date(), env.timezone);
  const p = {
    tallerId,
    sucursalId,
    hoy,
    inicioHoy: inicioDelDia(hoy, env.timezone),
    finHoy: inicioDelDia(sumarDias(hoy, 1), env.timezone)
  };
  const deSucursal = 'o.sucursal_id = :sucursalId';

  const [porEstado, atrasadas, listas, presupuestadas, [hoyContadores], cobradoHoy, [pasos]] =
    await Promise.all([
      consultar<{ estado: string; total: number }>(
        `SELECT o.estado, COUNT(*) AS total FROM ordenes o
        WHERE ${deSucursal} AND o.estado NOT IN ${ESTADOS_CERRADOS}
        GROUP BY o.estado`,
        p
      ),
      listaDeOrdenes(
        `${deSucursal} AND o.estado NOT IN ('entregado', 'cancelado', 'listo_para_retirar')
         AND o.fecha_pactada < :hoy`,
        'fechaPactada ASC',
        p
      ),
      listaDeOrdenes(`${deSucursal} AND o.estado = 'listo_para_retirar'`, 'desde ASC', p),
      listaDeOrdenes(`${deSucursal} AND o.estado = 'presupuestado'`, 'desde ASC', p),
      consultar<Record<string, number>>(
        `SELECT (SELECT COUNT(*) FROM ordenes o WHERE ${deSucursal}
                AND o.fecha_ingreso >= :inicioHoy AND o.fecha_ingreso < :finHoy) AS ingresadas,
              (SELECT COUNT(*) FROM ordenes o WHERE ${deSucursal}
                AND o.fecha_entrega >= :inicioHoy AND o.fecha_entrega < :finHoy) AS entregadas`,
        p
      ),
      consultar<{ moneda: string; total: string }>(
        `SELECT m.moneda, SUM(m.monto) AS total FROM cuenta_movimientos m
        WHERE m.taller_id = :tallerId AND m.sucursal_id = :sucursalId AND m.tipo = 'pago'
          AND m.created_at >= :inicioHoy AND m.created_at < :finHoy
        GROUP BY m.moneda`,
        p
      ),
      // Para la guía de primeros pasos: qué le falta configurar al taller.
      consultar<Record<string, number>>(
        `SELECT (SELECT COUNT(*) FROM tipo_equipo_personalizados t
                WHERE t.sucursal_id = :sucursalId AND t.activo = 1) AS tiposEquipo,
              (SELECT COUNT(*) FROM users u WHERE u.taller_id = :tallerId AND u.activo = 1) AS usuarios,
              (SELECT COUNT(*) FROM clientes c WHERE c.taller_id = :tallerId) AS clientes,
              (SELECT COUNT(*) FROM ordenes o WHERE o.taller_id = :tallerId) AS ordenes`,
        p
      )
    ]);

  res.json({
    hoy: {
      ...aNumeros(hoyContadores),
      cobrado: cobradoHoy.map((c) => ({ moneda: c.moneda, total: redondearMonto(Number(c.total)) }))
    },
    abiertasPorEstado: Object.fromEntries(porEstado.map((f) => [f.estado, Number(f.total)])),
    atrasadas: resumenDeLista(atrasadas),
    listasSinRetirar: resumenDeLista(listas),
    esperandoRespuesta: resumenDeLista(presupuestadas),
    primerosPasos: aNumeros(pasos)
  });
}

/**
 * Reportes del período: cuánto entra y sale del taller, cuánto se tarda, qué
 * presupuestos se aprueban y quién repara qué. Mismo filtro de fechas y
 * sucursales que la caja.
 */
export async function reportes(req: Request, res: Response): Promise<void> {
  const filtro = filtroDeCaja(req);
  const p = { ...filtro.parametros, tz: desfasajeSql(env.timezone), diasAbandono: DIAS_ABANDONO };
  const deSucursal = (alias: string) =>
    `${alias}.taller_id = :tallerId ${filtro.sucursalId ? `AND ${alias}.sucursal_id = :sucursalId` : ''}`;
  const enRango = (columna: string) => `${columna} >= :inicio AND ${columna} < :fin`;

  const [[totales], [presupuestos], porTipo, porUsuario, porMes, abandonados] = await Promise.all([
    consultar<Record<string, number>>(
      `SELECT (SELECT COUNT(*) FROM ordenes o WHERE ${deSucursal('o')} AND ${enRango('o.fecha_ingreso')})
                AS ingresadas,
              (SELECT COUNT(*) FROM ordenes o WHERE ${deSucursal('o')} AND ${enRango('o.fecha_entrega')})
                AS entregadas,
              (SELECT COUNT(*) FROM ordenes o
                 JOIN orden_historial_estados h ON h.orden_id = o.id AND h.estado_nuevo = 'cancelado'
                WHERE ${deSucursal('o')} AND ${enRango('h.created_at')}) AS canceladas,
              (SELECT AVG(TIMESTAMPDIFF(HOUR, o.fecha_ingreso, o.fecha_entrega)) / 24 FROM ordenes o
                WHERE ${deSucursal('o')} AND ${enRango('o.fecha_entrega')}) AS diasPromedio`,
      p
    ),
    // Respuestas a presupuestos de las órdenes que ingresaron en el período.
    consultar<Record<string, number>>(
      `SELECT SUM(o.presupuesto_aprobado = 1) AS aprobados,
              SUM(o.presupuesto_aprobado = 0) AS rechazados,
              SUM(o.presupuesto_monto IS NOT NULL AND o.presupuesto_aprobado IS NULL) AS sinRespuesta
         FROM ordenes o
        WHERE ${deSucursal('o')} AND ${enRango('o.fecha_ingreso')}`,
      p
    ),
    consultar<{ tipo: string | null; ingresadas: number; entregadas: number; diasPromedio: number | null }>(
      `SELECT t.nombre AS tipo,
              SUM(${enRango('o.fecha_ingreso')}) AS ingresadas,
              SUM(${enRango('o.fecha_entrega')}) AS entregadas,
              AVG(CASE WHEN ${enRango('o.fecha_entrega')}
                       THEN TIMESTAMPDIFF(HOUR, o.fecha_ingreso, o.fecha_entrega) / 24 END) AS diasPromedio
         FROM ordenes o
         JOIN equipos e ON e.id = o.equipo_id
         LEFT JOIN tipo_equipo_personalizados t ON t.id = e.tipo_equipo_personalizado_id
        WHERE ${deSucursal('o')} AND (${enRango('o.fecha_ingreso')} OR ${enRango('o.fecha_entrega')})
        GROUP BY t.nombre
        ORDER BY ingresadas DESC`,
      p
    ),
    // Quién recibe, quién termina (pasa a "listo para retirar") y quién entrega.
    consultar<{ usuario: string; recibidas: number; terminadas: number; entregadas: number }>(
      `SELECT CONCAT(u.nombre, ' ', u.apellido) AS usuario,
              (SELECT COUNT(*) FROM ordenes o
                WHERE o.tecnico_id = u.id AND ${deSucursal('o')} AND ${enRango('o.fecha_ingreso')}) AS recibidas,
              (SELECT COUNT(*) FROM orden_historial_estados h JOIN ordenes o ON o.id = h.orden_id
                WHERE h.usuario_id = u.id AND h.estado_nuevo = 'listo_para_retirar'
                  AND ${deSucursal('o')} AND ${enRango('h.created_at')}) AS terminadas,
              (SELECT COUNT(*) FROM orden_historial_estados h JOIN ordenes o ON o.id = h.orden_id
                WHERE h.usuario_id = u.id AND h.estado_nuevo = 'entregado'
                  AND ${deSucursal('o')} AND ${enRango('h.created_at')}) AS entregadas
         FROM users u
        WHERE u.taller_id = :tallerId
       HAVING recibidas + terminadas + entregadas > 0
        ORDER BY terminadas DESC, recibidas DESC`,
      p
    ),
    // Facturado y cobrado por mes y moneda, con los meses en la zona del taller.
    consultar<{ mes: string; moneda: string; facturado: string; cobrado: string }>(
      `SELECT DATE_FORMAT(CONVERT_TZ(m.created_at, '+00:00', :tz), '%Y-%m') AS mes, m.moneda,
              SUM(CASE WHEN m.tipo = 'cargo' THEN m.monto ELSE 0 END) AS facturado,
              SUM(CASE WHEN m.tipo = 'pago' THEN m.monto ELSE 0 END) AS cobrado
         FROM cuenta_movimientos m
        WHERE ${filtro.condicion}
        GROUP BY mes, m.moneda
        ORDER BY mes, m.moneda`,
      p
    ),
    // Equipos listos hace más de DIAS_ABANDONO días: no depende del período elegido.
    listaDeOrdenes(
      `${deSucursal('o')} AND o.estado = 'listo_para_retirar'
         AND (SELECT MAX(h.created_at) FROM orden_historial_estados h
               WHERE h.orden_id = o.id AND h.estado_nuevo = 'listo_para_retirar')
             < DATE_SUB(UTC_TIMESTAMP(), INTERVAL :diasAbandono DAY)`,
      'desde ASC',
      p,
      100
    )
  ]);

  const redondearDias = (v: number | string | null) => (v == null ? null : Math.round(Number(v) * 10) / 10);

  res.json({
    rango: { desde: filtro.desde, hasta: filtro.hasta },
    alcance: filtro.sucursalId ? 'sucursal' : 'taller',
    ordenes: {
      ingresadas: Number(totales?.ingresadas ?? 0),
      entregadas: Number(totales?.entregadas ?? 0),
      canceladas: Number(totales?.canceladas ?? 0),
      diasPromedioReparacion: redondearDias(totales?.diasPromedio ?? null)
    },
    presupuestos: aNumeros(presupuestos),
    porTipoDeEquipo: porTipo.map((f) => ({
      tipo: f.tipo ?? 'Sin especificar',
      ingresadas: Number(f.ingresadas ?? 0),
      entregadas: Number(f.entregadas ?? 0),
      diasPromedio: redondearDias(f.diasPromedio)
    })),
    porUsuario: porUsuario.map((f) => ({
      usuario: f.usuario,
      recibidas: Number(f.recibidas),
      terminadas: Number(f.terminadas),
      entregadas: Number(f.entregadas)
    })),
    facturacionPorMes: porMes.map((f) => ({
      mes: f.mes,
      moneda: f.moneda,
      facturado: redondearMonto(Number(f.facturado)),
      cobrado: redondearMonto(Number(f.cobrado))
    })),
    abandonados: { diasMinimos: DIAS_ABANDONO, ...resumenDeLista(abandonados) }
  });
}
