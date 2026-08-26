/**
 * Constructor de geometría de ventanas.
 * Unifica los caminos `build()` y `buildComposite()` de legacyGeometrySvg.ts
 * en una sola función que detecta automáticamente si la ventana es compuesta
 * o simple, y devuelve un `RenderResult` tipado.
 *
 * Etapa 4 del plan de refactorización.
 *
 * @module windowGeometryBuilder
 */

import * as core from './legacyGeometryCore';
import {
  VISUAL,
  createFinish,
  profileColors,
  metalColors,
} from './colorSystem';
import type {
  WindowLine,
  RailInfo,
  HardwareSpec,
  CompositeLayout,
  CompositePanel,
  CompositeTile,
  ApertureDefinition,
  MetalColorSet,
  FinishColors,
  SpecialOutline,
  MuntinLine,
  TraverseLine,
  GlassSplit,
  OpeningSymbolSegment,
  RenderResult,
} from './types';

// ─── Constantes de layout ─────────────────────────────────────────────────────

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 178;
const DRAWING_MAX_WIDTH = 180;
const DRAWING_MAX_HEIGHT = 116;
const DRAWING_OFFSET_X = 30;
const DRAWING_OFFSET_Y = 8;

// ─── Funciones auxiliares de geometría ────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escape(value: string): string {
  const map: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
  };
  map[String.fromCharCode(39)] = '&#39;';
  return String(value ?? '').replace(/[&<>"']/g, char => map[char] || char);
}

function computeDrawingDimensions(
  width: number,
  height: number
): { drawingW: number; drawingH: number; x: number; y: number; scale: number } {
  const w = Math.max(1, width || 1);
  const h = Math.max(1, height || 1);
  const scale = Math.min(DRAWING_MAX_WIDTH / w, DRAWING_MAX_HEIGHT / h);
  const drawingW = Math.max(14, w * scale);
  const drawingH = Math.max(14, h * scale);
  const x = DRAWING_OFFSET_X + (DRAWING_MAX_WIDTH - drawingW) / 2;
  const y = DRAWING_OFFSET_Y + (DRAWING_MAX_HEIGHT - drawingH) / 2;
  return { drawingW, drawingH, x, y, scale };
}

function getGlassCodes(line: WindowLine): string[] {
  const sqlGlassCodes = core.renderGlassRows(line)
    .map((item: { codigo_componente?: string }) => String(item?.codigo_componente || '').trim())
    .filter(Boolean);
  const declared = Array.isArray(line.dibujoVidrios) && line.dibujoVidrios.length
    ? line.dibujoVidrios.map(v => String(v || '').trim()).filter(Boolean)
    : sqlGlassCodes.length
      ? sqlGlassCodes
      : [String(line.dibujoVidrio ?? line.vidrioCodigo ?? '').trim()].filter(Boolean);
  return [...new Set(declared)];
}

function getUniqueGlassCode(line: WindowLine): string {
  const codes = getGlassCodes(line);
  return codes.length === 1 ? codes[0] : '';
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function finishFor(line: WindowLine): FinishColors {
  return createFinish(
    line.acabadoCodigo,
    line.acabadoDescripcion,
    line.acabadoPatron
  );
}

function metalFor(line: WindowLine, role: string): MetalColorSet {
  const finish = finishFor(line);
  const base = String(core.hardwareColor(
    line.materiales,
    finish.frame,
    role
  ));
  return metalColors(base);
}

// ─── Generación de SVG markup ─────────────────────────────────────────────────

function lineStyle(stroke: string, width: number, extra = ''): string {
  return `fill:none;stroke:${stroke};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round;${extra}`;
}

function glassMarkup(
  className: string,
  x: number,
  y: number,
  width: number,
  height: number,
  hasGlass = true
): string {
  return `<rect class="${className}" x="${x}" y="${y}" width="${width}" height="${height}" style="fill:${hasGlass ? VISUAL.glass : '#ffffff'};stroke:${VISUAL.glassEdge};stroke-width:.8"/>`;
}

function frameMarkup(
  className: string,
  x: number,
  y: number,
  width: number,
  height: number,
  finish: FinishColors
): string {
  const color = profileColors(finish);
  const outerX = x - 4.5;
  const outerY = y - 4.5;
  const outerWidth = width + 9;
  const outerHeight = height + 9;
  return `<g class="${className}">`
    + `<rect x="${outerX}" y="${outerY}" width="${outerWidth}" height="${outerHeight}" rx="1" style="fill:${color.base};stroke:${color.dark};stroke-width:1"/>`
    + `<path d="M ${outerX + 1} ${outerY + outerHeight - 1} V ${outerY + 1} H ${outerX + outerWidth - 1}" style="${lineStyle(color.light, 1.25, 'opacity:.72')}"/>`
    + `<path d="M ${outerX + 1} ${outerY + outerHeight - 1} H ${outerX + outerWidth - 1} V ${outerY + 1}" style="${lineStyle(color.dark, 1.25, 'opacity:.62')}"/>`
    + `<rect x="${x - 0.7}" y="${y - 0.7}" width="${width + 1.4}" height="${height + 1.4}" rx=".7" style="fill:none;stroke:${color.dark};stroke-width:.7;opacity:.66"/>`
    + `<path d="M ${x} ${y + height} V ${y} H ${x + width}" style="${lineStyle(color.light, 0.55, 'opacity:.55')}"/>`
    + `</g>`;
}

function sashMarkup(
  x: number,
  y: number,
  width: number,
  height: number,
  finish: FinishColors,
  inset = 2.2
): string {
  const color = profileColors(finish);
  const sx = x + inset;
  const sy = y + inset;
  const sw = Math.max(2, width - inset * 2);
  const sh = Math.max(2, height - inset * 2);
  const weight = clamp(Math.min(width, height) * 0.03, 1.8, 2.8);
  const beadInset = Math.max(1.4, weight * 0.8);
  const innerX = sx + beadInset;
  const innerY = sy + beadInset;
  const innerW = Math.max(1, sw - beadInset * 2);
  const innerH = Math.max(1, sh - beadInset * 2);
  return `<g class="window-sash" data-profile-layer="raised">`
    + `<rect class="window-sash-profile" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx=".65" style="fill:none;stroke:${color.base};stroke-width:${weight}"/>`
    + `<path class="window-sash-highlight" d="M ${sx + 0.45} ${sy + sh - 0.45} V ${sy + 0.45} H ${sx + sw - 0.45}" style="${lineStyle(color.light, 0.9, 'opacity:.82')}"/>`
    + `<path class="window-sash-shade" d="M ${sx + 0.45} ${sy + sh - 0.45} H ${sx + sw - 0.45} V ${sy + 0.45}" style="${lineStyle(color.dark, 0.9, 'opacity:.72')}"/>`
    + `<rect class="window-glazing-bead" x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" rx=".2" style="fill:none;stroke:${color.dark};stroke-width:.42;opacity:.72"/>`
    + `<path class="window-sash-miters" d="M ${sx} ${sy} L ${innerX} ${innerY} M ${sx + sw} ${sy} L ${innerX + innerW} ${innerY} M ${sx} ${sy + sh} L ${innerX} ${innerY + innerH} M ${sx + sw} ${sy + sh} L ${innerX + innerW} ${innerY + innerH}" style="${lineStyle(color.dark, 0.34, 'opacity:.42')}"/>`
    + `</g>`;
}

function fixedGlazingMarkup(
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

function dividerMarkup(
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

function transomMarkup(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  finish: FinishColors
): string {
  const color = profileColors(finish);
  return `<g class="window-transom"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="${lineStyle(color.base, 2.8)}"/></g>`;
}

function glassSplitMarkup(
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

function dimensionMarkup(
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

function segmentDimensionMarkup(
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

function glassCodeMarkup(
  className: string,
  value: string,
  x: number,
  y: number
): string {
  return value
    ? `<text class="${className}" x="${x}" y="${y}" style="font:700 6.4px system-ui,sans-serif;fill:${VISUAL.glassText};paint-order:stroke;stroke:#f6fbfc;stroke-width:1.7px;stroke-linejoin:round">${escape(value)}</text>`
    : '';
}

function fixedMark(
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

function slidingMark(
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

function hingedMark(
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

function doubleHingedMark(
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

function doubleTiltTurnMark(
  side: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): string {
  return `${doubleHingedMark(side, x, y, width, height, color, y + height / 2)}<path data-opening-role="tilt" data-opening-face="interior" d="M ${x + 4} ${y + height - 4} L ${x + width / 2} ${y + 4} L ${x + width - 4} ${y + height - 4}" style="${lineStyle(color, 1.05)}"/>`;
}

function openingAxisY(
  line: WindowLine,
  leaf: Record<string, unknown>,
  y: number,
  height: number,
  physicalHeight: number
): number {
  const heightInfo = core.handleHeightFor(line, leaf, physicalHeight);
  return y + height - height * heightInfo.millimeters / Math.max(1, physicalHeight);
}

function handleMark(
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
  const metal = metalFor(line, 'handle');
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

function hingeMarkup(
  side: string,
  count: number,
  x: number,
  y: number,
  width: number,
  height: number,
  reason: string,
  line: WindowLine
): string {
  if (!count || (side !== 'left' && side !== 'right')) return '';
  const metal = metalFor(line, 'hinge');
  const hx = side === 'left' ? x + 2.2 : x + width - 2.2;
  const barrel = clamp(height * 0.07, 5, 9);
  const thickness = 2.6;
  return Array.from({ length: count }, (_, index) => {
    const hy = y + height * (index + 1) / (count + 1);
    const top = hy - barrel / 2;
    return `<g class="window-hinge" data-reason="${escape(reason)}">`
      + `<rect x="${hx - thickness / 2}" y="${top}" width="${thickness}" height="${barrel}" rx="${thickness / 2}" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
      + `<line x1="${hx - thickness / 2 + 0.55}" y1="${top + 0.8}" x2="${hx - thickness / 2 + 0.55}" y2="${top + barrel - 0.8}" style="${lineStyle(metal.light, 0.6, 'opacity:.85')}"/>`
      + `</g>`;
  }).join('');
}

function muntinMarkup(
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

// ─── Builder de paño compuesto ────────────────────────────────────────────────

function buildCompositePanel(
  line: WindowLine,
  composite: CompositeLayout,
  target: string
): string {
  const width = Math.max(1, number(line.dibujoAncho ?? line.ancho) || 1);
  const height = Math.max(1, number(line.dibujoAlto ?? line.alto) || 1);
  const { drawingW, drawingH, x, y } = computeDrawingDimensions(width, height);
  const finish = finishFor(line);
  const glassOnly = Boolean(line.dibujoSinMarco);
  const guideCount = core.sliderGuideCount({ linea: line, materiales: line.materiales });
  const frameClass = target === 'line' ? 'line-window-frame' : 'offer-frame';
  const glassClass = target === 'line' ? 'line-window-glass' : 'offer-glass';
  const codeClass = target === 'line' ? 'line-window-glass-code' : 'offer-glass-code';
  const frame = glassOnly ? '' : frameMarkup(frameClass, x, y, drawingW, drawingH, finish);
  const glassCodes = getGlassCodes(line);
  const singleGlassCode = getUniqueGlassCode(line);
  const compositeOperable = composite.panels.reduce((sum: number, panel: CompositePanel) => {
    const definition = core.apertureDefinition(line, panel.apertura) as ApertureDefinition;
    if (!['hinged', 'door', 'tilt-turn'].includes(definition.family)) return sum;
    return sum + Math.max(1, definition.leafCount === 2 ? panel.aperturaCount || 2 : 1);
  }, 0);
  const compositeHinges = core.hingeCountFromHardware(
    line.materiales,
    line.uds ?? 0,
    compositeOperable
  ) as { count: number; reason: string };
  const scaleX = drawingW / Math.max(1, composite.width);
  const scaleY = drawingH / Math.max(1, composite.height);
  const foregroundGlassCodes: string[] = [];

  const panels = composite.tiles
    .map((tile: CompositeTile, index: number) => {
      const panel = tile.panel;
      const px = x + tile.x * scaleX;
      const py = y + tile.y * scaleY;
      const pw = tile.width * scaleX;
      const ph = tile.height * scaleY;
      const inset = 2.2;

      const panelPieces = core.slidingPieces({
        apertura: panel.apertura,
        raw: panel.raw,
        width: panel.width,
        movilLado: panel.movilLado,
        movilAncho: panel.movilAncho,
        materiales: Array.isArray(line.materiales) ? line.materiales : null,
        unidades: number(line.uds ?? 0),
        linea: line,
      });
      const panelLayout = panelPieces
        ? panelPieces.map((piece: { kind: string }) => piece.kind)
        : (core.sliderLayouts as Record<number, string[]>)[panel.apertura];
      const panelWeights: number[] = panelLayout
        ? (panelPieces
            ? panelPieces.map((piece: { width: number }) => Math.max(0, Number(piece.width) || 0))
            : ((core.sliderWeights as Record<number, number[]>)[panel.apertura] || panelLayout.map(() => 1 / panelLayout.length)).slice())
        : [];
      const exactLeaves = !panelPieces && panelLayout
        ? core.exactPanelLeaves(panel, panelLayout.length)
        : null;
      if (panelLayout && exactLeaves) {
        panelWeights.splice(
          0,
          panelWeights.length,
          ...exactLeaves.map((item: { ancho?: number; ancho_mm?: number }) =>
            Math.max(0, Number(item.ancho ?? item.ancho_mm) || 0)
          )
        );
      }

      let sash = '';
      const panelDefinition = core.apertureDefinition(line, panel.apertura) as ApertureDefinition;
      sash = glassOnly ? '' : panelDefinition.family === 'fixed'
        ? fixedGlazingMarkup(px, py, pw, ph, finish)
        : sashMarkup(px, py, pw, ph, finish, inset);

      const panelAxisY = panelDefinition?.family === 'projecting'
        ? py + ph - 3
        : openingAxisY(line, { component: panel }, py, ph, panel.height);

      const isDoubleOpening = (panelDefinition.symbol === 'hinged' || panelDefinition.symbol === 'tilt-turn')
        && panelDefinition.leafCount === 2 && panel.aperturaCount >= 2;
      const tiltSide = panelDefinition.symbol === 'tilt-turn' ? panelDefinition.hand : '';

      let mark = isDoubleOpening
        ? `${tiltSide === 'left' ? doubleTiltTurnMark('left', px, py, pw / 2, ph, '#2452d6') : doubleHingedMark('left', px, py, pw / 2, ph, '#2452d6', panelAxisY)}${tiltSide === 'right' ? doubleTiltTurnMark('right', px + pw / 2, py, pw / 2, ph, '#2452d6') : doubleHingedMark('right', px + pw / 2, py, pw / 2, ph, '#2452d6', panelAxisY)}`
        : (panel.apertura ? hingedMark(panel.apertura, px, py, pw, ph, '#2452d6', panelAxisY) : fixedMark(px, py, pw, ph, '#2452d6'));

      let hardwareMarkup = '';
      if (isDoubleOpening) {
        sash = glassOnly ? '' : `${sashMarkup(px, py, pw / 2, ph, finish, inset)}${sashMarkup(px + pw / 2, py, pw / 2, ph, finish, inset)}${dividerMarkup(px + pw / 2, py + 2, py + ph - 2, finish)}`;
        if (!glassOnly) {
          const activeSide = panelDefinition.hand === 'left' ? 'left' : 'right';
          const activeX = activeSide === 'left' ? px : px + pw / 2;
          const passiveX = activeSide === 'left' ? px + pw / 2 : px;
          hardwareMarkup += handleMark(
            { role: 'handle' as const, side: (activeSide === 'left' ? 'right' : 'left') as 'left' | 'right', reason: 'catalog-active-leaf' },
            line,
            { component: panel },
            activeX,
            py,
            pw / 2,
            ph,
            panel.height
          );
          hardwareMarkup += handleMark(
            { role: 'striker' as const, side: (activeSide === 'left' ? 'left' : 'right') as 'left' | 'right', reason: 'catalog-passive-leaf' },
            line,
            { component: panel },
            passiveX,
            py,
            pw / 2,
            ph,
            panel.height
          );
          if (compositeHinges.count && ['hinged', 'door', 'tilt-turn'].includes(panelDefinition.family)) {
            hardwareMarkup += hingeMarkup('left', compositeHinges.count, px, py, pw / 2, ph, compositeHinges.reason, line);
            hardwareMarkup += hingeMarkup('right', compositeHinges.count, px + pw / 2, py, pw / 2, ph, compositeHinges.reason, line);
          }
        }
      } else if (!glassOnly && (panelDefinition.family === 'hinged' || panelDefinition.family === 'door' || panelDefinition.family === 'tilt-turn')) {
        hardwareMarkup += handleMark(
          { role: 'handle' as const, side: (panelDefinition.hinge === 'right' ? 'left' : 'right') as 'left' | 'right', reason: 'opposite-hinge' },
          line,
          { component: panel },
          px,
          py,
          pw,
          ph,
          panel.height
        );
        if (compositeHinges.count && ['hinged', 'door', 'tilt-turn'].includes(panelDefinition.family)) {
          hardwareMarkup += hingeMarkup(panelDefinition.hinge || 'left', compositeHinges.count, px, py, pw, ph, compositeHinges.reason, line);
        }
      } else if (!glassOnly && panelDefinition.family === 'projecting') {
        hardwareMarkup += handleMark(
          { role: 'handle' as const, side: 'center' as const, position: 'bottom' as const, orientation: 'up' as const, reason: 'projecting-bottom' },
          line,
          { component: panel },
          px,
          py,
          pw,
          ph,
          panel.height
        );
      } else if (!glassOnly && panelDefinition.family === 'tilt') {
        hardwareMarkup += handleMark(
          { role: 'handle' as const, side: 'center' as const, reason: 'center-forced' },
          line,
          { component: panel },
          px,
          py,
          pw,
          ph,
          panel.height
        );
      }

      const panelGlass = glassCodes[index] || (glassCodes.length === 1 ? glassCodes[0] : '');
      let foregroundHardware = hardwareMarkup;

      if (panelLayout) {
        const totalWeight = panelWeights.reduce((sum: number, value: number) => sum + value, 0) || 1;
        const resolvedLeaves = panelLayout.map((kind: string, leafIndex: number) => {
          const piece = panelPieces?.[leafIndex] || exactLeaves?.[leafIndex] || {};
          const leaf = { ...piece, kind, width: panelWeights[leafIndex], apertura: panel.apertura, component: panel };
          const rail = core.railForLeaf(leaf, panelDefinition, leafIndex) as RailInfo;
          return { ...leaf, carril: rail.number, carrilFuente: rail.source };
        });
        const overlap = clamp(pw * 0.035, 2.6, 4.6);
        const boundaryOverlaps = resolvedLeaves.slice(0, -1).map(
          (leaf: { carril: number }, leafIndex: number) =>
            leaf.carril !== resolvedLeaves[leafIndex + 1].carril ? overlap : 0
        );
        const availableWidth = pw + boundaryOverlaps.reduce((sum: number, value: number) => sum + value, 0);
        let leafX = px;
        const sliderHardware = core.sliderHardware(resolvedLeaves) as HardwareSpec[];
        sash = '';
        const sliderLayers = panelLayout.map((kind: string, leafIndex: number) => {
          const leafWidth = availableWidth * panelWeights[leafIndex] / totalWeight;
          const depth = resolvedLeaves[leafIndex].carril;
          const leafInset = depth > 0 ? clamp(3.2 - (depth - 1) * 0.8, 1.4, 3.2) : 2.2;
          const leafSash = glassOnly ? '' : sashMarkup(leafX, py, leafWidth, ph, finish, leafInset);
          const leafAxisY = openingAxisY(line, resolvedLeaves[leafIndex], py, ph, panel.height);
          const leafMark = slidingMark(kind, leafX, py, leafWidth, ph, '#2452d6', leafAxisY);
          const leafHandle = glassOnly ? '' : handleMark(
            sliderHardware[leafIndex],
            line,
            resolvedLeaves[leafIndex],
            leafX,
            py,
            leafWidth,
            ph,
            panel.height
          );
          foregroundHardware += leafHandle;
          const visibleGlassCode = leafIndex === 0 && (!singleGlassCode || index === 0) ? panelGlass : '';
          const leafCode = glassCodeMarkup(codeClass, visibleGlassCode, leafX + 3, Math.min(py + ph - 3, 140));
          if (leafCode) foregroundGlassCodes.push(leafCode);
          const leafMuntins = muntinMarkup(line, leafX, py, leafWidth, ph, finish.frame);
          const depthStyle = depth === 1
            ? 'filter:drop-shadow(1.2px 1px .7px #26344555)'
            : depth > 1
              ? `opacity:${Math.max(0.9, 0.98 - (depth - 1) * 0.025)}`
              : '';
          const railName = depth > 0 ? `C${depth}` : '';
          const markup = `<g class="window-leaf-depth window-rail-${depth || 0}" data-leaf-index="${leafIndex}" data-leaf-x="${leafX}" data-leaf-width="${leafWidth}" data-rail="${railName}" data-rail-source="${escape(resolvedLeaves[leafIndex].carrilFuente || '')}" style="${depthStyle}">${leafSash}${leafMark}${leafMuntins}</g>`;
          leafX += leafWidth - (boundaryOverlaps[leafIndex] || 0);
          return { depth, index: leafIndex, markup };
        });
        mark = sliderLayers
          .sort((left: { depth: number; index: number }, right: { depth: number; index: number }) =>
            right.depth - left.depth || left.index - right.index
          )
          .map((item: { markup: string }) => item.markup)
          .join('');
      } else if (!panel.apertura && composite.verticalCuts?.length > 1 && composite.direction === 'vertical') {
        let fixedX = px;
        const cutWidths = [...composite.verticalCuts, composite.width].map(
          (cut: number, cutIndex: number, values: number[]) =>
            cut - (cutIndex ? values[cutIndex - 1] : 0)
        );
        const fixedTotal = cutWidths.reduce((sum: number, value: number) => sum + value, 0) || 1;
        sash = '';
        mark = cutWidths
          .map((cutWidth: number, fixedIndex: number) => {
            const fixedWidth = pw * cutWidth / fixedTotal;
            const fixedSash = glassOnly ? '' : fixedGlazingMarkup(fixedX, py, fixedWidth, ph, finish);
            const fixedIndicator = fixedMark(fixedX, py, fixedWidth, ph, '#2452d6');
            const fixedDivider = fixedIndex < cutWidths.length - 1
              ? dividerMarkup(fixedX + fixedWidth, py + 2, py + ph - 2, finish, 2.5)
              : '';
            fixedX += fixedWidth;
            return `${fixedSash}${fixedIndicator}${fixedDivider}`;
          })
          .join('');
      }

      const traverses = (core.panelTraverseLines(panel) as TraverseLine[])
        .map((item: TraverseLine) => {
          const x1 = px + pw * item.x1 / Math.max(1, panel.width);
          const y1 = py + ph * (1 - item.y1 / Math.max(1, panel.height));
          const x2 = px + pw * item.x2 / Math.max(1, panel.width);
          const y2 = py + ph * (1 - item.y2 / Math.max(1, panel.height));
          return transomMarkup(x1, y1, x2, y2, finish);
        })
        .join('');

      const splits = glassSplitMarkup(
        panel as unknown as Record<string, unknown>,
        px,
        py,
        pw,
        ph,
        finish,
        !panelLayout && !isDoubleOpening
      );

      const visiblePanelGlass = !singleGlassCode || index === 0 ? panelGlass : '';
      const panelCodeY = panelDefinition.family === 'projecting' ? py + 9 : Math.min(py + ph - 3, 140);
      const code = panelLayout ? '' : glassCodeMarkup(codeClass, visiblePanelGlass, px + 3, panelCodeY);
      if (code) foregroundGlassCodes.push(code);

      const panelMuntins = panelLayout ? '' : muntinMarkup(line, px, py, pw, ph, finish.frame);
      const panelDimension = composite.direction === 'vertical'
        ? ''
        : segmentDimensionMarkup(px, pw, y + drawingH, tile.width);

      return `${glassMarkup(glassClass, px, py, pw, ph)}${sash}${mark}${traverses}${splits}${panelMuntins}${panelDimension}${foregroundHardware}`;
    })
    .join('');

  const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';
  const apertureCodes = [...new Set(composite.panels.map((panel: CompositePanel) => number(panel.apertura)))];
  const apertureText = apertureCodes
    .map((code: number) => `Apertura ${code} · ${(core.apertureDefinition(line, code) as ApertureDefinition).label || 'Sin nombre confirmado'}`)
    .join(' + ');

  return `<svg class="${className}${glassOnly ? ` ${target === 'line' ? 'line-window-glass-only' : 'offer-window-glass-only'}` : ''}" data-aperture-code="${escape(apertureCodes.join(','))}" data-aperture-name="${escape(core.apertureLabel(line))}" data-guide-count="${guideCount || ''}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema compuesto de ${escape(line.modelo || 'ventana')}"><title>${escape(apertureText)}</title>${frame}${panels}<g class="window-glass-code-layer">${foregroundGlassCodes.join('')}</g>${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
}

// ─── Builder de ventana simple ────────────────────────────────────────────────

function buildSimpleWindow(
  line: WindowLine,
  target: string
): string {
  const width = Math.max(1, number(line.dibujoAncho ?? line.ancho) || 1);
  const height = Math.max(1, number(line.dibujoAlto ?? line.alto) || 1);
  const { drawingW, drawingH, x, y } = computeDrawingDimensions(width, height);
  const finish = finishFor(line);
  const glassOnly = Boolean(line.dibujoSinMarco);
  const guideCount = core.sliderGuideCount({ linea: line, materiales: line.materiales });
  const noGlass = core.isWithoutGlass(line);
  const outline = core.specialOutline(line) as SpecialOutline | null;

  // ─── Forma especial (círculo, polígono) ──────────────────────────────────
  if (outline) {
    const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';
    const glassClass = target === 'line' ? 'line-window-glass' : 'offer-glass';
    const shape = outline.kind === 'circle'
      ? `<ellipse${noGlass ? '' : ` class="${glassClass}"`} cx="${x + drawingW / 2}" cy="${y + drawingH / 2}" rx="${drawingW / 2}" ry="${drawingH / 2}" style="fill:${noGlass ? '#fff' : VISUAL.glass};stroke:${glassOnly ? VISUAL.glassEdge : finish.frame};stroke-width:${glassOnly ? 1.2 : 5}"/>`
      : (() => {
          const points = (outline as { kind: 'polygon'; points: [number, number][]; width: number; height: number }).points
            .map(([px, py]: [number, number]) => `${x + drawingW * px / outline.width},${y + drawingH * py / outline.height}`)
            .join(' ');
          return `<polygon${noGlass ? '' : ` class="${glassClass}"`} points="${points}" style="fill:${noGlass ? '#fff' : VISUAL.glass};stroke:${glassOnly ? VISUAL.glassEdge : finish.frame};stroke-width:${glassOnly ? 1.2 : 5};stroke-linejoin:round"/>`;
        })();
    const mark = noGlass ? '' : fixedMark(x, y, drawingW, drawingH, '#2452d6');
    const specialCode = number(line.dibujoTipoApertura ?? line.tipoApertura);
    const specialName = (core.apertureDefinition(line, specialCode) as ApertureDefinition).label || core.apertureLabel(line);
    return `<svg class="${className}" data-aperture-code="${specialCode || ''}" data-aperture-name="${escape(specialName)}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Geometria especial de ${escape(line.modelo || 'ventana')}"><title>${escape(`Apertura ${specialCode || 0} · ${specialName}`)}</title>${shape}${mark}${muntinMarkup(line, x, y, drawingW, drawingH, finish.frame)}${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
  }

  // ─── Ventana normal (hojas) ──────────────────────────────────────────────
  const allLeaves = core.leavesFor(line) as Record<string, unknown>[];
  const totalLeafWidth = allLeaves.reduce((sum: number, leaf: Record<string, unknown>) => sum + (leaf.width as number), 0) || width;
  const isSlider = allLeaves.some((leaf: Record<string, unknown>) => /^(?:int|ext|fijo):?/.test(String(leaf.kind || '')));
  const leafRails = allLeaves.map((leaf: Record<string, unknown>, index: number) => {
    const definition = core.apertureDefinition(line, leaf.apertura) as ApertureDefinition;
    return core.railForLeaf(leaf, definition, index) as RailInfo;
  });
  const overlap = isSlider && allLeaves.length > 1 ? clamp(drawingW * 0.03, 3, 5) : 0;
  const boundaryOverlaps = allLeaves.slice(0, -1).map(
    (_leaf: Record<string, unknown>, index: number) =>
      leafRails[index].number !== leafRails[index + 1].number ? overlap : 0
  );
  const leafDrawingWidth = drawingW + boundaryOverlaps.reduce((sum: number, value: number) => sum + value, 0);
  let cursor = x;
  const leafLayers: { depth: number; index: number; markup: string }[] = [];
  const hardwareLayers: { depth: number; index: number; markup: string }[] = [];
  const glassCodeLayers: string[] = [];
  const segmentDimensions: string[] = [];
  const color = '#2452d6';
  const codeClass = target === 'line' ? 'line-window-glass-code' : 'offer-glass-code';
  const glassCodes = getGlassCodes(line);
  const singleGlassCode = getUniqueGlassCode(line);
  const sliderHardware: HardwareSpec[] = isSlider ? (core.sliderHardware(allLeaves) as HardwareSpec[]) : [];
  const operableHingedLeaves = allLeaves.filter((leaf: Record<string, unknown>) => {
    const definition = core.apertureDefinition(line, leaf.apertura) as ApertureDefinition;
    return ['hinged', 'door', 'tilt-turn'].includes(definition.family);
  }).length;
  const hingeInfo = core.hingeCountFromHardware(
    line.materiales,
    line.uds ?? 0,
    operableHingedLeaves
  ) as { count: number; reason: string };

  allLeaves.forEach((leaf: Record<string, unknown>, index: number) => {
    const leafWidth = leafDrawingWidth * (leaf.width as number) / totalLeafWidth;
    const definition = core.apertureDefinition(line, leaf.apertura) as ApertureDefinition;
    const rail = leafRails[index];
    const depth = rail.number;
    const hiddenLeaf = leaf?.oculta === true || leaf?.kind === 'oculta';
    const inset = depth > 0 ? clamp(3.2 - (depth - 1) * 0.8, 1.4, 3.2) : 2.2;
    const leafGlass = hiddenLeaf ? '' : glassMarkup(
      target === 'line' ? 'line-window-glass' : 'offer-glass',
      cursor,
      y,
      leafWidth,
      drawingH,
      !noGlass
    );
    const leafMuntins = hiddenLeaf ? '' : muntinMarkup(line, cursor, y, leafWidth, drawingH, finish.frame);
    const leafGlassCode = singleGlassCode
      ? (index === 0 ? singleGlassCode : '')
      : (glassCodes[index] || '');
    const labelY = definition.family === 'projecting' ? y + 9 : Math.min(y + drawingH - 3, 140);
    const leafLabel = hiddenLeaf ? '' : glassCodeMarkup(codeClass, leafGlassCode, cursor + 3, labelY);
    if (leafLabel) glassCodeLayers.push(leafLabel);
    if (allLeaves.length > 1) segmentDimensions.push(segmentDimensionMarkup(cursor, leafWidth, y + drawingH, Number(leaf.width) || 0));

    const leafSash = glassOnly || hiddenLeaf
      ? ''
      : (!isSlider && definition.family === 'fixed')
        ? fixedGlazingMarkup(cursor, y, leafWidth, drawingH, finish)
        : sashMarkup(cursor, y, leafWidth, drawingH, finish, inset);

    let leafMark = '';
    const leafAxisY = definition.family === 'projecting'
      ? y + drawingH - 3
      : openingAxisY(line, leaf, y, drawingH, height);

    if (hiddenLeaf) leafMark = '';
    else if (definition.obLeaf === index) leafMark = doubleTiltTurnMark(index === 0 ? 'left' : 'right', cursor, y, leafWidth, drawingH, color);
    else if (leaf.kind === 'single') leafMark = hingedMark(leaf.apertura as number, cursor, y, leafWidth, drawingH, color, leafAxisY);
    else if (String(leaf.kind).startsWith?.('double-tilt-turn:')) leafMark = doubleTiltTurnMark(String(leaf.kind).endsWith('left') ? 'left' : 'right', cursor, y, leafWidth, drawingH, color);
    else if (String(leaf.kind).startsWith?.('double-hinged:')) leafMark = doubleHingedMark(String(leaf.kind).endsWith('left') ? 'left' : 'right', cursor, y, leafWidth, drawingH, color, leafAxisY);
    else leafMark = slidingMark(String(leaf.kind), cursor, y, leafWidth, drawingH, color, leafAxisY);

    let leafHardware = '';
    if (!glassOnly && !hiddenLeaf) {
      let handleSpec: HardwareSpec = sliderHardware[index] || { role: 'none' as const, reason: '' };
      if (definition.obLeaf === index) {
        handleSpec = { role: 'handle' as const, side: (index === 0 ? 'right' : 'left') as 'left' | 'right', reason: 'adene-ob-leaf' };
      } else if (!isSlider && definition.family === 'projecting') {
        handleSpec = { role: 'handle' as const, side: 'center' as const, position: 'bottom' as const, orientation: 'up' as const, reason: 'projecting-bottom' };
      } else if (!isSlider && definition.family === 'tilt') {
        handleSpec = { role: 'handle' as const, side: 'center' as const, reason: 'center-forced' };
      } else if (!isSlider && (definition.family === 'hinged' || definition.family === 'door' || definition.family === 'tilt-turn')) {
        const isDouble = String(leaf.kind).startsWith('double-');
        const leafSide = String(leaf.kind).endsWith(':left') ? 'left' : String(leaf.kind).endsWith(':right') ? 'right' : '';
        const active = !isDouble || !definition.hand || leafSide === definition.hand;
        handleSpec = active
          ? { role: 'handle' as const, side: (definition.hinge === 'right' ? 'left' : 'right') as 'left' | 'right', reason: isDouble ? 'catalog-active-leaf' : 'opposite-hinge' }
          : { role: 'striker' as const, side: (leafSide === 'left' ? 'right' : 'left') as 'left' | 'right', reason: 'catalog-passive-leaf' };
      }
      leafHardware += handleMark(handleSpec, line, leaf, cursor, y, leafWidth, drawingH, height);
      if (hingeInfo.count && ['hinged', 'door', 'tilt-turn'].includes(definition.family)) {
        const hingeSide = String(leaf.kind).startsWith('double-')
          ? (String(leaf.kind).endsWith(':left') ? 'left' : 'right')
          : definition.hinge;
        leafHardware += hingeMarkup(hingeSide || 'left', hingeInfo.count, cursor, y, leafWidth, drawingH, hingeInfo.reason, line);
      }
    }

    const divider = !isSlider && index < allLeaves.length - 1
      ? dividerMarkup(cursor + leafWidth, y + 2, y + drawingH - 2, finish)
      : '';

    const depthStyle = depth === 1
      ? 'filter:drop-shadow(1.1px 1px .65px #17212b88);'
      : depth > 1
        ? `filter:drop-shadow(-.7px .8px .5px #26313d55);opacity:${Math.max(0.9, 0.98 - (depth - 1) * 0.025)};`
        : '';

    leafLayers.push({
      depth,
      index,
      markup: hiddenLeaf
        ? `<g class="window-leaf-space" data-leaf-index="${index}" data-leaf-x="${cursor}" data-leaf-width="${leafWidth}" data-hidden-leaf="true"></g>`
        : `<g class="window-leaf-depth window-rail-${depth || 0}" data-leaf-index="${index}" data-leaf-x="${cursor}" data-leaf-width="${leafWidth}" data-rail="${depth > 0 ? `C${depth}` : ''}" data-rail-source="${escape(rail.source)}" style="${depthStyle}">${leafGlass}${leafSash}${leafMuntins}${leafMark}${divider}</g>`,
    });
    if (leafHardware) {
      hardwareLayers.push({ depth, index, markup: `<g class="window-hardware-layer" data-leaf-index="${index}">${leafHardware}</g>` });
    }
    cursor += leafWidth - (boundaryOverlaps[index] || 0);
  });

  const leavesMarkup = leafLayers
    .sort((left, right) => right.depth - left.depth || left.index - right.index)
    .map(item => item.markup)
    .join('');
  const hardwareMarkupStr = hardwareLayers
    .sort((left, right) => right.depth - left.depth || left.index - right.index)
    .map(item => item.markup)
    .join('');

  const frameClass = target === 'line' ? 'line-window-frame' : 'offer-frame';
  const frame = glassOnly ? '' : frameMarkup(frameClass, x, y, drawingW, drawingH, finish);
  const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';

  const traverses = (core.panelTraverseLines({
    raw: Array.isArray(line.geometria) ? line.geometria : [],
    width,
    height,
  }) as TraverseLine[])
    .map((item: TraverseLine) => {
      const x1 = x + drawingW * item.x1 / Math.max(1, width);
      const y1 = y + drawingH * (1 - item.y1 / Math.max(1, height));
      const x2 = x + drawingW * item.x2 / Math.max(1, width);
      const y2 = y + drawingH * (1 - item.y2 / Math.max(1, height));
      return transomMarkup(x1, y1, x2, y2, finish);
    })
    .join('');

  const splits = glassSplitMarkup(
    line as unknown as Record<string, unknown>,
    x,
    y,
    drawingW,
    drawingH,
    finish,
    allLeaves.length === 1
  );

  const apertureCodes = [...new Set(allLeaves.map((leaf: Record<string, unknown>) => number(leaf.apertura)))];
  const apertureText = apertureCodes
    .map((code: number) => `Apertura ${code} · ${(core.apertureDefinition(line, code) as ApertureDefinition).label || 'Sin nombre confirmado'}`)
    .join(' + ');

  return `<svg class="${className}${glassOnly ? ` ${target === 'line' ? 'line-window-glass-only' : 'offer-window-glass-only'}` : ''}" data-aperture-code="${escape(apertureCodes.join(','))}" data-aperture-name="${escape(core.apertureLabel(line))}" data-guide-count="${guideCount || ''}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema de ${escape(line.modelo || 'ventana')}"><title>${escape(apertureText)}</title>${frame}${leavesMarkup}${traverses}${splits}${hardwareMarkupStr}<g class="window-glass-code-layer">${glassCodeLayers.join('')}</g>${segmentDimensions.join('')}${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
}

// ─── Función principal unificada ──────────────────────────────────────────────

/**
 * Construye el SVG de una ventana a partir de una `WindowLine` normalizada.
 *
 * Detecta automáticamente si la ventana es compuesta (varios paños) o simple
 * (un solo paño con hojas), y delega al builder correspondiente.
 *
 * @param line - Línea de ventana normalizada (desde ventanaAdapter)
 * @param target - Contexto de renderizado: 'line' (cotización) o 'offer' (oferta)
 * @returns RenderResult con el SVG y metadatos
 */
export function buildWindow(
  line: WindowLine,
  target: 'line' | 'offer' = 'line'
): RenderResult {
  const composite = core.compositePanels(line) as CompositeLayout | null;

  let svg: string;
  if (composite) {
    svg = buildCompositePanel(line, composite, target);
  } else {
    svg = buildSimpleWindow(line, target);
  }

  // Extraer metadatos del SVG generado
  const apertureCodes: number[] = [];
  const apertureMatch = svg.match(/data-aperture-code="([^"]*)"/);
  if (apertureMatch) {
    apertureMatch[1].split(',').forEach((code: string) => {
      const n = parseInt(code, 10);
      if (!isNaN(n)) apertureCodes.push(n);
    });
  }

  const apertureLabelMatch = svg.match(/data-aperture-name="([^"]*)"/);
  const apertureLabel = apertureLabelMatch ? apertureLabelMatch[1] : '';

  const guideMatch = svg.match(/data-guide-count="([^"]*)"/);
  const guideCount = guideMatch ? parseInt(guideMatch[1], 10) || 0 : 0;

  const finishMatch = svg.match(/--window-finish:([^;"]*)/);
  const finishColor = finishMatch ? finishMatch[1] : '#d5d4d1';

  const glassOnly = svg.includes('window-glass-only');

  return {
    svg,
    apertureCodes,
    apertureLabel,
    guideCount,
    finishColor,
    glassOnly,
  };
}

/**
 * Versión simplificada que retorna solo el string SVG.
 * Compatible con la firma `build(line, target)` de legacyGeometrySvg.
 *
 * @deprecated Usa `buildWindow()` que retorna un `RenderResult` completo.
 */
export function build(line: WindowLine, target: 'line' | 'offer' = 'line'): string {
  return buildWindow(line, target).svg;
}