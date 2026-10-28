import type { Permiso, Proyecto } from '../../types';

// Pestañas de la ficha de una obra. La MISMA obra se abre desde dos secciones
// del menu, cada una con sus pestañas (ver SECCIONES_OBRA y SECCIONES_FABRICACION):
//  - Comercial > Obras en curso (modo 'obra'): lo que se vende, se compra y se cobra.
//  - Taller > Fabricación (modo 'fabricacion'): lo que se cubica, se produce, se
//    pide a bodega, y lo que falla en obra. Los despachos tienen su propia
//    sección del menú (modules/despachos).
// 'general' reune lo que antes eran Control de presupuesto y Documentos.
// 'requisiciones': solicitudes de material a bodega (antes vivian en la pestaña
// Bodega de la obra, junto con el stock; el stock se mira ahora en el modulo Bodega).
export type SeccionObra = 'general' | 'cubicacion' | 'requisiciones' | 'fabricacion' | 'abastecimiento' | 'pendientes' | 'adicionales' | 'estados-pago';

export const SECCIONES_OBRA: SeccionObra[] = ['general', 'abastecimiento', 'adicionales', 'estados-pago'];

// 'fabricacion' se muestra como "Fases" (el id se mantiene por las URLs guardadas).
export const SECCIONES_FABRICACION: SeccionObra[] = ['general', 'cubicacion', 'fabricacion', 'requisiciones', 'pendientes'];

export type ModoWorkspace = 'obra' | 'fabricacion';

// Una obra manual (nunca cotizada) en Comercial solo tiene Información General:
// las métricas de las ventanas de sus documentos de fabricación y la carpeta de
// OneDrive. Lo que se vende y se cobra sale del presupuesto, que no tiene.
export const SECCIONES_OBRA_MANUAL: SeccionObra[] = ['general'];

export function seccionesDelModo(modo: ModoWorkspace, origen?: Proyecto['origen']): SeccionObra[] {
  if (modo === 'fabricacion') return SECCIONES_FABRICACION;
  return origen === 'MANUAL_OBRA' ? SECCIONES_OBRA_MANUAL : SECCIONES_OBRA;
}

// Permiso que habilita cada pestaña, ademas de obras.ver (que abre la ficha).
// La API exige lo mismo en sus rutas: ocultar aca es solo UX. Sin entrada =
// basta con obras.ver.
export const PERMISO_SECCION: Partial<Record<SeccionObra, Permiso>> = {
  abastecimiento: 'compras.ver',
  adicionales: 'adicionales.ver',
  'estados-pago': 'estados_pago.ver',
  pendientes: 'pendientes.ver',
};

// Enlaces guardados de antes: Control de presupuesto y Documentos pasaron a
// Información General; la pestaña Bodega de la obra, a Requisiciones.
const ALIAS: Record<string, SeccionObra> = { presupuesto: 'general', documentos: 'general', bodega: 'requisiciones' };

// Secciones que dependen de haber cotizado la obra (presupuesto, fases...).
// Una obra manual (origen MANUAL_OBRA) nunca se cotizo, asi que esas secciones
// se muestran en gris. Es una decision POR AHORA: si se habilita alguna para
// obras manuales, basta quitarla de esta lista y el menu se activa.
export const SECCIONES_QUE_REQUIEREN_PRESUPUESTO: SeccionObra[] = ['abastecimiento', 'requisiciones'];

export function seccionDisponible(seccion: SeccionObra, origen: Proyecto['origen']): boolean {
  return !(origen === 'MANUAL_OBRA' && SECCIONES_QUE_REQUIEREN_PRESUPUESTO.includes(seccion));
}

// Seccion a mostrar: la pedida (ej. desde la URL) si existe en este modo y esta
// disponible para esta obra; si no, Información General.
export function seccionEfectiva(solicitada: string | undefined, origen: Proyecto['origen'], modo: ModoWorkspace = 'obra'): SeccionObra {
  const permitidas = seccionesDelModo(modo, origen);
  const candidata = solicitada ? (ALIAS[solicitada] ?? solicitada) : undefined;
  const valida = permitidas.find((s) => s === candidata);
  if (valida && seccionDisponible(valida, origen)) return valida;
  return 'general';
}
