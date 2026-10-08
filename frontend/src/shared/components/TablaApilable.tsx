import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Table, type TableProps } from 'react-bootstrap';

/**
 * Tabla que en pantallas chicas se muestra como una lista de tarjetas: cada
 * renglón es una tarjeta y cada celda una línea "Columna: valor". Así entra
 * entera en el ancho del celular, sin deslizar de costado.
 *
 * Los títulos se copian de `<thead>` a cada celda (`data-label`), que es lo que
 * usa el CSS para mostrarlos; se vuelven a copiar cuando cambian los renglones.
 * Las celdas sin dato no se muestran en la versión de tarjetas.
 */
export const TablaApilable = forwardRef<HTMLTableElement, TableProps>(function TablaApilable(
  { className = '', ...props },
  ref
) {
  const tablaRef = useRef<HTMLTableElement>(null);
  useImperativeHandle(ref, () => tablaRef.current!);

  useLayoutEffect(() => {
    const tabla = tablaRef.current;
    if (!tabla) return;
    const etiquetar = () => {
      const titulos = [...tabla.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
      tabla.querySelectorAll('tbody tr').forEach((tr) =>
        [...tr.children].forEach((celda, i) => {
          if (celda.hasAttribute('colspan')) return;
          celda.setAttribute('data-label', titulos[i] ?? '');
          // Las celdas sin dato ("-") se ocultan en el celular: alargan la tarjeta sin decir nada.
          const vacia =
            !celda.querySelector('a, button, img, svg, input') &&
            ['', '-', '—'].includes(celda.textContent?.trim() ?? '');
          celda.toggleAttribute('data-vacia', vacia);
        })
      );
    };
    etiquetar();
    // Cambios de renglones o de su texto: los atributos que pone `etiquetar` no lo vuelven a disparar.
    const observador = new MutationObserver(etiquetar);
    observador.observe(tabla, { childList: true, subtree: true, characterData: true });
    return () => observador.disconnect();
  }, []);

  return <Table ref={tablaRef} className={`tabla-apilable ${className}`} {...props} />;
});
