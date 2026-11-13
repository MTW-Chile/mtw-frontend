import type { Proyecto } from '../types';

/**
 * Obra "legacy": ya estaba en ejecución cuando partió el ERP y nunca se cotizó aquí
 * (Proyecto.origen = MANUAL_OBRA). Es la ÚNICA definición en el frontend: toda pantalla
 * que se comporta distinto en estas obras pregunta por aquí, no compara `origen`.
 * En pantalla se llama "Anterior al ERP" (nunca "legacy" ni "manual"). Espejo de
 * src/dominio/obras/legacy.ts en la API.
 *
 * Lo que cambia en ellas: no tienen presupuesto (sus ventanas llegan de los documentos
 * de fabricación y se ubican con la planilla de control), en pantalla no hay "tipos" ni
 * nomenclatura, y sus compras no se llevan en el sistema (sin OC, reservas ni bodega).
 */
export const esObraLegacy = (obra: { origen?: Proyecto['origen'] } | null | undefined): boolean => obra?.origen === 'MANUAL_OBRA';

/** Texto del indicador que acompaña a la obra en las listas. */
export const ETIQUETA_OBRA_LEGACY = 'Anterior al ERP';

/** Explicación al pasar el cursor (y para lectores de pantalla). */
export const AYUDA_OBRA_LEGACY = 'Obra que ya estaba en ejecución cuando partió el ERP: no se cotizó aquí, así que no tiene presupuesto, compras ni cobros en el sistema.';

/** Código con que se identifica una obra en todo el sitio. */
export const codigoDeObra = (obra: { codigoInterno?: string | null; numeroPresupuesto?: number | null }): string => obra.codigoInterno || `PRJ-${obra.numeroPresupuesto ?? ''}`;
