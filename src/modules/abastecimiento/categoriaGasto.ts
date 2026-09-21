import type { CategoriaGasto } from '../../types';

// Mismo dominio que CategoriaGasto en mtw-api. Con materialId, mtw-api
// deriva la categoria sola de la familia del material -- esto solo hace
// falta para items SIN materialId (partidas externas tipo flete/mano de
// obra) y para mostrar la etiqueta legible en el listado de OC.
export const CATEGORIA_GASTO_OPTIONS: { value: CategoriaGasto; label: string }[] = [
  { value: 'PERFILERIA', label: 'Perfilería' },
  { value: 'HERRAJES', label: 'Herrajes' },
  { value: 'VIDRIOS', label: 'Vidrios' },
  { value: 'ACCESORIOS', label: 'Accesorios' },
  { value: 'REFUERZOS', label: 'Refuerzos' },
  { value: 'MANO_DE_OBRA', label: 'Mano de obra' },
  { value: 'FLETE', label: 'Flete' },
  { value: 'INSTALACION', label: 'Instalación' },
  { value: 'OTROS', label: 'Otros' },
];

export const CATEGORIA_GASTO_LABEL: Record<CategoriaGasto, string> = Object.fromEntries(
  CATEGORIA_GASTO_OPTIONS.map((o) => [o.value, o.label])
) as Record<CategoriaGasto, string>;
