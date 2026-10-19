import { useEffect, useSyncExternalStore } from 'react';

/**
 * Últimas pantallas visitadas por el usuario (Inicio › "Visitado recientemente").
 * Se guardan en este navegador, por usuario: es una comodidad, no un registro.
 * Las anota MigasDePan con la ruta que muestra el encabezado.
 */
export interface Reciente {
  /** Ruta de la app sin el prefijo de base, ej. /proyectos?proyecto=abc&seccion=cubicacion */
  href: string;
  seccion: string;
  /** Migas después de la sección, ej. ["Edificio X", "Cubicación"]. */
  ruta: string[];
  codigo?: string;
  visitadoEn: number;
}

const MAXIMO = 8;
const EVENTO = 'mtw:recientes';
const clave = (email: string) => `mtw-recientes:${email.toLowerCase()}`;

function leer(email: string | undefined): Reciente[] {
  if (!email) return [];
  try {
    const valor = JSON.parse(localStorage.getItem(clave(email)) ?? '[]');
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

export function anotarReciente(email: string | undefined, r: Omit<Reciente, 'visitadoEn'>) {
  if (!email || r.seccion === 'inicio') return;
  // Misma pantalla = misma ruta visible (los filtros de la URL no cuentan como otra).
  const id = [r.seccion, ...r.ruta].join('›');
  const lista = [{ ...r, visitadoEn: Date.now() }, ...leer(email).filter((x) => [x.seccion, ...x.ruta].join('›') !== id)].slice(0, MAXIMO);
  try {
    localStorage.setItem(clave(email), JSON.stringify(lista));
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // Sin almacenamiento (modo privado): no se recuerda, nada más.
  }
}

let cache: { email?: string; raw: string | null; lista: Reciente[] } = { raw: null, lista: [] };

export function useRecientes(email: string | undefined): Reciente[] {
  return useSyncExternalStore(
    (o) => {
      window.addEventListener(EVENTO, o);
      window.addEventListener('storage', o);
      return () => {
        window.removeEventListener(EVENTO, o);
        window.removeEventListener('storage', o);
      };
    },
    () => {
      let raw: string | null = null;
      try {
        raw = email ? localStorage.getItem(clave(email)) : null;
      } catch {
        raw = null;
      }
      if (cache.email !== email || cache.raw !== raw) cache = { email, raw, lista: leer(email) };
      return cache.lista;
    }
  );
}

/** Anota la pantalla actual cuando su ruta visible se asienta (las migas llegan en varios renders). */
export function useAnotarReciente(email: string | undefined, r: Omit<Reciente, 'visitadoEn'> | null) {
  const id = r ? [r.href, r.seccion, ...r.ruta, r.codigo ?? ''].join('›') : '';
  useEffect(() => {
    if (!r || r.ruta.some((x) => x === 'Cargando…')) return;
    const t = window.setTimeout(() => anotarReciente(email, r), 1200);
    return () => window.clearTimeout(t);
    // r se reconstruye en cada render; lo que importa es su contenido (id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, email]);
}
