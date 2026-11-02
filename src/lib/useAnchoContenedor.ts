import { useCallback, useEffect, useState } from 'react';

/**
 * Ancho real del espacio donde vive una pantalla (descuenta el menú lateral, abierto o contraído).
 * El breakpoint de la ventana no sirve para decidir entre tabla y tarjetas: un iPad Mini en vertical
 * tiene 768 px, pero con el menú abierto la tabla dispone de ~500. Uso:
 *   const [ref, ancho] = useAnchoContenedor(); <div ref={ref}>…</div>
 */
export function useAnchoContenedor<T extends HTMLElement = HTMLDivElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [ancho, setAncho] = useState(() => window.innerWidth);
  useEffect(() => {
    if (!el) return;
    setAncho(el.getBoundingClientRect().width);
    const obs = new ResizeObserver((entradas) => setAncho(entradas[0].contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [el]);
  const ref = useCallback((nodo: T | null) => setEl(nodo), []);
  return [ref, ancho];
}
