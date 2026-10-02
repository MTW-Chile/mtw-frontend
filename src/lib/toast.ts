// Store minimo (pub-sub, sin libreria) para notificaciones de error
// globales -- se necesita poder disparar un toast desde AFUERA del arbol de
// React (el onError de QueryCache/MutationCache en App.tsx se define antes
// de que exista ningun componente), asi que no alcanza con un simple
// useState/Context.
export type ToastTipo = 'error' | 'info';

export interface ToastItem {
  id: number;
  mensaje: string;
  // Detalle tecnico (metodo+URL+status) -- pensado como ayuda de debug, no
  // para el usuario final, por eso va mas chico/discreto en el toast.
  detalle?: string;
  tipo: ToastTipo;
}

let contador = 0;
let items: ToastItem[] = [];
let listeners: Array<(items: ToastItem[]) => void> = [];

function emitir() {
  listeners.forEach((l) => l(items));
}

export function mostrarToast(mensaje: string, opts?: { tipo?: ToastTipo; detalle?: string; duracionMs?: number }): void {
  const id = ++contador;
  items = [...items, { id, mensaje, detalle: opts?.detalle, tipo: opts?.tipo ?? 'error' }];
  emitir();
  const duracion = opts?.duracionMs ?? 10000;
  setTimeout(() => quitarToast(id), duracion);
}

export function quitarToast(id: number): void {
  items = items.filter((i) => i.id !== id);
  emitir();
}

export function suscribirToasts(fn: (items: ToastItem[]) => void): () => void {
  listeners.push(fn);
  fn(items);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

// Mismo criterio de extraccion de mensaje que ya se repite en cada
// mutation.onError de la app (err?.response?.data?.error || err?.message).
// detalle es puramente informativo para quien este debuggeando -- metodo,
// URL y status de la request que fallo, cuando hay uno (axios).
export function extraerErrorParaToast(error: unknown): { mensaje: string; detalle?: string } {
  const err = error as any;
  const mensaje = err?.response?.data?.error || err?.message || 'Error inesperado';
  const metodo = err?.config?.method ? String(err.config.method).toUpperCase() : null;
  const url = err?.config?.url as string | undefined;
  const status = err?.response?.status as number | undefined;
  const detalle = metodo && url ? `${metodo} ${url}${status ? ` · ${status}` : ''}` : undefined;
  return { mensaje, detalle };
}
