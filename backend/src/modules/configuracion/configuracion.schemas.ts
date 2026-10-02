import { z } from 'zod';

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
