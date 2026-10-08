import { randomInt } from 'crypto';
import { env } from '../../config/env';

/** Sin 0/O ni 1/I/L: el código se dicta por teléfono y se tipea a mano. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LARGO = 10;

/**
 * Código del link público de seguimiento de una orden.
 *
 * Es aleatorio a propósito (31^10 combinaciones): con el número de orden
 * alcanzaría cambiar un dígito para ver los equipos de otros clientes.
 */
export function generarCodigoSeguimiento(): string {
  return codigoAleatorio(LARGO);
}

function codigoAleatorio(largo: number): string {
  return Array.from({ length: largo }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
}

/** Código del link del portal de clientes de un taller (`/cliente/:codigo`). */
export const generarCodigoPublico = () => codigoAleatorio(8);

export function urlDelPortal(codigoPublico: string): string {
  return `${env.appPublicUrl}/cliente/${codigoPublico}`;
}

export function urlDeSeguimiento(codigo: string): string {
  return `${env.appPublicUrl}/seguimiento/${codigo}`;
}
