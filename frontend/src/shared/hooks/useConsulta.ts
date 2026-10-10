import { DependencyList, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage, sesion } from '@/shared/api/client';

/** Pasado este tiempo, lo guardado ya no se muestra: se espera la respuesta nueva. */
const VIGENCIA_CACHE_MS = 5 * 60_000;

/**
 * Última respuesta de cada consulta con clave. Pertenece a una sesión: si
 * cambia el token (otro usuario, otra sucursal o se cerró la sesión), se vacía
 * para no mostrar datos que no le corresponden.
 */
const cache = new Map<string, { datos: unknown; guardado: number }>();
let tokenDelCache: string | null = null;

function cacheDeLaSesion() {
  const token = sesion.token();
  if (token !== tokenDelCache) {
    cache.clear();
    tokenDelCache = token;
  }
  return cache;
}

function leerCache<T>(clave: string | undefined): T | undefined {
  if (clave === undefined) return undefined;
  const entrada = cacheDeLaSesion().get(clave);
  if (!entrada || Date.now() - entrada.guardado > VIGENCIA_CACHE_MS) return undefined;
  return entrada.datos as T;
}

function guardarCache(clave: string | undefined, datos: unknown): void {
  if (clave === undefined || datos === undefined) return;
  cacheDeLaSesion().set(clave, { datos, guardado: Date.now() });
}

/**
 * Carga datos de la API y expone el estado de la carga.
 *
 * Vuelve a consultar cuando cambia algo de `deps` o cuando se llama a
 * `recargar()`. Si llega la respuesta de una consulta vieja (el usuario cambió
 * el filtro mientras tanto), se descarta para no pisar la más nueva.
 *
 * Con `clave`, la última respuesta queda guardada: al volver a la pantalla se
 * muestra al instante y se actualiza en segundo plano, sin spinner. Solo para
 * consultas sin efectos además de devolver los datos, porque desde el caché
 * `consultar` no se ejecuta hasta que llega la respuesta nueva.
 */
export function useConsulta<T>(
  consultar: () => Promise<T>,
  deps: DependencyList,
  mensajeError: string,
  clave?: string
) {
  const claveCompleta = clave === undefined ? undefined : `${clave}:${JSON.stringify(deps)}`;
  const claveRef = useRef(claveCompleta);
  claveRef.current = claveCompleta;

  const [datos, setDatosEstado] = useState<T | undefined>(() => leerCache<T>(claveCompleta));
  const [cargando, setCargando] = useState(datos === undefined);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    const enCache = leerCache<T>(claveCompleta);
    if (enCache !== undefined) setDatosEstado(enCache);
    setCargando(enCache === undefined);
    setError(null);

    consultar()
      .then((resultado) => {
        if (!vigente) return;
        setDatosEstado(resultado);
        guardarCache(claveCompleta, resultado);
      })
      .catch((err) => {
        if (vigente) setError(getApiErrorMessage(err, mensajeError));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // `consultar` cambia en cada render; lo que define cuándo repetir son `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  /** Cambia los datos en pantalla y en el caché, así al volver no aparece la versión anterior. */
  const setDatos = useCallback((valor: SetStateAction<T | undefined>) => {
    setDatosEstado((previos) => {
      const nuevos =
        typeof valor === 'function' ? (valor as (previos: T | undefined) => T | undefined)(previos) : valor;
      guardarCache(claveRef.current, nuevos);
      return nuevos;
    });
  }, []);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, setDatos, cargando, error, setError, recargar };
}
