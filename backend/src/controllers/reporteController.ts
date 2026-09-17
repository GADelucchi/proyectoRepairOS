import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import { sequelize } from '../models';
import { tallerIdDe } from '../utils/tenant';
import { redondearMonto } from '../services/cuentaCorriente';

/**
 * Rango de fechas del informe. Sin parámetros, es el día de hoy.
 *
 * Se comparan fechas completas (`>= desde 00:00` y `< hasta+1 día`) en vez de
 * usar DATE(created_at): así el índice por fecha sigue sirviendo y el borde de
 * la medianoche no queda afuera.
 */
function rangoDe(req: Request): { desde: string; hasta: string } {
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = (req.query.desde as string | undefined) ?? hoy;
  const hasta = (req.query.hasta as string | undefined) ?? desde;

  const formato = /^\d{4}-\d{2}-\d{2}$/;
  if (!formato.test(desde) || !formato.test(hasta)) {
    throw new HttpError(400, 'Las fechas deben tener formato AAAA-MM-DD');
  }
  if (desde > hasta) {
    throw new HttpError(400, 'La fecha de inicio no puede ser posterior a la de fin');
  }

  return { desde, hasta };
}

interface FilaAgrupada {
  clave: string | number | null;
  etiqueta?: string | null;
  total: string | null;
  cantidad: number;
}

const aGrupos = (filas: FilaAgrupada[]) =>
  filas.map((f) => ({
    clave: String(f.clave ?? 'sin_especificar'),
    etiqueta: f.etiqueta ?? null,
    total: redondearMonto(Number(f.total ?? 0)),
    cantidad: Number(f.cantidad)
  }));

/**
 * Caja del período: qué plata entró, por qué medio y quién la cobró.
 *
 * Solo cuenta los movimientos de tipo `pago`, que son los únicos que
 * representan plata real. Los cargos (lo facturado) y los ajustes se informan
 * aparte: mezclarlos daría un total de caja que no coincide con lo que hay en
 * el cajón, que es exactamente para lo que se usa este número.
 *
 * El técnico ve la caja de la sucursal en la que está trabajando; el admin
 * puede pedir la de todo el taller con `?todasLasSucursales=true`.
 */
export const caja = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const { desde, hasta } = rangoDe(req);

  const esAdmin = req.auth?.rol === 'admin';
  const todas = esAdmin && req.query.todasLasSucursales === 'true';
  const sucursalId = req.auth?.sucursalId ?? null;
  if (!todas && !sucursalId) {
    throw new HttpError(409, 'Debes seleccionar una sucursal');
  }

  const filtroSucursal = todas ? '' : 'AND m.sucursal_id = :sucursalId';
  const condiciones = `WHERE m.taller_id = :tallerId
        AND m.created_at >= :desde
        AND m.created_at < DATE_ADD(:hasta, INTERVAL 1 DAY)
        ${filtroSucursal}`;
  const parametros = { tallerId, sucursalId, desde, hasta };
  const consultar = (sql: string) =>
    sequelize.query<FilaAgrupada>(sql, { replacements: parametros, type: QueryTypes.SELECT });

  const [porTipo, porMedio, porUsuario, porSucursal] = await Promise.all([
    consultar(
      `SELECT m.tipo AS clave, SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
         ${condiciones}
        GROUP BY m.tipo`
    ),
    consultar(
      `SELECT COALESCE(m.medio_pago, 'sin_especificar') AS clave,
              SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
         ${condiciones} AND m.tipo = 'pago'
        GROUP BY m.medio_pago
        ORDER BY total DESC`
    ),
    consultar(
      `SELECT u.id AS clave, CONCAT(u.nombre, ' ', u.apellido) AS etiqueta,
              SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
         JOIN users u ON u.id = m.usuario_id
         ${condiciones} AND m.tipo = 'pago'
        GROUP BY u.id, etiqueta
        ORDER BY total DESC`
    ),
    consultar(
      `SELECT s.id AS clave, s.nombre AS etiqueta, SUM(m.monto) AS total, COUNT(*) AS cantidad
         FROM cuenta_movimientos m
         LEFT JOIN sucursales s ON s.id = m.sucursal_id
         ${condiciones} AND m.tipo = 'pago'
        GROUP BY s.id, s.nombre
        ORDER BY total DESC`
    )
  ]);

  const totalDe = (tipo: string) => redondearMonto(Number(porTipo.find((f) => f.clave === tipo)?.total ?? 0));

  res.json({
    rango: { desde, hasta },
    alcance: todas ? 'taller' : 'sucursal',
    // Lo que entró en el cajón.
    cobrado: totalDe('pago'),
    // Lo que se facturó en el período, haya entrado o no.
    facturado: totalDe('cargo'),
    // Correcciones de saldo: no son plata, van aparte a propósito.
    ajustes: {
      debito: totalDe('ajuste_debito'),
      credito: totalDe('ajuste_credito')
    },
    porMedioDePago: aGrupos(porMedio),
    porUsuario: aGrupos(porUsuario),
    porSucursal: aGrupos(porSucursal)
  });
});

/** Los cobros del período, uno por uno, para cuadrar la caja contra el cajón. */
export const movimientosDeCaja = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const { desde, hasta } = rangoDe(req);

  const esAdmin = req.auth?.rol === 'admin';
  const todas = esAdmin && req.query.todasLasSucursales === 'true';
  const sucursalId = req.auth?.sucursalId ?? null;
  if (!todas && !sucursalId) {
    throw new HttpError(409, 'Debes seleccionar una sucursal');
  }

  const movimientos = await sequelize.query(
    `SELECT m.id, m.tipo, m.monto, m.medio_pago AS medioPago, m.nota, m.created_at AS createdAt,
            c.id AS clienteId, CONCAT(c.nombre, ' ', c.apellido) AS cliente,
            o.numero_orden AS numeroOrden,
            CONCAT(u.nombre, ' ', u.apellido) AS usuario,
            s.nombre AS sucursal
       FROM cuenta_movimientos m
       JOIN clientes c ON c.id = m.cliente_id
       JOIN users u ON u.id = m.usuario_id
       LEFT JOIN ordenes o ON o.id = m.orden_id
       LEFT JOIN sucursales s ON s.id = m.sucursal_id
      WHERE m.taller_id = :tallerId
        AND m.created_at >= :desde
        AND m.created_at < DATE_ADD(:hasta, INTERVAL 1 DAY)
        AND m.tipo = 'pago'
        ${todas ? '' : 'AND m.sucursal_id = :sucursalId'}
      ORDER BY m.created_at DESC
      LIMIT 500`,
    { replacements: { tallerId, sucursalId, desde, hasta }, type: QueryTypes.SELECT }
  );

  res.json(movimientos);
});
