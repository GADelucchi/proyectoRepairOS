import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { env } from '../../config/env';
import { sequelize } from '../../models';
import { esAdmin, sucursalIdDe, tallerIdDe } from '../../shared/http/request-context';
import { redondearMonto } from '../../shared/utils/dinero';
import { fechaEnZona, inicioDelDia, sumarDias } from '../../shared/utils/fechas';
import { rangoCajaQuery } from './reportes.schemas';

const LIMITE_MOVIMIENTOS = 500;

interface FiltroCaja {
  desde: string;
  hasta: string;
  /** null = todo el taller (solo admin). */
  sucursalId: number | null;
  /** Parámetros listos para la consulta: los bordes del rango en UTC. */
  parametros: { tallerId: number; sucursalId: number | null; inicio: Date; fin: Date };
  /** Condición WHERE común a todas las consultas de caja sobre `cuenta_movimientos m`. */
  condicion: string;
}

/**
 * Arma el filtro de la caja.
 *
 * Las fechas son días del taller, no de UTC: "hoy" va de las 00:00 a las 24:00
 * en la zona del negocio (APP_TIMEZONE). Se compara `created_at` contra esos
 * dos instantes en vez de usar DATE(created_at), así el índice por fecha sigue
 * sirviendo y no se corre el día a las 21 hs.
 */
export function filtroDeCaja(req: Request): FiltroCaja {
  const query = rangoCajaQuery.parse(req.query);
  const hoy = fechaEnZona(new Date(), env.timezone);
  const desde = query.desde ?? hoy;
  const hasta = query.hasta ?? desde;

  const todas = esAdmin(req) && query.todasLasSucursales;
  const sucursalId = todas ? null : sucursalIdDe(req);

  return {
    desde,
    hasta,
    sucursalId,
    parametros: {
      tallerId: tallerIdDe(req),
      sucursalId,
      inicio: inicioDelDia(desde, env.timezone),
      fin: inicioDelDia(sumarDias(hasta, 1), env.timezone)
    },
    condicion: `m.taller_id = :tallerId
        AND m.created_at >= :inicio AND m.created_at < :fin
        ${sucursalId ? 'AND m.sucursal_id = :sucursalId' : ''}`
  };
}

interface FilaAgrupada {
  clave: string | number | null;
  etiqueta?: string | null;
  moneda: string;
  total: string | null;
  cantidad: number;
}

const aGrupos = (filas: FilaAgrupada[]) =>
  filas.map((f) => ({
    clave: String(f.clave ?? 'sin_especificar'),
    etiqueta: f.etiqueta ?? null,
    moneda: f.moneda,
    total: redondearMonto(Number(f.total ?? 0)),
    cantidad: Number(f.cantidad)
  }));

/** Cobrado, facturado y ajustes de una moneda. */
function totalesPorMoneda(porTipo: FilaAgrupada[]) {
  const monedas = [...new Set(porTipo.map((f) => f.moneda))].sort();
  return monedas.map((moneda) => {
    const totalDe = (tipo: string) =>
      redondearMonto(Number(porTipo.find((f) => f.moneda === moneda && f.clave === tipo)?.total ?? 0));
    return {
      moneda,
      cobrado: totalDe('pago'),
      facturado: totalDe('cargo'),
      // Correcciones de saldo: no son plata, van aparte a propósito.
      ajustes: { debito: totalDe('ajuste_debito'), credito: totalDe('ajuste_credito') }
    };
  });
}

/**
 * Caja del período: qué plata entró, por qué medio y quién la cobró.
 *
 * Solo cuenta los movimientos `pago`, que son plata real. Lo facturado y los
 * ajustes se informan aparte: mezclarlos daría un total que no coincide con lo
 * que hay en el cajón, que es justamente para lo que se usa este número.
 *
 * Todo va separado por moneda: los pesos y los dólares están en el mismo cajón
 * pero no se suman.
 */
export async function caja(req: Request, res: Response): Promise<void> {
  const filtro = filtroDeCaja(req);
  const consultar = (sql: string) =>
    sequelize.query<FilaAgrupada>(sql, { replacements: filtro.parametros, type: QueryTypes.SELECT });

  const [porTipo, porMedio, porUsuario, porSucursal] = await Promise.all([
    consultar(
      `SELECT m.tipo AS clave, m.moneda, SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
        WHERE ${filtro.condicion}
        GROUP BY m.tipo, m.moneda`
    ),
    consultar(
      `SELECT COALESCE(m.medio_pago, 'sin_especificar') AS clave, m.moneda,
              SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
        WHERE ${filtro.condicion} AND m.tipo = 'pago'
        GROUP BY m.medio_pago, m.moneda
        ORDER BY m.moneda, total DESC`
    ),
    consultar(
      `SELECT u.id AS clave, CONCAT(u.nombre, ' ', u.apellido) AS etiqueta, m.moneda,
              SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
         JOIN users u ON u.id = m.usuario_id
        WHERE ${filtro.condicion} AND m.tipo = 'pago'
        GROUP BY u.id, etiqueta, m.moneda
        ORDER BY m.moneda, total DESC`
    ),
    consultar(
      `SELECT s.id AS clave, s.nombre AS etiqueta, m.moneda, SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
         LEFT JOIN sucursales s ON s.id = m.sucursal_id
        WHERE ${filtro.condicion} AND m.tipo = 'pago'
        GROUP BY s.id, s.nombre, m.moneda
        ORDER BY m.moneda, total DESC`
    )
  ]);

  res.json({
    rango: { desde: filtro.desde, hasta: filtro.hasta },
    alcance: filtro.sucursalId ? 'sucursal' : 'taller',
    totales: totalesPorMoneda(porTipo),
    porMedioDePago: aGrupos(porMedio),
    porUsuario: aGrupos(porUsuario),
    porSucursal: aGrupos(porSucursal)
  });
}

/** Los cobros del período, uno por uno, para cuadrar la caja contra el cajón. */
export async function movimientosDeCaja(req: Request, res: Response): Promise<void> {
  const filtro = filtroDeCaja(req);

  const movimientos = await sequelize.query(
    `SELECT m.id, m.tipo, m.monto, m.moneda, m.medio_pago AS medioPago, m.nota, m.created_at AS createdAt,
            c.id AS clienteId, CONCAT(c.nombre, ' ', c.apellido) AS cliente,
            o.numero_orden AS numeroOrden,
            CONCAT(u.nombre, ' ', u.apellido) AS usuario,
            s.nombre AS sucursal
       FROM cuenta_movimientos m
       JOIN clientes c ON c.id = m.cliente_id
       JOIN users u ON u.id = m.usuario_id
       LEFT JOIN ordenes o ON o.id = m.orden_id
       LEFT JOIN sucursales s ON s.id = m.sucursal_id
      WHERE ${filtro.condicion} AND m.tipo = 'pago'
      ORDER BY m.created_at DESC
      LIMIT ${LIMITE_MOVIMIENTOS}`,
    { replacements: filtro.parametros, type: QueryTypes.SELECT }
  );

  res.json(movimientos);
}
