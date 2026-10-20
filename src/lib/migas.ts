import { useEffect, useSyncExternalStore } from 'react';

/**
 * Migas de pan del encabezado del sitio (DESIGN.md 4): "Bodega › Maestro de
 * materiales › Materiales". La sección de primer nivel la pone el Header; cada
 * pantalla declara aquí los niveles que agrega (pestaña, subpestaña, registro
 * abierto) con useMigas. Una miga con `alHacerClic` vuelve a ese nivel.
 */
export interface Miga {
  label: string;
  alHacerClic?: () => void;
  /** Código que va pegado al nombre (ej. el de la obra o presupuesto). */
  codigo?: string;
}

let actuales: { id: number; nivel: number; migas: Miga[] }[] = [];
const oyentes = new Set<() => void>();
let instantanea: Miga[] = [];
let siguienteId = 1;

function emitir() {
  // React monta los efectos de adentro hacia afuera: el orden lo da el nivel.
  instantanea = [...actuales].sort((a, b) => a.nivel - b.nivel || a.id - b.id).flatMap((a) => a.migas);
  oyentes.forEach((o) => o());
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => oyentes.delete(o);
}

/** Lo que el Header muestra después de la sección. */
export function useMigasActuales(): Miga[] {
  return useSyncExternalStore(suscribir, () => instantanea);
}

/**
 * Declara los niveles de esta pantalla a partir de `nivel` (1 = pestaña de la
 * página, 2 = subpestaña, 3 = registro abierto). Las migas con label vacío se
 * omiten (ej. un registro que aún carga). Se quitan al desmontar la pantalla.
 */
export function useMigas(nivel: number, migas: (Miga | null | false | undefined)[]) {
  const validas = migas.filter((m): m is Miga => !!m && !!m.label);
  const clave = validas.map((m) => m.label).join('›');
  useEffect(() => {
    const id = siguienteId++;
    actuales.push({ id, nivel, migas: validas });
    emitir();
    return () => {
      actuales = actuales.filter((a) => a.id !== id);
      emitir();
    };
    // Las funciones de clic cambian en cada render; la ruta visible la define el texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, nivel]);
}
