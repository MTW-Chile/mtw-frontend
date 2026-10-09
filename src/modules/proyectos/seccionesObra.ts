import type { Proyecto } from '../../types';

export type SeccionObra = 'presupuesto' | 'cubicacion' | 'fases' | 'abastecimiento' | 'fabricacion' | 'pendientes' | 'bodega';

export const SECCIONES_OBRA: SeccionObra[] = ['presupuesto', 'cubicacion', 'fases', 'abastecimiento', 'fabricacion', 'pendientes', 'bodega'];

// Secciones que dependen de haber cotizado la obra (presupuesto, ventanas,
// fases...). Una obra manual (origen MANUAL_OBRA) nunca se cotizo, asi que
// esas secciones se muestran en gris. Es una decision POR AHORA: si se habilita
// alguna para obras manuales, basta quitarla de esta lista y el menu se activa.
export const SECCIONES_QUE_REQUIEREN_PRESUPUESTO: SeccionObra[] = ['presupuesto', 'fases', 'abastecimiento', 'bodega'];

export function seccionDisponible(seccion: SeccionObra, origen: Proyecto['origen']): boolean {
  return !(origen === 'MANUAL_OBRA' && SECCIONES_QUE_REQUIEREN_PRESUPUESTO.includes(seccion));
}

// Seccion a mostrar: la pedida (ej. desde la URL) si existe y esta disponible
// para esta obra; si no, la primera util -- Fabricacion para una obra manual,
// Control de presupuesto para el resto.
export function seccionEfectiva(solicitada: string | undefined, origen: Proyecto['origen']): SeccionObra {
  const valida = SECCIONES_OBRA.find((s) => s === solicitada);
  if (valida && seccionDisponible(valida, origen)) return valida;
  return origen === 'MANUAL_OBRA' ? 'fabricacion' : 'presupuesto';
}
