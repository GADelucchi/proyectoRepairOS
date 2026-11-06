import type { CondicionIvaEmisor, CondicionIvaReceptor } from '@/shared/types';

/** Mismas condiciones que acepta la API. El orden es el de la lista desplegable. */
export const ETIQUETA_CONDICION_IVA_RECEPTOR: Record<CondicionIvaReceptor, string> = {
  consumidor_final: 'Consumidor final',
  responsable_inscripto: 'Responsable inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  no_categorizado: 'No categorizado',
  monotributo_social: 'Monotributista social',
  monotributo_promovido: 'Monotributo trabajador independiente promovido',
  iva_liberado: 'IVA liberado (Ley 19.640)',
  iva_no_alcanzado: 'IVA no alcanzado',
  cliente_exterior: 'Cliente del exterior'
};

export const CONDICIONES_IVA_RECEPTOR = Object.keys(
  ETIQUETA_CONDICION_IVA_RECEPTOR
) as CondicionIvaReceptor[];

export const ETIQUETA_CONDICION_IVA_EMISOR: Record<CondicionIvaEmisor, string> = {
  monotributo: 'Monotributo',
  responsable_inscripto: 'Responsable inscripto',
  exento: 'Exento'
};

export const CONDICIONES_IVA_EMISOR = Object.keys(ETIQUETA_CONDICION_IVA_EMISOR) as CondicionIvaEmisor[];
