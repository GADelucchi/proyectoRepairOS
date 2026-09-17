import { z } from 'zod';

/** Cadena opcional que normaliza "" a null, para no guardar vacíos en la base. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined ? null : v));

/** Fecha en formato ISO (YYYY-MM-DD) validada como fecha real del calendario. */
const fechaOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === '' || v === undefined ? null : v))
  .refine(
    (v) => {
      if (v === null) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const [anio, mes, dia] = v.split('-').map(Number);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));
      // Rechaza 2026-02-31: el Date se desborda al mes siguiente.
      return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
    },
    { message: 'La fecha no es válida. Usá el formato DD/MM/AAAA.' }
  );

/**
 * Única definición de los datos de un cliente.
 *
 * La usan tanto el alta desde la pantalla de Clientes como el alta rápida
 * embebida en una orden nueva, para que ninguno de los dos formularios pueda
 * perder campos que el otro sí guarda.
 */
export const clienteBaseSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().trim().min(1, 'El apellido es requerido').max(100),
  dniCuit: textoOpcional(20),
  telefono: textoOpcional(50),
  email: z
    .union([z.literal(''), z.string().trim().email('El email no es válido').max(150)])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  fechaNacimiento: fechaOpcional,
  direccion: textoOpcional(255),
  esGremio: z.boolean().optional().nullable().default(false),
  nombreGremio: textoOpcional(255),
  /** Habilitar el fiado es decisión del admin; el controller valida el rol. */
  cuentaCorrienteHabilitada: z.boolean().optional()
});

export type ClienteInput = z.infer<typeof clienteBaseSchema>;

export const crearClienteSchema = clienteBaseSchema;
export const actualizarClienteSchema = clienteBaseSchema.partial();
