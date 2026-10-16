/* global window, document, localStorage */
/**
 * Aplica el tema claro u oscuro antes de que se dibuje la página, para que no
 * parpadee. Es un archivo aparte (y no un script en línea) para no chocar con
 * una política de seguridad que solo permita scripts propios.
 * La misma lógica, completa, está en `src/shared/hooks/useTema.ts`.
 */
(function () {
  var elegido = null;
  try {
    elegido = localStorage.getItem('repairos_tema');
  } catch {
    // Sin almacenamiento se sigue al sistema.
  }
  var oscuro =
    elegido === 'oscuro' ||
    (elegido !== 'claro' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-bs-theme', oscuro ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', oscuro ? '#111113' : '#F4F4F5');
})();
