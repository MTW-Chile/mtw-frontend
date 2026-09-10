import { useState, useEffect } from 'react';

/**
 * Sólo monta la vista de escritorio O la de mobile, nunca las dos --
 * a diferencia del patrón `hidden md:block` / `block md:hidden`, que
 * renderiza el doble de nodos DOM (uno de los dos siempre oculto por CSS,
 * pero igual reconciliado por React en cada render). App 100% cliente
 * (sin SSR), así que no hay riesgo de mismatch de hidratación al leer
 * `window.matchMedia` en el estado inicial.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
