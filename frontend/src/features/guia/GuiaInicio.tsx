import { CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { EVENTO_ABRIR_GUIA, guiaVista, PASOS_GUIA } from './pasos';

const MARGEN = 8;
const ANCHO_GLOBO = 320;

interface Posicion {
  /** Recuadro del elemento señalado, o null si el paso va centrado. */
  hueco: DOMRect | null;
  globo: CSSProperties;
  flecha: 'arriba' | 'abajo' | null;
  flechaIzquierda: number;
}

/** Elemento del paso si está a la vista (el menú cerrado del celular lo esconde). */
function elementoVisible(objetivo?: string): HTMLElement | null {
  if (!objetivo) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${objetivo}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

function calcularPosicion(el: HTMLElement | null): Posicion {
  const ancho = Math.min(ANCHO_GLOBO, window.innerWidth - 2 * MARGEN);
  if (!el) {
    return {
      hueco: null,
      globo: { top: '50%', left: '50%', width: ancho, transform: 'translate(-50%, -50%)' },
      flecha: null,
      flechaIzquierda: 0
    };
  }
  const r = el.getBoundingClientRect();
  const centro = r.left + r.width / 2;
  const left = Math.min(Math.max(MARGEN, centro - ancho / 2), window.innerWidth - ancho - MARGEN);
  // Abajo del elemento si entra; si no, arriba.
  const abajo = r.bottom + 180 < window.innerHeight;
  return {
    hueco: r,
    globo: abajo
      ? { top: r.bottom + 14, left, width: ancho }
      : { bottom: window.innerHeight - r.top + 14, left, width: ancho },
    flecha: abajo ? 'arriba' : 'abajo',
    flechaIzquierda: Math.min(Math.max(16, centro - left), ancho - 16)
  };
}

/**
 * Guía de primeros pasos: un globo con flecha que recorre el menú explicando
 * qué es cada cosa y qué conviene configurar primero.
 *
 * Se abre sola la primera vez que un usuario entra (en ese navegador) y se
 * puede volver a abrir con el botón "?" del menú.
 */
export function GuiaInicio() {
  const { usuario, esAdmin } = useAuth();
  const [indice, setIndice] = useState<number | null>(null);
  const [posicion, setPosicion] = useState<Posicion | null>(null);

  const pasos = useMemo(() => PASOS_GUIA.filter((p) => esAdmin || !p.soloAdmin), [esAdmin]);
  const paso = indice !== null ? pasos[indice] : null;

  const cerrar = useCallback(() => {
    setIndice(null);
    if (usuario) guiaVista.marcar(usuario.id);
  }, [usuario]);

  // Primera vez: se abre sola, con una pausa para que la pantalla termine de dibujarse.
  useEffect(() => {
    if (!usuario || guiaVista.leer(usuario.id)) return;
    const timer = setTimeout(() => setIndice(0), 800);
    return () => clearTimeout(timer);
  }, [usuario]);

  useEffect(() => {
    const abrir = () => setIndice(0);
    window.addEventListener(EVENTO_ABRIR_GUIA, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_GUIA, abrir);
  }, []);

  // Ubica el globo junto al elemento y lo sigue si cambia el tamaño o se scrollea.
  useLayoutEffect(() => {
    if (!paso) return;
    const el = elementoVisible(paso.objetivo);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const ubicar = () => setPosicion(calcularPosicion(elementoVisible(paso.objetivo)));
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => {
      window.removeEventListener('resize', ubicar);
      window.removeEventListener('scroll', ubicar, true);
    };
  }, [paso]);

  useEffect(() => {
    if (indice === null) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') setIndice((i) => (i !== null && i < pasos.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setIndice((i) => (i ? i - 1 : i));
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [indice, pasos.length, cerrar]);

  if (!paso || !posicion || indice === null) return null;

  const ultimo = indice === pasos.length - 1;
  const { hueco } = posicion;
  const enMenuCerrado = Boolean(paso.objetivo) && !hueco;

  return (
    <div className="guia" role="dialog" aria-modal="true" aria-labelledby="guia-titulo">
      {hueco ? (
        <div
          className="guia-hueco"
          style={{
            top: hueco.top - 4,
            left: hueco.left - 4,
            width: hueco.width + 8,
            height: hueco.height + 8
          }}
        />
      ) : (
        <div className="guia-fondo" onClick={cerrar} />
      )}

      <div className="guia-globo" style={posicion.globo}>
        {posicion.flecha && (
          <span
            className={`guia-flecha guia-flecha-${posicion.flecha}`}
            style={{ left: posicion.flechaIzquierda }}
          />
        )}
        <div className="small text-muted mb-1">
          {indice + 1} de {pasos.length}
        </div>
        <h6 id="guia-titulo" className="mb-2">
          {paso.titulo}
        </h6>
        <p className="small mb-3">
          {paso.texto}
          {enMenuCerrado && <span className="d-block mt-1 text-muted">Lo encontrás en el menú ☰.</span>}
        </p>
        <div className="d-flex justify-content-between align-items-center">
          <Button variant="link" size="sm" className="p-0 text-muted" onClick={cerrar}>
            {ultimo ? 'Cerrar' : 'Saltar guía'}
          </Button>
          <div className="d-flex gap-2">
            {indice > 0 && (
              <Button size="sm" variant="outline-secondary" onClick={() => setIndice(indice - 1)}>
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={() => (ultimo ? cerrar() : setIndice(indice + 1))} autoFocus>
              {ultimo ? 'Empezar' : 'Siguiente'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
