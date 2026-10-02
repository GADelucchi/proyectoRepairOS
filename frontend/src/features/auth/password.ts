/** Misma política que valida la API (`usuarios.schemas.ts`). */
export const REQUISITOS_PASSWORD =
  'Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.';

export function validarPassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-z]/.test(password)) return 'Debe incluir al menos una letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(password)) return 'Debe incluir al menos un número.';
  return null;
}

/** true si la contraseña cumple la política y la confirmación coincide. */
export function passwordListo(password: string, confirmacion: string): boolean {
  return validarPassword(password) === null && password === confirmacion;
}
