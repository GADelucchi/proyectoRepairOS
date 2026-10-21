import { CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { EVENTO_ABRIR_GUIA, guiaVista, PASOS_GUIA } from './pasos';

const MARGEN = 8;
const ANCHO_GLOBO = 320;
/** Distancia entre el elemento señalado y el globo (lo que ocupa la flecha). */
const SEPARACION = 14;
/** Alto supuesto del globo hasta medirlo en la primera pasada. */
const ALTO_ESTIMADO = 220;

type LadoFlecha = 'arriba' | 'abajo' | 'izquierda';

interface Posicion {
  /** Recuadro del elemento señalado, o null si el paso va centrado. */
  hueco: DOMRect | null;
  globo: CSSProperties;
  flecha: LadoFlecha | null;
  /** Dónde va la flecha sobre el borde del globo: horizontal arriba/abajo, vertical a la izquierda. */
  flechaDesplazamiento: number;
}

const entre = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo);

/** Elemento del paso si está a la vista (el menú cerrado del celular lo esconde). */
function elementoVisible(objetivo?: string): HTMLElement | null {
  if (!objetivo) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${objetivo}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/**
 * Dónde va el globo, con su alto real (`alto`) para que nunca quede fuera de la
 * pantalla con los botones tapados.
 *
 * Al lado del elemento si es del menú lateral y hay lugar a la derecha; si no,
 * abajo o arriba, donde entre. Si no entra en ningún lado (pantallas chicas),
 * del lado con más espacio y con el texto desplazable adentro.
 */
function calcularPosicion(el: HTMLElement | null, alto: number): Posicion {
  const anchoVentana = window.innerWidth;
  const altoVentana = window.innerHeight;
  const ancho = Math.min(ANCHO_GLOBO, anchoVentana - 2 * MARGEN);
  const altoMaximo = altoVentana - 2 * MARGEN;
  const altoReal = Math.min(alto, altoMaximo);

  if (!el) {
    return {
      hueco: null,
      globo: {
        top: '50%',
        left: '50%',
        width: ancho,
        maxHeight: altoMaximo,
        transform: 'translate(-50%, -50%)'
      },
      flecha: null,
      flechaDesplazamiento: 0
    };
  }

  const r = el.getBoundingClientRect();

  // Menú lateral: a la derecha del ítem, centrado en su altura.
  const enElCostado = r.left < anchoVentana / 3;
  if (enElCostado && r.right + SEPARACION + ancho + MARGEN <= anchoVentana) {
    const medio = r.top + r.height / 2;
    const top = entre(medio - altoReal / 2, MARGEN, altoVentana - altoReal - MARGEN);
    return {
      hueco: r,
      globo: { top, left: r.right + SEPARACION, width: ancho, maxHeight: altoMaximo },
      flecha: 'izquierda',
      flechaDesplazamiento: entre(medio - top, 16, altoReal - 16)
    };
  }

  const centro = r.left + r.width / 2;
  const left = entre(centro - ancho / 2, MARGEN, anchoVentana - ancho - MARGEN);
  const flechaDesplazamiento = entre(centro - left, 16, ancho - 16);
  const espacioAbajo = altoVentana - r.bottom - SEPARACION - MARGEN;
  const espacioArriba = r.top - SEPARACION - MARGEN;
  const abajo = altoReal <= espacioAbajo || (altoReal > espacioArriba && espacioAbajo >= espacioArriba);
  const espacio = Math.max(abajo ? espacioAbajo : espacioArriba, 120);

  return {
    hueco: r,
    globo: abajo
      ? { top: r.bottom + SEPARACION, left, width: ancho, maxHeight: espacio }
      : { bottom: altoVentana - r.top + SEPARACION, left, width: ancho, maxHeight: espacio },
    flecha: abajo ? 'arriba' : 'abajo',
    flechaDesplazamiento
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
  // Alto natural del globo (sin recortar), medido en pantalla: cambia con el texto de cada paso.
  const [altoGlobo, setAltoGlobo] = useState(ALTO_ESTIMADO);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);

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

  // Lleva el elemento del paso a la vista.
  useEffect(() => {
    if (paso) elementoVisible(paso.objetivo)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [paso]);

  // Ubica el globo junto al elemento y lo sigue si cambia el tamaño o se scrollea.
  useLayoutEffect(() => {
    if (!paso) return;
    const ubicar = () => setPosicion(calcularPosicion(elementoVisible(paso.objetivo), altoGlobo));
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => {
      window.removeEventListener('resize', ubicar);
      window.removeEventListener('scroll', ubicar, true);
    };
  }, [paso, altoGlobo]);

  // Mide el alto natural del globo (texto completo + botones). Si cambió, se vuelve
  // a ubicar antes de pintar, así nunca se ve cortado.
  useLayoutEffect(() => {
    const contenido = contenidoRef.current;
    const pie = pieRef.current;
    if (!contenido || !pie) return;
    // 14 px de relleno arriba y abajo, más el borde.
    const natural = contenido.scrollHeight + pie.offsetHeight + 30;
    if (Math.abs(natural - altoGlobo) > 1) setAltoGlobo(natural);
  }, [paso, posicion, altoGlobo]);

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
            style={
              posicion.flecha === 'izquierda'
                ? { top: posicion.flechaDesplazamiento }
                : { left: posicion.flechaDesplazamiento }
            }
          />
        )}
        {/* Si no entra entero, se desplaza el texto: los botones quedan siempre a la vista. */}
        <div ref={contenidoRef} className="guia-contenido">
          <div className="small text-muted mb-1">
            {indice + 1} de {pasos.length}
          </div>
          <h6 id="guia-titulo" className="mb-2">
            {paso.titulo}
          </h6>
          <p className="small mb-0">
            {paso.texto}
            {enMenuCerrado && <span className="d-block mt-1 text-muted">Lo encontrás en el menú ☰.</span>}
          </p>
        </div>
        <div ref={pieRef} className="d-flex justify-content-between align-items-center pt-3">
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
