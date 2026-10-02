import { z } from 'zod';
import { ROLES_USUARIO } from '../../models/User';
import { email } from '../../shared/validation/campos';

/**
 * Política de contraseñas: mínimo 8 caracteres, con mayúscula, minúscula y
 * número. Se valida en la API y no solo en el formulario, para que aplique a
 * cualquier cliente que pegue directo contra el backend.
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede superar los 128 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número');

/** Contraseña + confirmación opcional que, si viene, tiene que coincidir. */
export const passwordConConfirmacion = {
  password: passwordSchema,
  passwordConfirmacion: z.string().optional()
};

export function confirmacionCoincide(data: { password: string; passwordConfirmacion?: string }): boolean {
  return data.passwordConfirmacion === undefined || data.password === data.passwordConfirmacion;
}

const errorConfirmacion = { message: 'Las contraseñas no coinciden', path: ['passwordConfirmacion'] };

const nombre = z.string().trim().min(1, 'El nombre es requerido').max(100);
const apellido = z.string().trim().min(1, 'El apellido es requerido').max(100);

export const crearUsuarioSchema = z
  .object({
    nombre,
    apellido,
    email,
    ...passwordConConfirmacion,
    rol: z.enum(ROLES_USUARIO).default('tecnico')
  })
  .refine(confirmacionCoincide, errorConfirmacion);

export const actualizarUsuarioSchema = z.object({
  nombre: nombre.optional(),
  apellido: apellido.optional(),
  email: email.optional(),
  rol: z.enum(ROLES_USUARIO).optional(),
  activo: z.boolean().optional()
});

export const cambiarPasswordSchema = z
  .object(passwordConConfirmacion)
  .refine(confirmacionCoincide, errorConfirmacion);
