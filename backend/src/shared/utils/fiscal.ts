/** Condiciones frente al IVA de quien factura. */
export const CONDICIONES_IVA_EMISOR = ['monotributo', 'responsable_inscripto', 'exento'] as const;
export type CondicionIvaEmisor = (typeof CONDICIONES_IVA_EMISOR)[number];

/**
 * Condición frente al IVA del cliente, con el código que pide ARCA en
 * `CondicionIVAReceptorId` (manual WSFEv1, RG 5616).
 */
export const CODIGO_CONDICION_IVA_RECEPTOR = {
  consumidor_final: 5,
  responsable_inscripto: 1,
  monotributo: 6,
  exento: 4,
  no_categorizado: 7,
  monotributo_social: 13,
  monotributo_promovido: 16,
  iva_liberado: 10,
  iva_no_alcanzado: 15,
  cliente_exterior: 9
} as const;

export type CondicionIvaReceptor = keyof typeof CODIGO_CONDICION_IVA_RECEPTOR;

export const CONDICIONES_IVA_RECEPTOR = Object.keys(CODIGO_CONDICION_IVA_RECEPTOR) as [
  CondicionIvaReceptor,
  ...CondicionIvaReceptor[]
];

export const CONDICION_IVA_POR_DEFECTO: CondicionIvaReceptor = 'consumidor_final';

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Once dígitos con el dígito verificador correcto. */
export function esCuitValido(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  const suma = PESOS_CUIT.reduce((total, peso, i) => total + peso * Number(cuit[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === Number(cuit[10]);
}
