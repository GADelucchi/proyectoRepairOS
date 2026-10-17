import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Cada cuánto se pregunta si se publicó una versión nueva. */
const INTERVALO_MS = 30 * 60 * 1000;
/** Si la versión nueva aparece apenas abierta la app, todavía no hay nada que perder. */
const GRACIA_AL_ABRIR_MS = 15 * 1000;

/**
 * Mantiene la app al día con la última versión publicada, sin mostrar avisos.
 *
 * Busca versión nueva cada media hora y al volver a la pestaña (una pestaña
 * abierta días enteros no se enteraba nunca). Cuando la encuentra, la aplica
 * recargando la página, pero en un momento seguro:
 *  - en seguida, si la app se acaba de abrir;
 *  - si no, al pasar a otra pantalla, así no se pierde un formulario a medio cargar.
 *
 * Los archivos viejos los borra el service worker nuevo al activarse.
 */
export function ActualizacionDisponible() {
  const { pathname } = useLocation();
  const abiertaEn = useRef(Date.now());
  const pantallaAlDetectar = useRef<string | null>(null);

  const {
    needRefresh: [hayVersionNueva],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      const buscar = () => {
        if (navigator.onLine) registro.update().catch(() => undefined);
      };
      setInterval(buscar, INTERVALO_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') buscar();
      });
    }
  });

  useEffect(() => {
    if (!hayVersionNueva) return;
    if (Date.now() - abiertaEn.current < GRACIA_AL_ABRIR_MS) {
      updateServiceWorker(true);
      return;
    }
    if (pantallaAlDetectar.current === null) {
      pantallaAlDetectar.current = pathname;
      return;
    }
    if (pathname !== pantallaAlDetectar.current) updateServiceWorker(true);
  }, [hayVersionNueva, pathname, updateServiceWorker]);

  return null;
}
