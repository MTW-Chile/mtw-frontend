import type { Ventana, CorreccionGeometria } from '../../../../types';
import { updateVentanaCorreccionGeometria, deleteVentanaCorreccionGeometria } from '../../../../api/client';

/**
 * Aplica un cambio parcial sobre la corrección de geometría de una línea
 * (travesaños manuales, mano invertida) conservando lo ya guardado -- hojas
 * de corredera incluidas. Si lo que queda no corrige nada, se elimina la
 * corrección en vez de guardar una vacía.
 */
export function correccionConCambios(
  ventana: Ventana,
  cambios: Partial<Pick<CorreccionGeometria, 'invertirMano' | 'travesanos'>>
): CorreccionGeometria | null {
  const actual = ventana.correccionGeometria;
  const siguiente: CorreccionGeometria = {
    hojas: [],
    ...actual,
    esquema: 2,
    lineaHetmo: ventana.lineaHetmo,
    apertura: actual?.apertura ?? ventana.dibujoTipoApertura ?? 0,
    ...cambios,
  };
  if (!siguiente.invertirMano) delete siguiente.invertirMano;
  if (!siguiente.travesanos?.length) delete siguiente.travesanos;
  const vacia = !siguiente.hojas.length && !siguiente.invertirMano && !siguiente.travesanos;
  return vacia ? null : siguiente;
}

export async function guardarCorreccionDibujo(
  ventana: Ventana,
  cambios: Partial<Pick<CorreccionGeometria, 'invertirMano' | 'travesanos'>>
): Promise<Ventana> {
  const correccion = correccionConCambios(ventana, cambios);
  const result = correccion
    ? await updateVentanaCorreccionGeometria(ventana.id, correccion)
    : await deleteVentanaCorreccionGeometria(ventana.id);
  if (!result.success || !result.data) throw new Error(result.message || 'No se pudo guardar el ajuste.');
  return result.data;
}
