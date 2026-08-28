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

import * as core from './geometryCore';
import {
  VISUAL,
} from './colorSystem';
import {
  escape,
  clamp,
  number,
  finishFor,
  glassMarkup,
  frameMarkup,
  sashMarkup,
  fixedGlazingMarkup,
  dividerMarkup,
  transomMarkup,
  glassSplitMarkup,
  dimensionMarkup,
  segmentDimensionMarkup,
  glassCodeMarkup,
  fixedMark,
  slidingMark,
  hingedMark,
  doubleHingedMark,
  doubleTiltTurnMark,
  openingAxisY,
  handleMark,
  hingeMarkup,
  muntinMarkup,
  FRAME_THICKNESS,
  SASH_THICKNESS,
} from './windowSvgMarkup';
import type {
  WindowLine,
  RailInfo,
  HardwareSpec,
  CompositeLayout,
  CompositePanel,
  CompositeTile,
  ApertureDefinition,
  SpecialOutline,
  TraverseLine,
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
  const glassCodes = getGlassCodes(line);
  const singleGlassCode = getUniqueGlassCode(line);
  const compositeOperable = composite.panels.reduce((sum: number, panel: CompositePanel) => {
    const definition = core.apertureDefinition(line, panel.apertura) as ApertureDefinition;
    if (!['hinged', 'door', 'tilt-turn'].includes(definition.family)) return sum;
    return sum + Math.max(1, definition.leafCount === 2 ? panel.aperturaCount || 2 : 1);
  }, 0);
  const compositeHingeInfo = core.hingeCountFromHardware(
    line.materiales,
    line.uds ?? 0,
    compositeOperable
  ) as { count: number; reason: string };
  // Toda hoja que abre lleva bisagras, aunque la receta de materiales no las
  // declare (en HETMO suelen venir como accesorio de proyecto, no de línea).
  const compositeHinges = compositeHingeInfo.count > 0
    ? compositeHingeInfo
    : { count: height >= 2000 ? 3 : 2, reason: 'minimo-fisico-por-familia' };
  const scaleX = drawingW / Math.max(1, composite.width);
  const scaleY = drawingH / Math.max(1, composite.height);
  const foregroundGlassCodes: string[] = [];

  const panels = composite.tiles
    .map((tile: CompositeTile, index: number) => {
      const panel = tile.panel;
      const outerX = x + tile.x * scaleX;
      const outerY = y + tile.y * scaleY;
      const outerW = tile.width * scaleX;
      const outerH = tile.height * scaleY;
      // El marco del paño ocupa el borde del tile y todo el contenido (vidrio,
      // hojas, travesaños, herraje) va dentro de él: así los marcos de dos
      // paños vecinos quedan pegados borde con borde en vez de solaparse.
      const panelInset = glassOnly ? 0 : FRAME_THICKNESS;
      const px = outerX + panelInset;
      const py = outerY + panelInset;
      const pw = Math.max(2, outerW - panelInset * 2);
      const ph = Math.max(2, outerH - panelInset * 2);

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
      // Una ventana fija no tiene hoja: es el marco con el vidrio montado
      // directamente sobre él. El resto sí lleva su hoja dentro del marco.
      sash = glassOnly || panelDefinition.family === 'fixed'
        ? ''
        : sashMarkup(px, py, pw, ph, finish);

      // El vidrio va DENTRO de la hoja (o directamente contra el marco, si la
      // ventana es fija): la hoja es un perfil relleno, así que dibujarla
      // encima del vidrio lo taparía por completo.
      const sashInset = glassOnly ? 0 : SASH_THICKNESS;
      const glazing = (gx: number, gy: number, gw: number, gh: number, insideSash: boolean) => {
        const i = insideSash ? sashInset : 0;
        return glassMarkup(glassClass, gx + i, gy + i, Math.max(1, gw - i * 2), Math.max(1, gh - i * 2));
      };
      let panelGlazing = glazing(px, py, pw, ph, panelDefinition.family !== 'fixed');

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
        // Dos hojas en paralelo dentro del mismo marco, sin solape.
        sash = glassOnly ? '' : `${sashMarkup(px, py, pw / 2, ph, finish)}${sashMarkup(px + pw / 2, py, pw / 2, ph, finish)}`;
        panelGlazing = `${glazing(px, py, pw / 2, ph, true)}${glazing(px + pw / 2, py, pw / 2, ph, true)}`;
        if (!glassOnly) {
          const activeSide = panelDefinition.hand === 'left' ? 'left' : 'right';
          const activeX = activeSide === 'left' ? px : px + pw / 2;
          // Una practicable o abatible de dos hojas lleva UNA sola manilla: el
          // cerradero oculto de la hoja pasiva es cosa exclusiva de correderas.
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
        // La proyectante abisagra por el canto superior.
        hardwareMarkup += hingeMarkup('top', compositeHinges.count, px, py, pw, ph, compositeHinges.reason, line);
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
        // La abatible abisagra por el canto inferior.
        hardwareMarkup += hingeMarkup('bottom', compositeHinges.count, px, py, pw, ph, compositeHinges.reason, line);
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
        // Cada hoja de la corredera lleva su propio vidrio adentro.
        panelGlazing = '';
        const sliderLayers = panelLayout.map((kind: string, leafIndex: number) => {
          const leafWidth = availableWidth * panelWeights[leafIndex] / totalWeight;
          const depth = resolvedLeaves[leafIndex].carril;
          const leafSash = glassOnly ? '' : sashMarkup(leafX, py, leafWidth, ph, finish);
          const leafGlass = glazing(leafX, py, leafWidth, ph, true);
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
          const railName = depth > 0 ? `C${depth}` : '';
          const markup = `<g class="window-leaf-depth window-rail-${depth || 0}" data-leaf-index="${leafIndex}" data-leaf-x="${leafX}" data-leaf-width="${leafWidth}" data-rail="${railName}" data-rail-source="${escape(resolvedLeaves[leafIndex].carrilFuente || '')}">${leafSash}${leafGlass}${leafMark}${leafMuntins}</g>`;
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
        : segmentDimensionMarkup(outerX, outerW, y + drawingH, tile.width);

      // Cada paño de una ventana compuesta es, físicamente, un marco propio
      // unido a sus vecinos (así lo dibuja el propio HETMO) -- incluso
      // cuando el paño en sí es una corredera de varias hojas por dentro:
      // esas hojas comparten el marco de SU paño, pero el paño sigue siendo
      // su propia unidad frente a los paños de al lado.
      const panelFrame = glassOnly ? '' : frameMarkup(frameClass, outerX, outerY, outerW, outerH, finish);

      return `${panelFrame}${sash}${panelGlazing}${mark}${traverses}${splits}${panelMuntins}${panelDimension}${foregroundHardware}`;
    })
    .join('');

  const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';
  const apertureCodes = [...new Set(composite.panels.map((panel: CompositePanel) => number(panel.apertura)))];
  const apertureText = apertureCodes
    .map((code: number) => `Apertura ${code} · ${(core.apertureDefinition(line, code) as ApertureDefinition).label || 'Sin nombre confirmado'}`)
    .join(' + ');

  return `<svg class="${className}${glassOnly ? ` ${target === 'line' ? 'line-window-glass-only' : 'offer-window-glass-only'}` : ''}" data-aperture-code="${escape(apertureCodes.join(','))}" data-aperture-name="${escape(core.apertureLabel(line))}" data-guide-count="${guideCount || ''}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema compuesto de ${escape(line.modelo || 'ventana')}"><title>${escape(apertureText)}</title>${panels}<g class="window-glass-code-layer">${foregroundGlassCodes.join('')}</g>${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
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

  // ─── Ventana normal (unidades: marco + contenido) ────────────────────────
  const allLeaves = core.leavesFor(line) as Record<string, unknown>[];
  const isSlider = allLeaves.some((leaf: Record<string, unknown>) => /^(?:int|ext|fijo):?/.test(String(leaf.kind || '')));
  const leafRails = allLeaves.map((leaf: Record<string, unknown>, index: number) => {
    const definition = core.apertureDefinition(line, leaf.apertura) as ApertureDefinition;
    return core.railForLeaf(leaf, definition, index) as RailInfo;
  });

  // Cada componente HETMO (un código de apertura) es una ventana física con su
  // propio marco. Las hojas de un mismo componente comparten ese marco -- una
  // corredera de 2 hojas, una practicable de 2 hojas --, mientras que dos
  // componentes distintos en la misma línea ("ventana fija + puerta
  // practicable") son dos marcos separados unidos borde con borde. Nunca se
  // solapan entre sí: el solape sólo existe entre hojas de corredera, dentro
  // de un mismo marco.
  const units: { key: unknown; indices: number[]; width: number }[] = [];
  allLeaves.forEach((leaf: Record<string, unknown>, index: number) => {
    const key = leaf.component ?? leaf;
    const current = units[units.length - 1];
    const leafWidth = Math.max(0, Number(leaf.width) || 0);
    if (current && current.key === key) {
      current.indices.push(index);
      current.width += leafWidth;
    } else {
      units.push({ key, indices: [index], width: leafWidth });
    }
  });
  const totalUnitWidth = units.reduce((sum, unit) => sum + unit.width, 0) || 1;

  const frameClass = target === 'line' ? 'line-window-frame' : 'offer-frame';
  const glassClassName = target === 'line' ? 'line-window-glass' : 'offer-glass';
  const codeClass = target === 'line' ? 'line-window-glass-code' : 'offer-glass-code';
  const color = '#2452d6';
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
  // Toda hoja que abre lleva bisagras, aunque la receta de materiales no las
  // declare (en HETMO suelen venir como accesorio de proyecto, no de línea).
  // El conteo real manda cuando existe; si no, se dibuja el mínimo físico.
  const hinges = hingeInfo.count > 0
    ? hingeInfo
    : { count: height >= 2000 ? 3 : 2, reason: 'minimo-fisico-por-familia' };

  const hardwareLayers: string[] = [];
  const glassCodeLayers: string[] = [];
  const segmentDimensions: string[] = [];
  const profileInset = glassOnly ? 0 : FRAME_THICKNESS;

  let unitCursor = x;
  const unitsMarkup = units.map(unit => {
    const unitWidth = drawingW * unit.width / totalUnitWidth;
    const unitLeaves = unit.indices.map(index => allLeaves[index]);
    const unitDefinition = core.apertureDefinition(line, unitLeaves[0].apertura) as ApertureDefinition;
    const unitIsSlider = unitLeaves.some((leaf: Record<string, unknown>) => /^(?:int|ext|fijo):?/.test(String(leaf.kind || '')));
    const unitFrame = glassOnly ? '' : frameMarkup(frameClass, unitCursor, y, unitWidth, drawingH, finish);
    const contentX = unitCursor + profileInset;
    const contentY = y + profileInset;
    const contentW = Math.max(2, unitWidth - profileInset * 2);
    const contentH = Math.max(2, drawingH - profileInset * 2);
    const unitLeft = unitCursor;
    unitCursor += unitWidth;

    const glassCodeFor = (index: number) => (singleGlassCode
      ? (index === 0 ? singleGlassCode : '')
      : (glassCodes[index] || ''));

    // Una ventana fija no tiene hoja: es el marco con el vidrio montado
    // directamente sobre él.
    if (!unitIsSlider && unitDefinition.family === 'fixed') {
      const index = unit.indices[0];
      const label = glassCodeMarkup(codeClass, glassCodeFor(index), contentX + 3, Math.min(contentY + contentH - 3, 140));
      if (label) glassCodeLayers.push(label);
      if (units.length > 1) {
        segmentDimensions.push(segmentDimensionMarkup(unitLeft, unitWidth, y + drawingH, Number(unitLeaves[0].width) || 0));
      }
      return `<g class="window-unit window-unit-fixed" data-unit-index="${index}">`
        + unitFrame
        + glassMarkup(glassClassName, contentX, contentY, contentW, contentH, !noGlass)
        + fixedMark(contentX, contentY, contentW, contentH, color)
        + muntinMarkup(line, contentX, contentY, contentW, contentH, finish.frame)
        + `</g>`;
    }

    // Unidad con hojas. Sólo las correderas solapan una hoja sobre otra
    // (carriles distintos); practicables y abatibles van en paralelo.
    const unitLeafTotal = unitLeaves.reduce((sum, leaf) => sum + (Number(leaf.width) || 0), 0) || 1;
    const unitOverlap = unitIsSlider && unitLeaves.length > 1 ? clamp(contentW * 0.03, 3, 5) : 0;
    const boundaries = unitLeaves.slice(0, -1).map((_leaf, position) =>
      leafRails[unit.indices[position]].number !== leafRails[unit.indices[position + 1]].number ? unitOverlap : 0
    );
    const spread = contentW + boundaries.reduce((sum, value) => sum + value, 0);
    let leafCursor = contentX;
    const leafLayers: { depth: number; position: number; markup: string }[] = [];

    unitLeaves.forEach((leaf: Record<string, unknown>, position: number) => {
      const index = unit.indices[position];
      const leafWidth = spread * (Number(leaf.width) || 0) / unitLeafTotal;
      const leafX = leafCursor;
      leafCursor += leafWidth - (boundaries[position] || 0);
      const rail = leafRails[index];
      const depth = rail.number;
      const hiddenLeaf = leaf?.oculta === true || leaf?.kind === 'oculta';
      if (hiddenLeaf) {
        leafLayers.push({
          depth,
          position,
          markup: `<g class="window-leaf-space" data-leaf-index="${index}" data-leaf-x="${leafX}" data-leaf-width="${leafWidth}" data-hidden-leaf="true"></g>`,
        });
        return;
      }

      const sashInset = glassOnly ? 0 : SASH_THICKNESS;
      const paneX = leafX + sashInset;
      const paneY = contentY + sashInset;
      const paneW = Math.max(1, leafWidth - sashInset * 2);
      const paneH = Math.max(1, contentH - sashInset * 2);
      const leafSash = glassOnly ? '' : sashMarkup(leafX, contentY, leafWidth, contentH, finish);
      const leafGlass = glassMarkup(glassClassName, paneX, paneY, paneW, paneH, !noGlass);
      const leafMuntins = muntinMarkup(line, paneX, paneY, paneW, paneH, finish.frame);
      const labelY = unitDefinition.family === 'projecting' ? paneY + 9 : Math.min(paneY + paneH - 3, 140);
      const leafLabel = glassCodeMarkup(codeClass, glassCodeFor(index), paneX + 3, labelY);
      if (leafLabel) glassCodeLayers.push(leafLabel);
      if (allLeaves.length > 1) {
        segmentDimensions.push(segmentDimensionMarkup(leafX, leafWidth, y + drawingH, Number(leaf.width) || 0));
      }

      const leafAxisY = unitDefinition.family === 'projecting'
        ? contentY + contentH - 3
        : openingAxisY(line, leaf, contentY, contentH, height);
      let leafMark = '';
      if (unitDefinition.obLeaf === position) leafMark = doubleTiltTurnMark(position === 0 ? 'left' : 'right', leafX, contentY, leafWidth, contentH, color);
      else if (leaf.kind === 'single') leafMark = hingedMark(leaf.apertura as number, leafX, contentY, leafWidth, contentH, color, leafAxisY);
      else if (String(leaf.kind).startsWith?.('double-tilt-turn:')) leafMark = doubleTiltTurnMark(String(leaf.kind).endsWith('left') ? 'left' : 'right', leafX, contentY, leafWidth, contentH, color);
      else if (String(leaf.kind).startsWith?.('double-hinged:')) leafMark = doubleHingedMark(String(leaf.kind).endsWith('left') ? 'left' : 'right', leafX, contentY, leafWidth, contentH, color, leafAxisY);
      else leafMark = slidingMark(String(leaf.kind), leafX, contentY, leafWidth, contentH, color, leafAxisY);

      let leafHardware = '';
      if (!glassOnly) {
        let handleSpec: HardwareSpec = unitIsSlider
          ? (sliderHardware[index] || { role: 'none' as const, reason: '' })
          : { role: 'none' as const, reason: '' };
        if (unitDefinition.obLeaf === position) {
          handleSpec = { role: 'handle' as const, side: (position === 0 ? 'right' : 'left') as 'left' | 'right', reason: 'adene-ob-leaf' };
        } else if (!unitIsSlider && unitDefinition.family === 'projecting') {
          handleSpec = { role: 'handle' as const, side: 'center' as const, position: 'bottom' as const, orientation: 'up' as const, reason: 'projecting-bottom' };
        } else if (!unitIsSlider && unitDefinition.family === 'tilt') {
          handleSpec = { role: 'handle' as const, side: 'center' as const, reason: 'center-forced' };
        } else if (!unitIsSlider && ['hinged', 'door', 'tilt-turn'].includes(unitDefinition.family)) {
          const isDouble = String(leaf.kind).startsWith('double-');
          const leafSide = String(leaf.kind).endsWith(':left') ? 'left' : String(leaf.kind).endsWith(':right') ? 'right' : '';
          const active = !isDouble || !unitDefinition.hand || leafSide === unitDefinition.hand;
          // Una practicable o abatible de dos hojas lleva UNA sola manilla: el
          // cerradero oculto de la hoja pasiva es cosa exclusiva de correderas.
          handleSpec = active
            ? { role: 'handle' as const, side: (unitDefinition.hinge === 'right' ? 'left' : 'right') as 'left' | 'right', reason: isDouble ? 'catalog-active-leaf' : 'opposite-hinge' }
            : { role: 'none' as const, reason: 'catalog-passive-leaf' };
        }
        leafHardware += handleMark(handleSpec, line, leaf, leafX, contentY, leafWidth, contentH, height);

        // Bisagras en el canto que corresponde a la familia: vertical en
        // practicables/puertas/oscilobatientes, horizontal en proyectantes
        // (arriba) y abatibles (abajo). Las correderas no llevan.
        const hingeSide = ['hinged', 'door', 'tilt-turn'].includes(unitDefinition.family)
          ? (String(leaf.kind).startsWith('double-')
              ? (String(leaf.kind).endsWith(':left') ? 'left' : 'right')
              : (unitDefinition.hinge || 'left'))
          : unitDefinition.family === 'projecting' ? 'top'
            : unitDefinition.family === 'tilt' ? 'bottom'
              : '';
        if (!unitIsSlider && hingeSide && hinges.count) {
          leafHardware += hingeMarkup(hingeSide, hinges.count, leafX, contentY, leafWidth, contentH, hinges.reason, line);
        }
      }
      if (leafHardware) {
        hardwareLayers.push(`<g class="window-hardware-layer" data-leaf-index="${index}">${leafHardware}</g>`);
      }

      leafLayers.push({
        depth,
        position,
        markup: `<g class="window-leaf-depth window-rail-${depth || 0}" data-leaf-index="${index}" data-leaf-x="${leafX}" data-leaf-width="${leafWidth}" data-rail="${depth > 0 ? `C${depth}` : ''}" data-rail-source="${escape(rail.source)}">${leafSash}${leafGlass}${leafMuntins}${leafMark}</g>`,
      });
    });

    const leavesInUnit = leafLayers
      .sort((left, right) => right.depth - left.depth || left.position - right.position)
      .map(item => item.markup)
      .join('');
    return `<g class="window-unit" data-unit-leaves="${unit.indices.length}">${unitFrame}${leavesInUnit}</g>`;
  }).join('');

  const hardwareMarkupStr = hardwareLayers.join('');
  const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';

  // Travesaños y particiones de vidrio viven dentro del marco, no sobre él.
  const innerX = x + profileInset;
  const innerY = y + profileInset;
  const innerW = Math.max(2, drawingW - profileInset * 2);
  const innerH = Math.max(2, drawingH - profileInset * 2);

  const traverses = (core.panelTraverseLines({
    raw: Array.isArray(line.geometria) ? line.geometria : [],
    width,
    height,
  }) as TraverseLine[])
    .map((item: TraverseLine) => {
      const x1 = innerX + innerW * item.x1 / Math.max(1, width);
      const y1 = innerY + innerH * (1 - item.y1 / Math.max(1, height));
      const x2 = innerX + innerW * item.x2 / Math.max(1, width);
      const y2 = innerY + innerH * (1 - item.y2 / Math.max(1, height));
      return transomMarkup(x1, y1, x2, y2, finish);
    })
    .join('');

  const splits = glassSplitMarkup(
    line as unknown as Record<string, unknown>,
    innerX,
    innerY,
    innerW,
    innerH,
    finish,
    allLeaves.length === 1
  );

  const apertureCodes = [...new Set(allLeaves.map((leaf: Record<string, unknown>) => number(leaf.apertura)))];
  const apertureText = apertureCodes
    .map((code: number) => `Apertura ${code} · ${(core.apertureDefinition(line, code) as ApertureDefinition).label || 'Sin nombre confirmado'}`)
    .join(' + ');

  return `<svg class="${className}${glassOnly ? ` ${target === 'line' ? 'line-window-glass-only' : 'offer-window-glass-only'}` : ''}" data-aperture-code="${escape(apertureCodes.join(','))}" data-aperture-name="${escape(core.apertureLabel(line))}" data-guide-count="${guideCount || ''}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema de ${escape(line.modelo || 'ventana')}"><title>${escape(apertureText)}</title>${unitsMarkup}${traverses}${splits}${hardwareMarkupStr}<g class="window-glass-code-layer">${glassCodeLayers.join('')}</g>${segmentDimensions.join('')}${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
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