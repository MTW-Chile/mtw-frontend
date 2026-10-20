import type { Proyecto } from '../../types';

// 'fases' se fusiono dentro de 'fabricacion' (sub-pestañas Fases /
// Documentos de fabricación). 'general' reune lo que antes eran las pestañas
// Control de presupuesto y Documentos.
export type SeccionObra = 'general' | 'cubicacion' | 'fabricacion' | 'abastecimiento' | 'pendientes' | 'adicionales' | 'bodega';

export const SECCIONES_OBRA: SeccionObra[] = ['general', 'cubicacion', 'fabricacion', 'abastecimiento', 'pendientes', 'adicionales', 'bodega'];

// Enlaces guardados de antes de Información General.
const ALIAS: Record<string, SeccionObra> = { presupuesto: 'general', documentos: 'general' };

// Secciones que dependen de haber cotizado la obra (presupuesto, ventanas,
// fases...). Una obra manual (origen MANUAL_OBRA) nunca se cotizo, asi que
// esas secciones se muestran en gris. Es una decision POR AHORA: si se habilita
// alguna para obras manuales, basta quitarla de esta lista y el menu se activa.
export const SECCIONES_QUE_REQUIEREN_PRESUPUESTO: SeccionObra[] = ['abastecimiento', 'bodega'];

export function seccionDisponible(seccion: SeccionObra, origen: Proyecto['origen']): boolean {
  return !(origen === 'MANUAL_OBRA' && SECCIONES_QUE_REQUIEREN_PRESUPUESTO.includes(seccion));
}

// Seccion a mostrar: la pedida (ej. desde la URL) si existe y esta disponible
// para esta obra; si no, Información General.
export function seccionEfectiva(solicitada: string | undefined, origen: Proyecto['origen']): SeccionObra {
  const valida = SECCIONES_OBRA.find((s) => s === solicitada) ?? (solicitada ? ALIAS[solicitada] : undefined);
  if (valida && seccionDisponible(valida, origen)) return valida;
  return 'general';
}
