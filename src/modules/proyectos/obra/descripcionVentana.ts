import type { Ventana, VidrioFabricacion } from '../../../types';
import { toWindowLine } from '../../cotizaciones/components/drawing/ventanaAdapter';
import { getAcabadoNombre } from '../../cotizaciones/components/drawing/colorSystem';
import * as core from '../../cotizaciones/components/drawing/geometryCore';

/**
 * Descripción de una ventana tal como va en el PDF del presupuesto (presupuestoPdf.ts › analizarVentana): la apertura
 * la dice el motor de dibujo a partir de la geometría («Corredera 1 hoja derecha + fijo»), no el texto del documento
 * de fabricación («LINEA PRIME. Vidrios: 5/9/5 INC. . .»); la composición es línea de perfil y color. La usan la ficha
 * de ventana (Instalación, Pendientes) y el cubicador, para obras cotizadas y legacy por igual.
 */
export interface DescripcionVentana {
  apertura: string;
  /** «Línea Prime - Color Jet Black»; vacío si no se sabe ninguno de los dos. */
  composicion: string;
}

export function describirVentana(v: Ventana | null | undefined): DescripcionVentana | null {
  if (!v) return null;
  if (v.tipoLineaManual === 'PROTEX') return { apertura: 'Puerta Protex', composicion: '' };
  const linea = toWindowLine(v);
  const sinMarco = Boolean(linea?.dibujoSinMarco);
  const apertura = (linea ? core.apertureLabel(linea) : '') || 'Ventana fija';
  const serie = core.profileSeries({ modelo: v.descripcionCorta || v.modelo });
  // En una ventana de fabricación el acabado puede venir como la descripción entera del documento (sirve para pintar
  // el dibujo, no para leerse): solo se muestra si es un nombre de color.
  // «Jet Black (DISCONTINUADO)» es una marca del catálogo de HETMO, no parte del nombre del color.
  const acabado = getAcabadoNombre(v.acabadoCodigo, v.acabadoDescripcion).replace(/\s*\(DISCONTINUADO\)\s*/i, '').trim();
  const acabadoLegible = acabado && acabado.length <= 30 && acabado !== (v.descripcionCorta ?? '').trim() ? acabado : '';
  const composicion = sinMarco ? '' : [serie !== 'Línea no especificada' ? serie : null, acabadoLegible ? `Color ${acabadoLegible}` : null].filter(Boolean).join(' - ');
  return { apertura: sinMarco ? 'Vidrio fijo sin marco' : apertura, composicion };
}

/** «5/9/5 INC (2)»: los vidrios distintos de la ventana con su cantidad, sin medidas (van al elegir el vidrio). */
export function describirVidrios(vidrios: Pick<VidrioFabricacion, 'codigo_articulo' | 'descripcion_articulo' | 'UDS'>[]): string {
  const porTipo = new Map<string, number>();
  for (const g of vidrios) {
    const nombre = (g.descripcion_articulo || '').trim() || g.codigo_articulo;
    porTipo.set(nombre, (porTipo.get(nombre) ?? 0) + (Number(g.UDS) || 1));
  }
  return [...porTipo.entries()].map(([nombre, n]) => `${nombre} (${n})`).join(' + ');
}
