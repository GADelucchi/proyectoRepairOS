import { useCallback, useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'repairos_tema';
/** Color de la barra del navegador o de la app instalada, igual al fondo de cada tema. */
const COLOR_BARRA: Record<Tema, string> = { claro: '#F4F4F5', oscuro: '#111113' };

const consultaOscuro = () => window.matchMedia('(prefers-color-scheme: dark)');
const delSistema = (): Tema => (consultaOscuro().matches ? 'oscuro' : 'claro');

function elegido(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : null;
  } catch {
    return null;
  }
}

function aplicar(tema: Tema) {
  document.documentElement.setAttribute('data-bs-theme', tema === 'oscuro' ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[tema]);
}

/**
 * Tema claro u oscuro. Sigue al del sistema hasta que el usuario elige uno, y
 * esa elección queda guardada en el navegador.
 *
 * El tema inicial lo aplica `public/tema-inicial.js` antes de dibujar la página:
 * si cambia la lógica, cambia en los dos lados.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(() => elegido() ?? delSistema());

  useEffect(() => aplicar(tema), [tema]);

  // Sin elección propia, acompaña los cambios del sistema (el modo noche automático, por ejemplo).
  useEffect(() => {
    const consulta = consultaOscuro();
    const cambiar = () => {
      if (!elegido()) setTema(delSistema());
    };
    consulta.addEventListener('change', cambiar);
    return () => consulta.removeEventListener('change', cambiar);
  }, []);

  const alternar = useCallback(() => {
    const nuevo: Tema = tema === 'oscuro' ? 'claro' : 'oscuro';
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Sin almacenamiento el cambio dura hasta recargar.
    }
    setTema(nuevo);
  }, [tema]);

  return { tema, alternar };
}
