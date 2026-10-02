import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'repairos_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
});

/** Códigos con los que la API marca los errores ante los que la app tiene que reaccionar. */
type CodigoError = 'NO_AUTENTICADO' | 'SIN_PERMISO' | 'SUCURSAL_REQUERIDA' | 'REQUIERE_AUTORIZACION';

interface ErrorApi {
  message?: string;
  codigo?: CodigoError;
}

export const sesion = {
  token: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  guardar: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
  cerrar: () => localStorage.removeItem(TOKEN_STORAGE_KEY)
};

function irA(ruta: string): void {
  if (!window.location.pathname.startsWith(ruta)) window.location.href = ruta;
}

apiClient.interceptors.request.use((config) => {
  const token = sesion.token();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const datos = axios.isAxiosError<ErrorApi>(error) ? error.response?.data : undefined;

    if (datos?.codigo === 'NO_AUTENTICADO') {
      sesion.cerrar();
      irA('/login');
    }
    // El token todavía no tiene sucursal (o la sucursal se desactivó): hay que elegir una.
    // Se decide por el código y no por el texto: "…en esta sucursal" en un
    // mensaje cualquiera mandaba al usuario a elegir sucursal.
    if (datos?.codigo === 'SUCURSAL_REQUERIDA') irA('/seleccionar-sucursal');

    return Promise.reject(error);
  }
);

/** Mensaje legible de un error de la API, o `fallback` si no vino ninguno. */
export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError<ErrorApi>(error)) {
    if (error.response?.data?.message) return error.response.data.message;
    if (!error.response) return 'No se pudo conectar con el servidor. Revisá tu conexión.';
  }
  return fallback;
}
