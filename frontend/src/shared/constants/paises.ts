import type { Moneda } from '@/shared/types';

/**
 * Países donde puede estar un taller. Misma lista que `backend/src/shared/utils/paises.ts`:
 * define la moneda por defecto y el prefijo para los links de WhatsApp.
 */
export const PAISES = {
  AR: { nombre: 'Argentina', moneda: 'ARS', prefijo: '54' },
  UY: { nombre: 'Uruguay', moneda: 'UYU', prefijo: '598' },
  CL: { nombre: 'Chile', moneda: 'CLP', prefijo: '56' },
  PY: { nombre: 'Paraguay', moneda: 'PYG', prefijo: '595' },
  BO: { nombre: 'Bolivia', moneda: 'BOB', prefijo: '591' },
  BR: { nombre: 'Brasil', moneda: 'BRL', prefijo: '55' },
  PE: { nombre: 'Perú', moneda: 'PEN', prefijo: '51' },
  CO: { nombre: 'Colombia', moneda: 'COP', prefijo: '57' },
  MX: { nombre: 'México', moneda: 'MXN', prefijo: '52' },
  EC: { nombre: 'Ecuador', moneda: 'USD', prefijo: '593' },
  PA: { nombre: 'Panamá', moneda: 'USD', prefijo: '507' },
  SV: { nombre: 'El Salvador', moneda: 'USD', prefijo: '503' },
  US: { nombre: 'Estados Unidos', moneda: 'USD', prefijo: '1' },
  ES: { nombre: 'España', moneda: 'EUR', prefijo: '34' }
} as const satisfies Record<string, { nombre: string; moneda: Moneda; prefijo: string }>;

export type CodigoPais = keyof typeof PAISES;
export const CODIGOS_PAIS = Object.keys(PAISES) as CodigoPais[];
export const PAIS_POR_DEFECTO: CodigoPais = 'AR';

/** Zona horaria del navegador → país, para proponerlo al registrarse. */
const PAIS_POR_ZONA: Record<string, CodigoPais> = {
  'America/Montevideo': 'UY',
  'America/Santiago': 'CL',
  'America/Asuncion': 'PY',
  'America/La_Paz': 'BO',
  'America/Sao_Paulo': 'BR',
  'America/Lima': 'PE',
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Guayaquil': 'EC',
  'America/Panama': 'PA',
  'America/El_Salvador': 'SV',
  'Europe/Madrid': 'ES'
};

/** El país más probable del navegador. Es solo una sugerencia: el usuario lo elige. */
export function paisDelNavegador(): CodigoPais {
  try {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zona.startsWith('America/Argentina') || zona === 'America/Buenos_Aires') return 'AR';
    if (PAIS_POR_ZONA[zona]) return PAIS_POR_ZONA[zona];
    if (zona.startsWith('America/') && /New_York|Chicago|Denver|Los_Angeles|Phoenix/.test(zona)) return 'US';
  } catch {
    // Sin Intl, se queda con el país por defecto.
  }
  return PAIS_POR_DEFECTO;
}
