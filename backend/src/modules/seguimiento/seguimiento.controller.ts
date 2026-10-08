import { Request, Response } from 'express';
import { z } from 'zod';
import {
  Equipo,
  Orden,
  OrdenHistorialEstado,
  Sucursal,
  Taller,
  TipoEquipoPersonalizado,
  Cliente
} from '../../models';
import { errores } from '../../shared/http/http-error';
import { etiquetaEstado } from '../ordenes/estado-orden';

const codigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,20}$/, 'Código inválido');

/**
 * Lo que ve el cliente con el link de seguimiento.
 *
 * Es público, así que no lleva nada que identifique a una persona: ni nombre
 * completo, ni teléfono, ni número de serie, ni las notas internas del taller.
 * Del historial solo salen los comentarios, que son los mismos que se imprimen
 * en el remito que el cliente ya tiene.
 */
export async function consultar(req: Request, res: Response): Promise<void> {
  const parsed = codigoSchema.safeParse(req.params.codigo);
  if (!parsed.success) throw errores.noEncontrado('Orden');

  const orden = await Orden.findOne({
    where: { codigoSeguimiento: parsed.data },
    include: [
      { model: Cliente, as: 'cliente', attributes: ['nombre'] },
      {
        model: Equipo,
        as: 'equipo',
        attributes: ['marca', 'modelo'],
        include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['nombre'] }]
      },
      { model: Sucursal, as: 'sucursal', attributes: ['nombre', 'direccion', 'telefono'] },
      { model: Taller, as: 'taller', attributes: ['nombre', 'codigoPublico'] },
      {
        model: OrdenHistorialEstado,
        as: 'historialEstados',
        attributes: ['estadoNuevo', 'comentario', 'createdAt'],
        separate: true,
        order: [['createdAt', 'ASC']]
      }
    ]
  });
  if (!orden) throw errores.noEncontrado('Orden');

  res.set('Cache-Control', 'no-store');
  res.json({
    numeroOrden: orden.numeroOrden,
    estado: orden.estado,
    etiquetaEstado: etiquetaEstado(orden.estado),
    nombreCliente: orden.cliente?.nombre ?? null,
    fechaIngreso: orden.fechaIngreso,
    fechaPactada: orden.fechaPactada,
    fechaEntrega: orden.fechaEntrega,
    reparacionSolicitada: orden.reparacionSolicitada,
    equipo: {
      tipo: orden.equipo?.tipoEquipo?.nombre ?? null,
      marca: orden.equipo?.marca ?? null,
      modelo: orden.equipo?.modelo ?? null
    },
    presupuesto:
      orden.presupuestoMonto != null
        ? { monto: orden.presupuestoMonto, moneda: orden.moneda, aprobado: orden.presupuestoAprobado }
        : null,
    taller: orden.taller?.nombre ?? null,
    // Para ir de la orden a "mis datos y mi cuenta" en el portal del taller.
    codigoPortal: orden.taller?.codigoPublico ?? null,
    sucursal: orden.sucursal
      ? {
          nombre: orden.sucursal.nombre,
          direccion: orden.sucursal.direccion,
          telefono: orden.sucursal.telefono
        }
      : null,
    historial: (orden.historialEstados ?? []).map((h) => ({
      estado: h.estadoNuevo,
      etiqueta: etiquetaEstado(h.estadoNuevo),
      comentario: h.comentario,
      fecha: h.createdAt
    }))
  });
}
