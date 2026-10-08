import { z } from 'zod';
import { CODIGOS_PAIS } from '../../shared/utils/paises';

const nombreTipo = z.string().trim().min(1, 'El nombre es requerido').max(255);

export const crearTipoSchema = z.object({ nombre: nombreTipo });
export const actualizarTipoSchema = z.object({ nombre: nombreTipo.optional() });

export const opcionChequeoSchema = z.object({
  etiqueta: z.string().trim().min(1, 'Todas las opciones deben tener una etiqueta').max(80)
});

export const guardarChequeosSchema = z.object({
  chequeos: z.array(
    z.object({
      texto: z.string().trim().min(1, 'El texto del chequeo es requerido'),
      opciones: z
        .array(opcionChequeoSchema)
        .min(1, 'Cada chequeo necesita al menos una opción de respuesta')
        .optional()
    })
  )
});

/** Datos del taller que edita su admin. El país define la moneda por defecto y el prefijo de WhatsApp. */
export const actualizarTallerSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del taller es requerido').max(150).optional(),
  pais: z.enum(CODIGOS_PAIS).optional()
});
