import { z } from 'zod';
import { esFechaIsoValida } from '../utils/fechas';

/**
 * Piezas de validación que se repiten entre módulos.
 * Tenerlas en un solo lugar evita que dos formularios acepten cosas distintas.
 */

const vacioANull = <T>(v: T | '' | undefined | null): T | null => (v === '' || v === undefined ? null : v);

/** Texto opcional: recorta espacios y guarda "" como null. */
export const textoOpcional = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform(vacioANull);

/** Email normalizado a minúsculas: el login compara por igualdad. */
export const email = z.string().trim().toLowerCase().email('El email no es válido').max(150);

/** Email opcional ("" se guarda como null). */
export const emailOpcional = z
  .union([z.literal(''), email])
  .optional()
  .nullable()
  .transform(vacioANull);

/** Fecha de calendario YYYY-MM-DD que existe (rechaza 2026-02-31). */
export const fechaIso = z
  .string()
  .trim()
  .refine(esFechaIsoValida, { message: 'La fecha no es válida. Usá el formato DD/MM/AAAA.' });

export const fechaIsoOpcional = z
  .union([z.literal(''), fechaIso])
  .optional()
  .nullable()
  .transform(vacioANull);

export const idPositivo = z.number().int().positive();

/** Id que llega por query string (`?clienteId=3`). */
export const idEnQuery = z.coerce.number().int().positive();

/** Booleano que llega por query string (`?todos=true`). */
export const booleanoEnQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

/** Búsqueda libre por query string: vacía equivale a no buscar. */
export const busqueda = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || undefined);

export const monto = z.number().nonnegative('El monto no puede ser negativo').max(999_999_999.99);
export const montoPositivo = z.number().positive('El monto debe ser mayor a cero').max(999_999_999.99);
