import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'repairos_token';

/** Lo escucha la sesión para releer el perfil cuando el plan del taller quedó chico. */
export const EVENTO_PLAN_EXCEDIDO = 'repairos:plan-excedido';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
});

/** Códigos con los que la API marca los errores ante los que la app tiene que reaccionar. */
type CodigoError =
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'SUCURSAL_REQUERIDA'
  | 'REQUIERE_AUTORIZACION'
  | 'SUSCRIPCION_VENCIDA'
  | 'EMAIL_NO_VERIFICADO'
  | 'PLAN_EXCEDIDO';

/** Cuerpo de un error de la API: el mensaje, el código y los datos para reaccionar. */
export interface ErrorApi {
  message?: string;
  codigo?: CodigoError;
  [dato: string]: unknown;
}

const AVISO_LOGIN_KEY = 'repairos_aviso_login';

/**
 * Error para mostrar en el login después de una salida forzada (por ejemplo,
 * la suscripción venció con la sesión abierta), con sus datos para ofrecer la
 * salida. Se borra al iniciar otra sesión.
 */
export const avisoLogin = {
  guardar: (error: ErrorApi) => {
    try {
      sessionStorage.setItem(AVISO_LOGIN_KEY, JSON.stringify(error));
    } catch {
      // Sin almacenamiento, el login se muestra sin el aviso.
    }
  },
  leer: (): ErrorApi | null => {
    try {
      const guardado = sessionStorage.getItem(AVISO_LOGIN_KEY);
      return guardado ? (JSON.parse(guardado) as ErrorApi) : null;
    } catch {
      return null;
    }
  },
  borrar: () => {
    try {
      sessionStorage.removeItem(AVISO_LOGIN_KEY);
    } catch {
      // Nada que borrar.
    }
  }
};

export const sesion = {
  token: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  guardar: (token: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    avisoLogin.borrar();
  },
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
    // La suscripción del taller venció con la sesión abierta: afuera, con el motivo.
    if (datos?.codigo === 'SUSCRIPCION_VENCIDA' && sesion.token()) {
      sesion.cerrar();
      avisoLogin.guardar(datos);
      window.location.href = '/login';
    }
    // El token todavía no tiene sucursal (o la sucursal se desactivó): hay que elegir una.
    // Se decide por el código y no por el texto: "…en esta sucursal" en un
    // mensaje cualquiera mandaba al usuario a elegir sucursal.
    if (datos?.codigo === 'SUCURSAL_REQUERIDA') irA('/seleccionar-sucursal');
    // Cambiaron el plan con la sesión abierta: el perfil se relee y la app muestra el ajuste.
    if (datos?.codigo === 'PLAN_EXCEDIDO') window.dispatchEvent(new Event(EVENTO_PLAN_EXCEDIDO));

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

/** El cuerpo del error de la API (con su código y datos), o uno armado con `fallback`. */
export function getApiErrorData(error: unknown, fallback = 'Ocurrió un error inesperado'): ErrorApi {
  if (axios.isAxiosError<ErrorApi>(error) && error.response?.data?.message) return error.response.data;
  return { message: getApiErrorMessage(error, fallback) };
}
