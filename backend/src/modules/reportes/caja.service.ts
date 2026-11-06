import { QueryTypes } from 'sequelize';
import { env } from '../../config/env';
import { sequelize } from '../../models';
import { redondearMonto } from '../../shared/utils/dinero';
import { fechaEnZona, inicioDelDia, sumarDias } from '../../shared/utils/fechas';

const LIMITE_MOVIMIENTOS = 500;

export interface FiltroCaja {
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
 * Arma el filtro de la caja. `sucursalId` null es todo el taller (solo admin).
 *
 * Las fechas son días del taller, no de UTC: "hoy" va de las 00:00 a las 24:00
 * en la zona del negocio (APP_TIMEZONE). Se compara `created_at` contra esos
 * dos instantes en vez de usar DATE(created_at), así el índice por fecha sigue
 * sirviendo y no se corre el día a las 21 hs.
 */
export function armarFiltroCaja(rango: {
  tallerId: number;
  sucursalId: number | null;
  desde?: string;
  hasta?: string;
}): FiltroCaja {
  const hoy = fechaEnZona(new Date(), env.timezone);
  const desde = rango.desde ?? hoy;
  const hasta = rango.hasta ?? desde;
  const { tallerId, sucursalId } = rango;

  return {
    desde,
    hasta,
    sucursalId,
    parametros: {
      tallerId,
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

/**
 * Toda la plata que entró (o salió) en el período, venga de donde venga, con el
 * mismo formato: los cobros de reparaciones y cuenta corriente (`pago` en
 * `cuenta_movimientos`) y los de ventas de equipos (`venta_pagos`). Una seña
 * devuelta resta. El filtro se aplica en cada tabla, así se usan sus índices.
 */
function cobros(filtro: FiltroCaja): string {
  return `(
    SELECT m.id, 'reparacion' AS origen, m.monto, m.moneda, m.medio_pago, m.usuario_id, m.sucursal_id,
           m.created_at, m.cliente_id, m.orden_id, NULL AS venta_id, m.nota
      FROM cuenta_movimientos m
     WHERE ${filtro.condicion} AND m.tipo = 'pago'
    UNION ALL
    SELECT m.id, CASE m.tipo WHEN 'pago' THEN 'venta' WHEN 'sena' THEN 'sena' ELSE 'devolucion' END,
           CASE WHEN m.tipo = 'devolucion' THEN -m.monto ELSE m.monto END, m.moneda, m.medio_pago,
           m.usuario_id, m.sucursal_id, m.created_at, v.cliente_id, NULL, m.venta_id, m.nota
      FROM venta_pagos m
      JOIN ventas v ON v.id = m.venta_id
     WHERE ${filtro.condicion}
  ) AS cobro`;
}

/** Cobrado (de todos los orígenes), facturado y ajustes de una moneda. */
function totalesPorMoneda(porTipo: FilaAgrupada[], porOrigen: FilaAgrupada[]) {
  const monedas = [...new Set([...porTipo, ...porOrigen].map((f) => f.moneda))].sort();
  return monedas.map((moneda) => {
    const totalDe = (tipo: string) =>
      redondearMonto(Number(porTipo.find((f) => f.moneda === moneda && f.clave === tipo)?.total ?? 0));
    return {
      moneda,
      cobrado: redondearMonto(
        porOrigen.filter((f) => f.moneda === moneda).reduce((t, f) => t + Number(f.total ?? 0), 0)
      ),
      facturado: totalDe('cargo'),
      // Correcciones de saldo: no son plata, van aparte a propósito.
      ajustes: { debito: totalDe('ajuste_debito'), credito: totalDe('ajuste_credito') }
    };
  });
}

/**
 * Caja del período: qué plata entró, por qué medio, quién la cobró y de dónde
 * vino (reparaciones, ventas de equipos, señas).
 *
 * Solo cuenta plata real: los cobros de reparaciones y los pagos y señas de
 * ventas, menos las señas devueltas. Lo facturado y los ajustes se informan
 * aparte: mezclarlos daría un total que no coincide con lo que hay en el cajón,
 * que es justamente para lo que se usa este número.
 *
 * Todo va separado por moneda: los pesos y los dólares están en el mismo cajón
 * pero no se suman.
 */
export async function caja(filtro: FiltroCaja) {
  const consultar = (sql: string) =>
    sequelize.query<FilaAgrupada>(sql, { replacements: filtro.parametros, type: QueryTypes.SELECT });
  const desdeCobros = cobros(filtro);

  const [porTipo, porOrigen, porMedio, porUsuario, porSucursal] = await Promise.all([
    consultar(
      `SELECT m.tipo AS clave, m.moneda, SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
        WHERE ${filtro.condicion}
        GROUP BY m.tipo, m.moneda`
    ),
    consultar(
      `SELECT cobro.origen AS clave, cobro.moneda, SUM(cobro.monto) AS total, COUNT(*) AS cantidad
         FROM ${desdeCobros}
        GROUP BY cobro.origen, cobro.moneda
        ORDER BY cobro.moneda, total DESC`
    ),
    consultar(
      `SELECT COALESCE(cobro.medio_pago, 'sin_especificar') AS clave, cobro.moneda,
              SUM(cobro.monto) AS total, COUNT(*) AS cantidad
         FROM ${desdeCobros}
        GROUP BY cobro.medio_pago, cobro.moneda
        ORDER BY cobro.moneda, total DESC`
    ),
    consultar(
      `SELECT u.id AS clave, CONCAT(u.nombre, ' ', u.apellido) AS etiqueta, cobro.moneda,
              SUM(cobro.monto) AS total, COUNT(*) AS cantidad
         FROM ${desdeCobros}
         JOIN users u ON u.id = cobro.usuario_id
        GROUP BY u.id, etiqueta, cobro.moneda
        ORDER BY cobro.moneda, total DESC`
    ),
    consultar(
      `SELECT s.id AS clave, s.nombre AS etiqueta, cobro.moneda, SUM(cobro.monto) AS total, COUNT(*) AS cantidad
         FROM ${desdeCobros}
         LEFT JOIN sucursales s ON s.id = cobro.sucursal_id
        GROUP BY s.id, s.nombre, cobro.moneda
        ORDER BY cobro.moneda, total DESC`
    )
  ]);

  return {
    rango: { desde: filtro.desde, hasta: filtro.hasta },
    alcance: filtro.sucursalId ? 'sucursal' : 'taller',
    totales: totalesPorMoneda(porTipo, porOrigen),
    porOrigen: aGrupos(porOrigen),
    porMedioDePago: aGrupos(porMedio),
    porUsuario: aGrupos(porUsuario),
    porSucursal: aGrupos(porSucursal)
  };
}

/** Los cobros del período, uno por uno, para cuadrar la caja contra el cajón. */
export function movimientosDeCaja(filtro: FiltroCaja) {
  return sequelize.query(
    `SELECT cobro.id, cobro.origen, cobro.monto, cobro.moneda, cobro.medio_pago AS medioPago, cobro.nota,
            cobro.created_at AS createdAt,
            c.id AS clienteId, CONCAT(c.nombre, ' ', c.apellido) AS cliente,
            o.numero_orden AS numeroOrden, o.id AS ordenId,
            v.numero AS numeroVenta, v.id AS ventaId,
            CONCAT(u.nombre, ' ', u.apellido) AS usuario,
            s.nombre AS sucursal
       FROM ${cobros(filtro)}
       JOIN clientes c ON c.id = cobro.cliente_id
       JOIN users u ON u.id = cobro.usuario_id
       LEFT JOIN ordenes o ON o.id = cobro.orden_id
       LEFT JOIN ventas v ON v.id = cobro.venta_id
       LEFT JOIN sucursales s ON s.id = cobro.sucursal_id
      ORDER BY cobro.created_at DESC
      LIMIT ${LIMITE_MOVIMIENTOS}`,
    { replacements: filtro.parametros, type: QueryTypes.SELECT }
  );
}
