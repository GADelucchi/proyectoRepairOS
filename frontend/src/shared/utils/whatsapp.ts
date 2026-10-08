import { PAISES, PAIS_POR_DEFECTO, type CodigoPais } from '@/shared/constants/paises';

/**
 * Teléfono en formato internacional para wa.me (solo dígitos, con código de
 * país), a partir de como lo cargó el mostrador. Null si no alcanza para un número.
 *
 * Argentina tiene su vuelta: los celulares van con un 9 después del 54 y sin el
 * 0 de la característica ni el 15 ("0221 15 555-1234" → 5492215551234).
 */
export function telefonoParaWhatsApp(telefono: string | null | undefined, pais: string): string | null {
  if (!telefono) return null;
  const conMas = telefono.trim().startsWith('+');
  let digitos = telefono.replace(/\D/g, '');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (digitos.length < 6) return null;

  const { prefijo } = PAISES[pais as CodigoPais] ?? PAISES[PAIS_POR_DEFECTO];

  // Ya viene con código de país.
  if (conMas || (digitos.startsWith(prefijo) && digitos.length > 10)) {
    return pais === 'AR' && digitos.startsWith('54') && !digitos.startsWith('549')
      ? `549${digitos.slice(2)}`
      : digitos;
  }

  digitos = digitos.replace(/^0/, '');
  if (pais === 'AR') {
    // Saca el 15 que va después de la característica (de 2 a 4 dígitos) si sobra.
    if (digitos.length === 12) {
      for (const largoCaracteristica of [2, 3, 4]) {
        if (digitos.slice(largoCaracteristica, largoCaracteristica + 2) === '15') {
          digitos = digitos.slice(0, largoCaracteristica) + digitos.slice(largoCaracteristica + 2);
          break;
        }
      }
    }
    return digitos.length === 10 ? `549${digitos}` : `54${digitos}`;
  }
  return `${prefijo}${digitos}`;
}

/** Link que abre WhatsApp (app o web) con el mensaje ya escrito. Sin número, elige el contacto. */
export function linkWhatsApp(numero: string | null, mensaje: string): string {
  return `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(mensaje)}`;
}
