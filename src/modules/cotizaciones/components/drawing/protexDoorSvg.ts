/**
 * Dibujo SVG de una Puerta Protex (1 o 2 hojas), aislado del motor
 * vectorial compartido (windowGeometryBuilder.ts / geometryCore.ts).
 *
 * Una Protex no trae perfil de aluminio en su receta (solo vidrio +
 * herrajes), así que isFrameless() del motor compartido la clasificaría
 * siempre como "sin marco" y la forzaría a dibujo tipo DVH fijo, sin
 * herrajes -- conectarla al motor de puertas abatibles real significaría
 * tocar esa regla compartida por TODAS las ventanas y el PDF. Este dibujo
 * es autocontenido a propósito.
 *
 * Puerta de vidrio templado sin marco (herrajes tipo "patch fitting"):
 * puro vidrio de borde a borde, sin perfil visible. Las bisagras van
 * ocultas dentro de las abrazaderas de esquina -- 3 por hoja (superior
 * izquierda, inferior izquierda, inferior derecha; la superior derecha no
 * va, confirmado contra el producto real). La manilla es una barra
 * vertical pegada al canto de vidrio más cercano, no horizontal.
 */

import { dimensionMarkup } from './windowSvgMarkup';

// Mismas constantes de lienzo que windowGeometryBuilder.ts, para que el
// tamaño/posicion de cotas se vea consistente con el resto de dibujos.
const CANVAS_W = 240;
const CANVAS_H = 178;
const DRAWING_MAX_WIDTH = 180;
const DRAWING_MAX_HEIGHT = 116;
const DRAWING_OFFSET_X = 30;
const DRAWING_OFFSET_Y = 8;

const GLASS_COLOR = '#d8f2f4';
const GLASS_EDGE = '#7595a2';
const METAL_COLOR = '#64748b'; // slate-500

function cornerPatches(x: number, y: number, width: number, height: number, mirror: boolean): string {
  const w = 9;
  const h = 6;
  const inset = 1.5;
  const left = x + inset;
  const right = x + width - inset - w;
  const bottom = y + height - inset - h;
  // 3 abrazaderas por hoja, no 4 -- a la hoja le falta la de la esquina
  // superior del lado de la manilla (no del lado de la bisagra), asi que
  // una puerta de 2 hojas queda espejada: la hoja izquierda sin la
  // superior derecha, la hoja derecha sin la superior izquierda.
  const corners = mirror
    ? [
        [right, y + inset], // sup. der.
        [left, bottom], // inf. izq.
        [right, bottom], // inf. der.
      ]
    : [
        [left, y + inset], // sup. izq.
        [left, bottom], // inf. izq.
        [right, bottom], // inf. der.
      ];
  return corners
    .map(([cx, cy]) => `<rect x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" width="${w}" height="${h}" rx="0.8" fill="${METAL_COLOR}" />`)
    .join('');
}

function verticalHandle(x: number, y: number, height: number): string {
  const barLen = Math.min(48, height * 0.32);
  const hy = y + height / 2 - barLen / 2;
  return `<rect x="${(x - 1.3).toFixed(2)}" y="${hy.toFixed(2)}" width="2.6" height="${barLen.toFixed(2)}" rx="1.3" fill="${METAL_COLOR}" />`;
}

function leafSvg(x: number, y: number, width: number, height: number, handleSide: 'left' | 'right', mirror: boolean): string {
  // Pegada al canto de vidrio mas cercano.
  const handleX = handleSide === 'left' ? x + 4.5 : x + width - 4.5;
  return (
    `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="${GLASS_COLOR}" stroke="${GLASS_EDGE}" stroke-width="1" />` +
    cornerPatches(x, y, width, height, mirror) +
    verticalHandle(handleX, y, height)
  );
}

/**
 * @param hojas 1 o 2 hojas.
 * @param anchoMm Ancho TOTAL de la puerta (ya multiplicado por la cantidad
 * de hojas, ver POST /api/ventanas/manual en mtw-api).
 * @param altoMm Alto de la puerta.
 */
export function buildProtexDoorSvg(hojas: 1 | 2, anchoMm: number, altoMm: number): string {
  const w = Math.max(1, anchoMm || 1);
  const h = Math.max(1, altoMm || 1);
  const scale = Math.min(DRAWING_MAX_WIDTH / w, DRAWING_MAX_HEIGHT / h);
  const drawW = Math.max(20, w * scale);
  const drawH = Math.max(40, h * scale);
  const x = DRAWING_OFFSET_X + (DRAWING_MAX_WIDTH - drawW) / 2;
  const y = DRAWING_OFFSET_Y + (DRAWING_MAX_HEIGHT - drawH) / 2;
  const gap = hojas === 2 ? 1 : 0;

  const leaves =
    hojas === 2
      ? leafSvg(x, y, drawW / 2 - gap / 2, drawH, 'right', false) +
        leafSvg(x + drawW / 2 + gap / 2, y, drawW / 2 - gap / 2, drawH, 'left', true)
      : leafSvg(x, y, drawW, drawH, 'right', false);

  const cotas = dimensionMarkup(w, h, x, y, drawW, drawH);

  // width/height=100% explicito -- sin esto el <svg> insertado via
  // dangerouslySetInnerHTML usa su tamano intrinseco por defecto del
  // navegador (mucho mas chico que el contenedor), a diferencia de
  // WindowRendererSvg que le fuerza la clase manualmente por JS despues de
  // insertarlo al DOM.
  return `<svg viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${leaves}${cotas}</svg>`;
}
