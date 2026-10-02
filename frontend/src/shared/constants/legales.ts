/**
 * Documentos legales publicados en el landing (no en la app). La base es
 * configurable porque en desarrollo o en un despliegue propio el dominio cambia.
 */
const BASE = import.meta.env.VITE_LEGAL_BASE_URL ?? 'https://repairos.app';

export const URL_PRIVACIDAD = `${BASE}/privacidad.html`;
export const URL_TERMINOS = `${BASE}/terminos.html`;
export const URL_TRATAMIENTO_DATOS = `${BASE}/tratamiento-de-datos.html`;
