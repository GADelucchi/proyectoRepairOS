import { z } from 'zod';
import { email, idPositivo } from '../../shared/validation/campos';
import { CODIGOS_PAIS, PAIS_POR_DEFECTO } from '../../shared/utils/paises';
import { confirmacionCoincide, passwordConConfirmacion } from '../usuarios/usuarios.schemas';

const errorConfirmacion = { message: 'Las contraseñas no coinciden', path: ['passwordConfirmacion'] };

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'La contraseña es requerida')
});

export const seleccionarSucursalSchema = z.object({
  sucursalId: idPositivo
});

/**
 * Alta de un taller nuevo desde el registro público. Quien se registra es el
 * dueño: queda como administrador del taller que crea.
 */
export const registroSchema = z
  .object({
    nombreTaller: z.string().trim().min(1, 'El nombre del taller es requerido').max(150),
    /** Define la moneda por defecto de las órdenes y el prefijo de WhatsApp. */
    pais: z.enum(CODIGOS_PAIS).default(PAIS_POR_DEFECTO),
    nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
    apellido: z.string().trim().min(1, 'El apellido es requerido').max(100),
    email,
    ...passwordConConfirmacion
  })
  .refine(confirmacionCoincide, errorConfirmacion);

export const pedirEmailSchema = z.object({ email });

const token = z.string().trim().min(20).max(200);

export const tokenSchema = z.object({ token });

export const restablecerSchema = z
  .object({ token, ...passwordConConfirmacion })
  .refine(confirmacionCoincide, errorConfirmacion);
