/**
 * Funciones de markup SVG para el constructor de geometría de ventanas.
 * Contiene todas las funciones que generan SVG markup, extraídas de
 * windowGeometryBuilder.ts para reducir su tamaño y centralizar la
 * generación de SVG.
 *
 * @module windowSvgMarkup
 */

import * as core from './geometryCore';
import {
  VISUAL,
  profileColors,
  metalColors,
  createFinish,
} from './colorSystem';
import type {
  WindowLine,
  HardwareSpec,
  FinishColors,
  MetalColorSet,
  ApertureDefinition,
  OpeningSymbolSegment,
  MuntinLine,
  GlassSplit,
} from './types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function lineStyle(stroke: string, width: number, extra = ''): string {
  return `fill:none;stroke:${stroke};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round;${extra}`;
}

export function escape(value: string): string {
  const amp = '&'.concat('amp;');
  const lt = '&'.concat('lt;');
  const gt = '&'.concat('gt;');
  const quot = '&'.concat('quot;');
  const apos = '&'.concat('#39;');
  const map: Record<string, string> = {
    '&': amp,
    '<': lt,
    '>': gt,
    '"': quot,
    "'": apos,
  };
  return String(value ?? '').replace(/[&<>"']/g, char => map[char] || char);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ─── Color helpers (usados por handleMark/hingeMarkup) ─────────────────────────

export function finishFor(line: WindowLine): FinishColors {
  return createFinish(
    line.acabadoCodigo,
    line.acabadoDescripcion,
    line.acabadoPatron,
    line.materiales?.map(m => m.acabado).filter((a): a is string => Boolean(a))
  );
}

export function metalFor(line: WindowLine, role: string): MetalColorSet {
  const finish = finishFor(line);
  const base = String(core.hardwareColor(
    line.materiales,
    finish.frame,
    role
  ));
  return metalColors(base);
}

// ─── Funciones de markup (retornan string SVG) ─────────────────────────────────

export function glassMarkup(
  className: string,
  x: number,
  y: number,
  width: number,
  height: number,
  hasGlass = true
): string {
  return `<rect class="${className}" x="${x}" y="${y}" width="${width}" height="${height}" style="fill:${hasGlass ? VISUAL.glass : '#ffffff'};stroke:${VISUAL.glassEdge};stroke-width:.8"/>`;
}

/**
 * Grosor de los perfiles, en unidades del lienzo. Un perfil se dibuja SIEMPRE
 * dentro de los límites que recibe (nunca hacia afuera): así dos unidades
 * vecinas de una ventana compuesta quedan pegadas borde con borde en vez de
 * solaparse, que es como las une la fábrica.
 */
export const FRAME_THICKNESS = 4.5;
export const SASH_THICKNESS = 3.4;

/**
 * Perfil de aluminio/PVC como banda sólida: cuerpo relleno con el color del
 * acabado, bisel de luz arriba-izquierda y de sombra abajo-derecha, ingletes
 * en las esquinas y el canto interior hundido. Es la pieza común del marco
 * (frameMarkup) y de la hoja (sashMarkup): ambos son perfiles reales, no
 * contornos huecos.
 */
function profileBandMarkup(
  groupClass: string,
  bodyClass: string,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  color: { base: string; light: string; dark: string },
  extraAttrs = ''
): string {
  const t = clamp(thickness, 1, Math.max(1, Math.min(width, height) / 2 - 0.4));
  const ix = x + t;
  const iy = y + t;
  const iw = Math.max(0.6, width - t * 2);
  const ih = Math.max(0.6, height - t * 2);
  return `<g class="${groupClass}"${extraAttrs}>`
    + `<rect class="${bodyClass}" x="${x}" y="${y}" width="${width}" height="${height}" rx=".8" style="fill:${color.base};stroke:${color.dark};stroke-width:.6"/>`
    + `<path d="M ${x + 0.5} ${y + height - 0.5} V ${y + 0.5} H ${x + width - 0.5}" style="${lineStyle(color.light, 1, 'opacity:.75')}"/>`
    + `<path d="M ${x + 0.5} ${y + height - 0.5} H ${x + width - 0.5} V ${y + 0.5}" style="${lineStyle(color.dark, 1, 'opacity:.6')}"/>`
    + `<path class="window-profile-miters" d="M ${x} ${y} L ${ix} ${iy} M ${x + width} ${y} L ${ix + iw} ${iy} M ${x} ${y + height} L ${ix} ${iy + ih} M ${x + width} ${y + height} L ${ix + iw} ${iy + ih}" style="${lineStyle(color.dark, 0.35, 'opacity:.45')}"/>`
    + `<path d="M ${ix} ${iy + ih} V ${iy} H ${ix + iw}" style="${lineStyle(color.dark, 0.8, 'opacity:.55')}"/>`
    + `<path d="M ${ix} ${iy + ih} H ${ix + iw} V ${iy}" style="${lineStyle(color.light, 0.8, 'opacity:.5')}"/>`
    + `</g>`;
}

export function frameMarkup(
  className: string,
  x: number,
  y: number,
  width: number,
  height: number,
  finish: FinishColors,
  thickness = FRAME_THICKNESS
): string {
  return profileBandMarkup(className, 'window-frame-profile', x, y, width, height, thickness, profileColors(finish));
}

export function sashMarkup(
  x: number,
  y: number,
  width: number,
  height: number,
  finish: FinishColors,
  thickness = SASH_THICKNESS
): string {
  return profileBandMarkup(
    'window-sash',
    'window-sash-profile',
    x,
    y,
    width,
    height,
    thickness,
    profileColors(finish),
    ' data-profile-layer="raised"'
  );
}

export function fixedGlazingMarkup(
  x: number,
  y: number,
  width: number,
  height: number,
  finish: FinishColors,
  inset = 1.45
): string {
  const color = profileColors(finish);
  const bx = x + inset;
  const by = y + inset;
  const bw = Math.max(1, width - inset * 2);
  const bh = Math.max(1, height - inset * 2);
  return `<g class="window-fixed-glazing" data-profile-layer="frame-glazing">`
    + `<rect class="window-glazing-bead" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx=".15" style="fill:none;stroke:${color.dark};stroke-width:.48;opacity:.68"/>`
    + `<path d="M ${bx + 0.35} ${by + bh - 0.35} V ${by + 0.35} H ${bx + bw - 0.35}" style="${lineStyle(color.light, 0.35, 'opacity:.52')}"/>`
    + `</g>`;
}

export function dividerMarkup(
  x: number,
  y1: number,
  y2: number,
  finish: FinishColors,
  width = 2.2
): string {
  const color = profileColors(finish);
  return `<g class="window-sash-divider">`
    + `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" style="${lineStyle(color.base, width)}"/>`
    + `<line x1="${x - 0.55}" y1="${y1}" x2="${x - 0.55}" y2="${y2}" style="${lineStyle(color.light, 0.55, 'opacity:.65')}"/>`
    + `<line x1="${x + 0.55}" y1="${y1}" x2="${x + 0.55}" y2="${y2}" style="${lineStyle(color.dark, 0.55, 'opacity:.5')}"/>`
    + `</g>`;
}

export function transomMarkup(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  finish: FinishColors
): string {
  const color = profileColors(finish);
  // Perfil con el mismo bisel luz/sombra que el marco (frameMarkup) y las
  // hojas (sashMarkup), en vez de una línea plana -- el travesaño es un
  // perfil físico real, no solo una marca de corte.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const offset = 0.55;
  return `<g class="window-transom">`
    + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="${lineStyle(color.base, 2.8)}"/>`
    + `<line x1="${x1 + nx * offset}" y1="${y1 + ny * offset}" x2="${x2 + nx * offset}" y2="${y2 + ny * offset}" style="${lineStyle(color.light, 0.6, 'opacity:.7')}"/>`
    + `<line x1="${x1 - nx * offset}" y1="${y1 - ny * offset}" x2="${x2 - nx * offset}" y2="${y2 - ny * offset}" style="${lineStyle(color.dark, 0.6, 'opacity:.55')}"/>`
    + `</g>`;
}

export function glassSplitMarkup(
  source: Record<string, unknown>,
  x: number,
  y: number,
  width: number,
  height: number,
  finish: FinishColors,
  singleLeaf: boolean
): string {
  const seen = new Set<string>();
  return core.panelGlassSplits(source)
    .map((split: GlassSplit) => {
      if (split.axis === 'vertical' && !singleLeaf) return '';
      const key = `${split.axis}|${split.at.toFixed(3)}`;
      if (seen.has(key)) return '';
      seen.add(key);
      return split.axis === 'horizontal'
        ? transomMarkup(x, y + height * split.at, x + width, y + height * split.at, finish)
        : transomMarkup(x + width * split.at, y, x + width * split.at, y + height, finish);
    })
    .join('');
}

export function dimensionMarkup(
  width: number,
  height: number,
  x: number,
  y: number,
  drawingW: number,
  drawingH: number
): string {
  return `<text class="window-dimension" x="${x + drawingW / 2}" y="${y + drawingH + 29}" text-anchor="middle" style="font:700 9px system-ui,sans-serif;fill:${VISUAL.dimension}">${Math.round(width).toLocaleString('es-CL')} mm</text>`
    + `<text class="window-dimension" x="${x - 17}" y="${y + drawingH / 2}" text-anchor="middle" transform="rotate(-90 ${x - 17} ${y + drawingH / 2})" style="font:700 9px system-ui,sans-serif;fill:${VISUAL.dimension}">${Math.round(height).toLocaleString('es-CL')} mm</text>`;
}

export function segmentDimensionMarkup(
  x: number,
  width: number,
  drawingBottom: number,
  value: number
): string {
  const lineY = drawingBottom + 7;
  const tickTop = drawingBottom + 4;
  const tickBottom = drawingBottom + 10;
  return `<g class="window-segment-dimension">`
    + `<path d="M ${x} ${tickTop} V ${tickBottom} M ${x} ${lineY} H ${x + width} M ${x + width} ${tickTop} V ${tickBottom}" style="${lineStyle(VISUAL.dimension, 0.45, 'opacity:.78')}"/>`
    + `<text x="${x + width / 2}" y="${drawingBottom + 17}" text-anchor="middle" style="font:600 6.3px system-ui,sans-serif;fill:${VISUAL.dimension}">${Math.round(value).toLocaleString('es-CL')}</text>`
    + `</g>`;
}

export function glassCodeMarkup(
  className: string,
  value: string,
  x: number,
  y: number
): string {
  return value
    ? `<text class="${className}" x="${x}" y="${y}" style="font:700 6.4px system-ui,sans-serif;fill:${VISUAL.glassText};paint-order:stroke;stroke:#f6fbfc;stroke-width:1.7px;stroke-linejoin:round">${escape(value)}</text>`
    : '';
}

export function fixedMark(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): string {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = Math.min(5, Math.max(2.5, Math.min(width, height) * 0.08));
  return `<path d="M ${cx - size} ${cy} H ${cx + size} M ${cx} ${cy - size} V ${cy + size}" style="${lineStyle(color, 1.1)}"/>`;
}

export function slidingMark(
  kind: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  axisY: number
): string {
  if (kind === 'fijo') return fixedMark(x, y, width, height, color);
  if (kind.endsWith(':both')) {
    const mid = axisY;
    const inset = Math.min(9, Math.max(4, width * 0.16));
    const left = x + inset;
    const right = x + width - inset;
    return `<path d="M ${left} ${mid} H ${right} M ${left} ${mid} l 4 -3 M ${left} ${mid} l 4 3 M ${right} ${mid} l -4 -3 M ${right} ${mid} l -4 3" style="${lineStyle(color, 1.15)}"/>`;
  }
  const direction = kind.endsWith(':right') ? 'right' : 'left';
  const mid = axisY;
  const inset = Math.min(9, Math.max(4, width * 0.16));
  const from = direction === 'right' ? x + inset : x + width - inset;
  const to = direction === 'right' ? x + width - inset : x + inset;
  const head = direction === 'right' ? -1 : 1;
  return `<path d="M ${from} ${mid} H ${to} M ${to} ${mid} l ${head * 4} -3 M ${to} ${mid} l ${head * 4} 3" style="${lineStyle(color, 1.15)}"/>`;
}

export function hingedMark(
  type: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  axisY: number
): string {
  const sharedDefinition = core.apertureDefinition(null, type) as ApertureDefinition;
  const sharedSegments = core.openingSymbolSegments(null, type) as OpeningSymbolSegment[];
  if (sharedSegments.length) {
    const paths = sharedSegments
      .map((segment: OpeningSymbolSegment) => {
        const alignsWithHandle = ['hinged', 'projecting', 'tilt'].includes(sharedDefinition.symbol);
        const d = segment.points
          .map(([px, py]: [number, number], index: number) => {
            const pointY = alignsWithHandle && index === 1 ? axisY : y + height * py;
            return `${index ? 'L' : 'M'} ${x + width * px} ${pointY}`;
          })
          .join(' ');
        const axis = alignsWithHandle ? ` data-axis-y="${axisY}"` : '';
        return `<path data-opening-role="${segment.role}" data-opening-face="${segment.face || ''}"${axis} d="${d}" style="${lineStyle(color, segment.role === 'tilt' ? 1.05 : 1.2, segment.dashed ? 'stroke-dasharray:3 2' : '')}"/>`;
      })
      .join('');
    const face = sharedDefinition.face === 'interior' ? 'Int.' : sharedDefinition.face === 'exterior' ? 'Ext.' : '';
    return `${paths}${face ? `<text x="${x + width / 2}" y="${y + 9}" text-anchor="middle" style="font:700 6px system-ui,sans-serif;fill:${color}">${face}</text>` : ''}`;
  }
  return fixedMark(x, y, width, height, color);
}

export function doubleHingedMark(
  side: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  axisY: number
): string {
  const edge = side === 'left' ? x + 4 : x + width - 4;
  const centre = side === 'left' ? x + width - 4 : x + 4;
  return `<path data-opening-role="turn" data-axis-y="${axisY}" d="M ${edge} ${y + 4} L ${centre} ${axisY} L ${edge} ${y + height - 4}" style="${lineStyle(color, 1.2)}"/>`;
}

export function doubleTiltTurnMark(
  side: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): string {
  return `${doubleHingedMark(side, x, y, width, height, color, y + height / 2)}<path data-opening-role="tilt" data-opening-face="interior" d="M ${x + 4} ${y + height - 4} L ${x + width / 2} ${y + 4} L ${x + width - 4} ${y + height - 4}" style="${lineStyle(color, 1.05)}"/>`;
}

export function openingAxisY(
  line: WindowLine,
  leaf: Record<string, unknown>,
  y: number,
  height: number,
  physicalHeight: number
): number {
  const heightInfo = core.handleHeightFor(line, leaf, physicalHeight);
  return y + height - height * heightInfo.millimeters / Math.max(1, physicalHeight);
}

export function handleMark(
  spec: HardwareSpec,
  line: WindowLine,
  leaf: Record<string, unknown>,
  x: number,
  y: number,
  width: number,
  height: number,
  physicalHeight: number
): string {
  if (!spec || spec.role === 'none') return '';
  const metal = metalColors(String(core.hardwareColor(
    line.materiales,
    finishFor(line).frame,
    'handle'
  )));
  const heightInfo = core.handleHeightFor(line, leaf, physicalHeight);
  const hy = spec.position === 'bottom'
    ? y + height - 3
    : spec.position === 'top'
      ? y + 3
      : openingAxisY(line, leaf, y, height, physicalHeight);
  const side = spec.side === 'left' ? 'left' : spec.side === 'right' ? 'right' : 'center';
  const hx = side === 'left'
    ? x + 3.5
    : side === 'right'
      ? x + width - 3.5
      : x + width / 2;
  if (spec.role === 'striker') {
    return `<g class="window-striker" data-reason="${escape(spec.reason)}">`
      + `<rect x="${hx - 1.3}" y="${hy - 7}" width="2.6" height="14" rx=".9" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
      + `<line x1="${hx - 0.75}" y1="${hy - 6}" x2="${hx - 0.75}" y2="${hy + 6}" style="${lineStyle(metal.light, 0.55, 'opacity:.8')}"/>`
      + `<rect x="${hx - 2.6}" y="${hy - 2.6}" width="5.2" height="5.2" rx=".9" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
      + `</g>`;
  }
  const leverX = side === 'left' ? hx + 8 : side === 'right' ? hx - 8 : hx;
  const leverY = spec.orientation === 'up' ? hy - 9 : spec.position === 'top' ? hy + 9 : hy;
  const lever = side === 'center'
    ? `M ${hx} ${hy} L ${leverX} ${leverY}`
    : `M ${hx} ${hy} H ${leverX}`;
  const glare = side === 'center'
    ? `M ${hx - 0.7} ${hy} L ${leverX - 0.7} ${leverY}`
    : `M ${hx} ${hy - 0.75} H ${leverX}`;
  const heightSource = spec.position ? `${spec.position}-by-opening` : heightInfo.reason;
  return `<g class="window-handle" data-axis-y="${hy}" data-height-source="${heightSource}" data-reason="${escape(spec.reason || 'opening-leaf')}">`
    + `<circle cx="${hx}" cy="${hy}" r="2.4" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
    + `<circle cx="${hx - 0.6}" cy="${hy - 0.6}" r="1" style="fill:${metal.light};opacity:.8"/>`
    + `<path d="${lever}" style="${lineStyle(metal.base, 3, `stroke:${metal.base}`)}"/>`
    + `<path d="${lever}" style="${lineStyle(metal.edge, 3.6, 'opacity:.35')}"/>`
    + `<path d="${lever}" style="${lineStyle(metal.base, 2.8)}"/>`
    + `<path d="${glare}" style="${lineStyle(metal.light, 0.8, 'opacity:.85')}"/>`
    + `</g>`;
}

export function hingeMarkup(
  side: string,
  count: number,
  x: number,
  y: number,
  width: number,
  height: number,
  reason: string,
  line: WindowLine
): string {
  if (!count || !['left', 'right', 'top', 'bottom'].includes(side)) return '';
  const metal = metalColors(String(core.hardwareColor(
    line.materiales,
    finishFor(line).frame,
    'hinge'
  )));
  const thickness = 2.6;
  // Las proyectantes y abatibles llevan las bisagras en el canto horizontal
  // (arriba o abajo), no en el vertical: mismo herraje, girado 90 grados.
  if (side === 'top' || side === 'bottom') {
    const hy = side === 'top' ? y + 2.2 : y + height - 2.2;
    const barrel = clamp(width * 0.07, 5, 9);
    return Array.from({ length: count }, (_, index) => {
      const hx = x + width * (index + 1) / (count + 1);
      const left = hx - barrel / 2;
      return `<g class="window-hinge" data-reason="${escape(reason)}">`
        + `<rect x="${left}" y="${hy - thickness / 2}" width="${barrel}" height="${thickness}" rx="${thickness / 2}" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
        + `<line x1="${left + 0.8}" y1="${hy - thickness / 2 + 0.55}" x2="${left + barrel - 0.8}" y2="${hy - thickness / 2 + 0.55}" style="${lineStyle(metal.light, 0.6, 'opacity:.85')}"/>`
        + `</g>`;
    }).join('');
  }
  const hx = side === 'left' ? x + 2.2 : x + width - 2.2;
  const barrel = clamp(height * 0.07, 5, 9);
  return Array.from({ length: count }, (_, index) => {
    const hy = y + height * (index + 1) / (count + 1);
    const top = hy - barrel / 2;
    return `<g class="window-hinge" data-reason="${escape(reason)}">`
      + `<rect x="${hx - thickness / 2}" y="${top}" width="${thickness}" height="${barrel}" rx="${thickness / 2}" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
      + `<line x1="${hx - thickness / 2 + 0.55}" y1="${top + 0.8}" x2="${hx - thickness / 2 + 0.55}" y2="${top + barrel - 0.8}" style="${lineStyle(metal.light, 0.6, 'opacity:.85')}"/>`
      + `</g>`;
  }).join('');
}

export function muntinMarkup(
  line: WindowLine,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): string {
  const lines = core.muntinLines(line, width, height) as MuntinLine[];
  const stroke = profileColors({ frame: color }).dark;
  return lines
    .map((item: MuntinLine) =>
      `<line x1="${x + item.x1}" y1="${y + Math.max(2, item.y1)}" x2="${x + item.x2}" y2="${y + item.y2}" style="${lineStyle(stroke, 1.1)}"/>`
    )
    .join('');
}

