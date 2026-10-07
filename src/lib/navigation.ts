import { useCallback, useSyncExternalStore } from 'react';

// Navegacion de la SPA sobre la History API del navegador, sin agregar
// react-router: la app ya decide que pantalla mostrar con estado propio
// (activeTab, proyecto abierto, paso del cotizador...), asi que basta con
// que ese estado VIVA en la URL en vez de en un useState.
//
// Que se gana con eso:
// - Los botones Atras/Adelante del navegador (y del mouse, y el gesto de
//   deslizar en el celular) vuelven a la pantalla anterior de la app en vez
//   de salir del sitio.
// - Recargar la pagina (F5) deja a la persona donde estaba.
// - Un link copiado de la barra de direcciones abre la misma pantalla.
//
// Formato de URL: /<seccion>?<param>=<valor>, ej.
//   /proyectos?proyecto=abc123&seccion=fases
//   /cotizaciones?cotizar=abc123&paso=3
// nginx ya sirve index.html para cualquier ruta (try_files en nginx.conf),
// asi que estas URLs funcionan tambien al entrar directo.

const EVENTO = 'mtw:navegacion';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(EVENTO, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(EVENTO, onChange);
  };
}

const getHref = () => window.location.pathname + window.location.search;

/** Reactivo a cualquier cambio de URL (navegar, Atras/Adelante). */
export function useLocationHref(): string {
  return useSyncExternalStore(subscribe, getHref);
}

// Cuantas entradas de historial creo la propia app en esta pestaña -- para
// saber si "Atras" va a una pantalla de la app (habilitar el boton) o
// saldria del sitio. history.state lleva el indice de cada entrada.
function indiceActual(): number {
  const st = window.history.state as { mtwIdx?: number } | null;
  return st?.mtwIdx ?? 0;
}

export interface OpcionesNavegar {
  /** Reemplaza la entrada actual en vez de agregar una nueva al historial. */
  replace?: boolean;
}

/**
 * Navega a `pathname` + params. Params con valor null/undefined/'' se
 * quitan de la URL. Si la URL resultante es igual a la actual no hace nada
 * (evita entradas duplicadas en el historial).
 */
export function navegar(
  pathname: string,
  params: Record<string, string | number | null | undefined> = {},
  { replace = false }: OpcionesNavegar = {}
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') sp.set(k, String(v));
  }
  const qs = sp.toString();
  const destino = pathname + (qs ? `?${qs}` : '');
  if (destino === getHref()) return;
  if (replace) {
    window.history.replaceState({ mtwIdx: indiceActual() }, '', destino);
  } else {
    window.history.pushState({ mtwIdx: indiceActual() + 1 }, '', destino);
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Seccion actual = primer segmento del path ('' en la raiz). */
export function seccionDesdePath(pathname = window.location.pathname): string {
  return decodeURIComponent(pathname.split('/').filter(Boolean)[0] || '');
}

/**
 * Un parametro de la URL actual como si fuera un useState. Cambiarlo agrega
 * una entrada al historial (salvo { replace: true }), asi que "Atras"
 * deshace el cambio -- usarlo para lo que la persona percibe como "otra
 * pantalla" (abrir un proyecto, cambiar de pestaña), no para cada tecla de
 * un buscador.
 */
export function useUrlParam(nombre: string): [string | null, (valor: string | null, opts?: OpcionesNavegar) => void] {
  const href = useLocationHref();
  const valor = new URL(href, window.location.origin).searchParams.get(nombre);

  const setValor = useCallback(
    (nuevo: string | null, opts?: OpcionesNavegar) => actualizarParams({ [nombre]: nuevo }, opts),
    [nombre]
  );

  return [valor, setValor];
}

/**
 * Cambia varios parametros de la URL actual a la vez (una sola entrada de
 * historial), conservando el resto. null quita el parametro -- ej. al
 * cerrar un proyecto: actualizarParams({ proyecto: null, seccion: null }).
 */
export function actualizarParams(cambios: Record<string, string | number | null | undefined>, opts?: OpcionesNavegar) {
  const actual: Record<string, string | number | null | undefined> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => {
    actual[k] = v;
  });
  navegar(window.location.pathname, { ...actual, ...cambios }, opts);
}

/** Hay una pantalla anterior DE LA APP en esta pestaña (Atras no sale del sitio). */
export function usePuedeVolver(): boolean {
  useLocationHref();
  return indiceActual() > 0;
}

/** Inicializa el indice de la primera entrada (llamar una vez al arrancar). */
export function inicializarHistorial() {
  if ((window.history.state as { mtwIdx?: number } | null)?.mtwIdx === undefined) {
    window.history.replaceState({ ...(window.history.state || {}), mtwIdx: 0 }, '', getHref());
  }
}
