import type { ProyectoVersion } from '../../../types';
import { toWindowLine } from '../components/drawing/ventanaAdapter';
import { cuadrosFor } from '../components/drawing/geometryCore';

/**
 * Cantidad total de cuadros (marcos de PVC soldados, ver cuadrosFor en
 * geometryCore.ts) de la version, multiplicado por las unidades fisicas de
 * cada linea. Misma formula que IndicadoresMetricos.tsx (Step1DatosCliente)
 * -- confirmada contra Casa La Aurora: una linea SOLO DVH sin marco real no
 * aporta cuadros, una hoja movil suma su propio marco soldado, y una linea
 * compuesta (paños pegados) suma un marco por cada paño propio.
 *
 * Es geometria del dibujo (vive en el frontend), no un calculo de costo.
 */
export function computeCantidadCuadros(activeVersion: ProyectoVersion | undefined): number {
  const ventanas = activeVersion?.ventanas || [];
  return ventanas.reduce((acc, v) => {
    const line = toWindowLine(v);
    const count = line ? cuadrosFor(line) : 0;
    return acc + count * (v.unidades || 1);
  }, 0);
}
