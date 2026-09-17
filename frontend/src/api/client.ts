import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'repairos_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    // El backend devuelve 409 cuando el token todavía no tiene sucursal activa
    // (o la sucursal se desactivó): hay que volver a elegir una.
    if (status === 409 && error.response?.data?.message?.includes('sucursal')) {
      if (!window.location.pathname.startsWith('/seleccionar-sucursal')) {
        window.location.href = '/seleccionar-sucursal';
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errores?: unknown } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}
