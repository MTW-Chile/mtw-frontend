// @ts-nocheck
/* Geometria comercial: interpreta componentes leidos de HETMO, sin escribir
   nunca en el origen. Conserva las marcas interior/exterior y de paño fijo.

   La lectura de la geometría HETMO (paños, hojas, aperturas, barrotillos,
   travesaños) vive en window-geometry-core.js, compartida con el generador
   de PDF de Node (mtw-api/scripts/generate_project_budget.js). Este archivo
   sólo traduce esa lectura a marcado SVG para la web: no vuelve a interpretar
   geometría por su cuenta. */
import * as core from './legacyGeometryCore';

  'use strict';

  
  
  const number = core.number;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const defaultFinishFor = line => {
    const label = [line?.acabado, line?.acabado_descripcion, line?.acabado_patron].filter(Boolean).join(' ').toLocaleLowerCase('es');
    let frame = '#d5d4d1';
    if (/nogal|madera|wood|golden\s*oak|oak|wenge|teak/.test(label)) frame = '#6e4528';
    else if (/negro|black(?:\s*mat)?|mattex?\s+kitami|kitami-dark/.test(label)) frame = '#212225';
    else if (/marron|brown|bronce/.test(label)) frame = '#6d402c';
    else if (/blanco|white/.test(label)) frame = '#f5f4ef';
    else if (/gris|gray|grau/.test(label)) frame = '#838688';
    return { frame };
  };
  export const finishFor = defaultFinishFor;
  const visual = Object.freeze({
    glass: '#d8f2f4', glassEdge: '#7595a2', opening: '#2452d6', dimension: '#40536b', glassText: '#253844'
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  // Paleta del herraje. Manillas y bisagras se piden del color del perfil, y
  // el propio articulo lo declara en su descripcion, asi que el color sale de
  // ahi (core.hardwareColor) y no de una convencion metalica inventada. Lo
  // que se conserva es el VOLUMEN: brillo a un lado y canto oscuro al otro,
  // que es lo que hace legible un herraje negro sobre un marco negro.
  const metalFor = (line, role) => {
    const finish = finishFor(line);
    const base = core.hardwareColor(line && line.materiales, finish && finish.frame, role);
    return { base, light: mixedColor(base, '#ffffff', .55), edge: mixedColor(base, '#000000', .45) };
  };
  const hexRgb = value => {
    const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(value || ''));
    return match ? match.slice(1).map(part => parseInt(part, 16)) : [101, 65, 39];
  };
  const mixedColor = (value, target, ratio) => {
    const source = hexRgb(value), destination = hexRgb(target);
    return `#${source.map((part, index) => Math.round(part + (destination[index] - part) * ratio).toString(16).padStart(2, '0')).join('')}`;
  };
  const profileColors = finish => {
    const base = String(typeof finish === 'string' ? finish : (finish?.frame || '#654127'));
    return { base, light: mixedColor(base, '#ffffff', .34), dark: mixedColor(base, '#000000', .30) };
  };
  const lineStyle = (stroke, width, extra = '') => `fill:none;stroke:${stroke};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round;${extra}`;
  const glassMarkup = (className, x, y, width, height, hasGlass = true) => `<rect class="${className}" x="${x}" y="${y}" width="${width}" height="${height}" style="fill:${hasGlass ? visual.glass : '#ffffff'};stroke:${visual.glassEdge};stroke-width:.8"/>`;
  function frameMarkup(className, x, y, width, height, finish) {
    const color = profileColors(finish), outerX = x - 4.5, outerY = y - 4.5, outerWidth = width + 9, outerHeight = height + 9;
    return `<g class="${className}"><rect x="${outerX}" y="${outerY}" width="${outerWidth}" height="${outerHeight}" rx="1" style="fill:${color.base};stroke:${color.dark};stroke-width:1"/><path d="M ${outerX + 1} ${outerY + outerHeight - 1} V ${outerY + 1} H ${outerX + outerWidth - 1}" style="${lineStyle(color.light, 1.25, 'opacity:.72')}"/><path d="M ${outerX + 1} ${outerY + outerHeight - 1} H ${outerX + outerWidth - 1} V ${outerY + 1}" style="${lineStyle(color.dark, 1.25, 'opacity:.62')}"/><rect x="${x - .7}" y="${y - .7}" width="${width + 1.4}" height="${height + 1.4}" rx=".7" style="fill:none;stroke:${color.dark};stroke-width:.7;opacity:.66"/><path d="M ${x} ${y + height} V ${y} H ${x + width}" style="${lineStyle(color.light, .55, 'opacity:.55')}"/></g>`;
  }
  function sashMarkup(x, y, width, height, finish, inset = 2.2) {
    const color = profileColors(finish), sx = x + inset, sy = y + inset, sw = Math.max(2, width - inset * 2), sh = Math.max(2, height - inset * 2);
    const weight = clamp(Math.min(width, height) * .03, 1.8, 2.8);
    const beadInset = Math.max(1.4, weight * .8);
    const innerX = sx + beadInset, innerY = sy + beadInset;
    const innerW = Math.max(1, sw - beadInset * 2), innerH = Math.max(1, sh - beadInset * 2);
    // La hoja es una pieza montada DELANTE del marco. Conserva exactamente el
    // mismo acabado, pero su sombra inferior/derecha y su luz superior/izquierda
    // forman un escalón 2D. Así se distingue sin inventar una franja blanca ni
    // cambiar anchos, carriles o solapes.
    return `<g class="window-sash" data-profile-layer="raised">`
      + `<rect class="window-sash-profile" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx=".65" style="fill:none;stroke:${color.base};stroke-width:${weight}"/>`
      + `<path class="window-sash-highlight" d="M ${sx + .45} ${sy + sh - .45} V ${sy + .45} H ${sx + sw - .45}" style="${lineStyle(color.light, .9, 'opacity:.82')}"/>`
      + `<path class="window-sash-shade" d="M ${sx + .45} ${sy + sh - .45} H ${sx + sw - .45} V ${sy + .45}" style="${lineStyle(color.dark, .9, 'opacity:.72')}"/>`
      + `<rect class="window-glazing-bead" x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" rx=".2" style="fill:none;stroke:${color.dark};stroke-width:.42;opacity:.72"/>`
      + `<path class="window-sash-miters" d="M ${sx} ${sy} L ${innerX} ${innerY} M ${sx + sw} ${sy} L ${innerX + innerW} ${innerY} M ${sx} ${sy + sh} L ${innerX} ${innerY + innerH} M ${sx + sw} ${sy + sh} L ${innerX + innerW} ${innerY + innerH}" style="${lineStyle(color.dark, .34, 'opacity:.42')}"/>`
      + `</g>`;
  }
  function fixedGlazingMarkup(x, y, width, height, finish, inset = 1.45) {
    const color = profileColors(finish), bx = x + inset, by = y + inset;
    const bw = Math.max(1, width - inset * 2), bh = Math.max(1, height - inset * 2);
    // Un fijo verdadero no tiene hoja: sólo marco, vidrio y junquillo. Esta
    // línea fina evita que se confunda con una hoja elevada. Un fijo dentro de
    // una CORREDERA sí sigue usando sashMarkup porque físicamente es una hoja.
    return `<g class="window-fixed-glazing" data-profile-layer="frame-glazing">`
      + `<rect class="window-glazing-bead" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx=".15" style="fill:none;stroke:${color.dark};stroke-width:.48;opacity:.68"/>`
      + `<path d="M ${bx + .35} ${by + bh - .35} V ${by + .35} H ${bx + bw - .35}" style="${lineStyle(color.light, .35, 'opacity:.52')}"/>`
      + `</g>`;
  }
  function dividerMarkup(x, y1, y2, finish, width = 2.2) {
    const color = profileColors(finish);
    return `<g class="window-sash-divider"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" style="${lineStyle(color.base, width)}"/><line x1="${x - .55}" y1="${y1}" x2="${x - .55}" y2="${y2}" style="${lineStyle(color.light, .55, 'opacity:.65')}"/><line x1="${x + .55}" y1="${y1}" x2="${x + .55}" y2="${y2}" style="${lineStyle(color.dark, .55, 'opacity:.5')}"/></g>`;
  }
  function transomMarkup(x1, y1, x2, y2, finish) {
    const color = profileColors(finish);
    return `<g class="window-transom"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="${lineStyle(color.base, 2.8)}"/></g>`;
  }
  // Travesaños deducidos de la partición del vidrio (core.panelGlassSplits),
  // que es como HETMO modela la barra horizontal de las puertas: no declara
  // bh_* sino dos vidrios dentro de la misma hoja. Los cortes horizontales se
  // trazan de lado a lado, porque cuando una puerta de dos hojas parte su
  // vidrio lo hace a la misma altura en ambas. Los verticales sólo se dibujan
  // si la ventana tiene una sola hoja: entre hojas ya existe el divisor de la
  // corredera y volver a trazarlo duplicaría el perfil.
  function glassSplitMarkup(source, x, y, width, height, finish, singleLeaf) {
    const seen = new Set();
    return core.panelGlassSplits(source).map(split => {
      if (split.axis === 'vertical' && !singleLeaf) return '';
      const key = `${split.axis}|${split.at.toFixed(3)}`;
      if (seen.has(key)) return '';
      seen.add(key);
      return split.axis === 'horizontal'
        ? transomMarkup(x, y + height * split.at, x + width, y + height * split.at, finish)
        : transomMarkup(x + width * split.at, y, x + width * split.at, y + height, finish);
    }).join('');
  }
  const dimensionMarkup = (width, height, x, y, drawingW, drawingH) => `<text class="window-dimension" x="${x + drawingW / 2}" y="${y + drawingH + 29}" text-anchor="middle" style="font:700 9px system-ui,sans-serif;fill:${visual.dimension}">${Math.round(width).toLocaleString('es-CL')} mm</text><text class="window-dimension" x="${x - 17}" y="${y + drawingH / 2}" text-anchor="middle" transform="rotate(-90 ${x - 17} ${y + drawingH / 2})" style="font:700 9px system-ui,sans-serif;fill:${visual.dimension}">${Math.round(height).toLocaleString('es-CL')} mm</text>`;
  const segmentDimensionMarkup = (x, width, drawingBottom, value) => {
    const lineY = drawingBottom + 7, tickTop = drawingBottom + 4, tickBottom = drawingBottom + 10;
    return `<g class="window-segment-dimension"><path d="M ${x} ${tickTop} V ${tickBottom} M ${x} ${lineY} H ${x + width} M ${x + width} ${tickTop} V ${tickBottom}" style="${lineStyle(visual.dimension, .45, 'opacity:.78')}"/><text x="${x + width / 2}" y="${drawingBottom + 17}" text-anchor="middle" style="font:600 6.3px system-ui,sans-serif;fill:${visual.dimension}">${Math.round(value).toLocaleString('es-CL')}</text></g>`;
  };
  const glassCodeMarkup = (className, value, x, y) => value ? `<text class="${className}" x="${x}" y="${y}" style="font:700 6.4px system-ui,sans-serif;fill:${visual.glassText};paint-order:stroke;stroke:#f6fbfc;stroke-width:1.7px;stroke-linejoin:round">${escape(value)}</text>` : '';

  function fixedMark(x, y, width, height, color) {
    const cx = x + width / 2, cy = y + height / 2, size = Math.min(5, Math.max(2.5, Math.min(width, height) * .08));
    return `<path d="M ${cx - size} ${cy} H ${cx + size} M ${cx} ${cy - size} V ${cy + size}" style="${lineStyle(color, 1.1)}"/>`;
  }

  // El rotulo de carril (Int./Ext.) se omite a proposito. La direccion de la
  // flecha si esta confirmada contra fichas reales, pero a que riel
  // corresponde cada hoja se derivaba del codigo de apertura asumiendo una
  // convencion que no resulto universal: en Portal Las Pataguas salia
  // invertido incluso con el fijo/movil correcto. Preferimos no rotular a
  // rotular mal; cuando exista un dato HETMO que declare el riel se vuelve a
  // mostrar. El layout conserva ext/int internamente para el orden de hojas.
  function slidingMark(kind, x, y, width, height, color, axisY = y + height / 2) {
    if (kind === 'fijo') return fixedMark(x, y, width, height, color);
    if (kind.endsWith(':both')) {
      const mid = axisY, inset = Math.min(9, Math.max(4, width * .16));
      const left = x + inset, right = x + width - inset;
      return `<path d="M ${left} ${mid} H ${right} M ${left} ${mid} l 4 -3 M ${left} ${mid} l 4 3 M ${right} ${mid} l -4 -3 M ${right} ${mid} l -4 3" style="${lineStyle(color, 1.15)}"/>`;
    }
    const direction = kind.endsWith(':right') ? 'right' : 'left';
    const mid = axisY, inset = Math.min(9, Math.max(4, width * .16));
    const from = direction === 'right' ? x + inset : x + width - inset;
    const to = direction === 'right' ? x + width - inset : x + inset;
    const head = direction === 'right' ? -1 : 1;
    return `<path d="M ${from} ${mid} H ${to} M ${to} ${mid} l ${head * 4} -3 M ${to} ${mid} l ${head * 4} 3" style="${lineStyle(color, 1.15)}"/>`;
  }

  function hingedMark(type, x, y, width, height, color, axisY = y + height / 2) {
    const sharedDefinition = core.apertureDefinition(null, type);
    const sharedSegments = core.openingSymbolSegments(null, type);
    if (sharedSegments.length) {
      const paths = sharedSegments.map(segment => {
        const alignsWithHandle = ['hinged', 'projecting', 'tilt'].includes(sharedDefinition.symbol);
        const d = segment.points.map(([px, py], index) => {
          const pointY = alignsWithHandle && index === 1 ? axisY : y + height * py;
          return `${index ? 'L' : 'M'} ${x + width * px} ${pointY}`;
        }).join(' ');
        const axis = alignsWithHandle ? ` data-axis-y="${axisY}"` : '';
        return `<path data-opening-role="${segment.role}" data-opening-face="${segment.face || ''}"${axis} d="${d}" style="${lineStyle(color, segment.role === 'tilt' ? 1.05 : 1.2, segment.dashed ? 'stroke-dasharray:3 2' : '')}"/>`;
      }).join('');
      const face = sharedDefinition.face === 'interior' ? 'Int.' : sharedDefinition.face === 'exterior' ? 'Ext.' : '';
      return `${paths}${face ? `<text x="${x + width / 2}" y="${y + 9}" text-anchor="middle" style="font:700 6px system-ui,sans-serif;fill:${color}">${face}</text>` : ''}`;
    }
    return fixedMark(x, y, width, height, color);
  }

  function doubleHingedMark(side, x, y, width, height, color, axisY = y + height / 2) {
    const edge = side === 'left' ? x + 4 : x + width - 4;
    const centre = side === 'left' ? x + width - 4 : x + 4;
    return `<path data-opening-role="turn" data-axis-y="${axisY}" d="M ${edge} ${y + 4} L ${centre} ${axisY} L ${edge} ${y + height - 4}" style="${lineStyle(color, 1.2)}"/>`;
  }

  function doubleTiltTurnMark(side, x, y, width, height, color) {
    return `${doubleHingedMark(side, x, y, width, height, color)}<path data-opening-role="tilt" data-opening-face="interior" d="M ${x + 4} ${y + height - 4} L ${x + width / 2} ${y + 4} L ${x + width - 4} ${y + height - 4}" style="${lineStyle(color, 1.05)}"/>`;
  }

  function openingAxisY(line, leaf, y, height, physicalHeight) {
    const heightInfo = core.handleHeightFor(line, leaf, physicalHeight);
    return y + height - height * heightInfo.millimeters / Math.max(1, physicalHeight);
  }

  function handleMark(spec, line, leaf, x, y, width, height, physicalHeight) {
    if (!spec || spec.role === 'none') return '';
    const metal = metalFor(line, 'handle');
    const heightInfo = core.handleHeightFor(line, leaf, physicalHeight);
    const hy = spec.position === 'bottom' ? y + height - 3
      : spec.position === 'top' ? y + 3
        : openingAxisY(line, leaf, y, height, physicalHeight);
    const side = spec.side === 'left' ? 'left' : spec.side === 'right' ? 'right' : 'center';
    // La placa nace sobre el perfil de la hoja. La palanca puede entrar al
    // vidrio, pero su eje no queda flotando dentro del paño acristalado.
    const hx = side === 'left' ? x + 3.5 : side === 'right' ? x + width - 3.5 : x + width / 2;
    if (spec.role === 'striker') {
      return `<g class="window-striker" data-reason="${escape(spec.reason)}">`
        + `<rect x="${hx - 1.3}" y="${hy - 7}" width="2.6" height="14" rx=".9" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
        + `<line x1="${hx - .75}" y1="${hy - 6}" x2="${hx - .75}" y2="${hy + 6}" style="${lineStyle(metal.light, .55, 'opacity:.8')}"/>`
        + `<rect x="${hx - 2.6}" y="${hy - 2.6}" width="5.2" height="5.2" rx=".9" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
        + `</g>`;
    }
    const leverX = side === 'left' ? hx + 8 : side === 'right' ? hx - 8 : hx;
    const leverY = spec.orientation === 'up' ? hy - 9 : spec.position === 'top' ? hy + 9 : hy;
    const lever = side === 'center' ? `M ${hx} ${hy} L ${leverX} ${leverY}` : `M ${hx} ${hy} H ${leverX}`;
    // El brillo corre paralelo a la palanca, desplazado hacia el lado
    // iluminado: es lo que la separa del perfil cuando el acabado es oscuro.
    const glare = side === 'center'
      ? `M ${hx - .7} ${hy} L ${leverX - .7} ${leverY}`
      : `M ${hx} ${hy - .75} H ${leverX}`;
    const heightSource = spec.position ? `${spec.position}-by-opening` : heightInfo.reason;
    return `<g class="window-handle" data-axis-y="${hy}" data-height-source="${heightSource}" data-reason="${escape(spec.reason || 'opening-leaf')}">`
      + `<circle cx="${hx}" cy="${hy}" r="2.4" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
      + `<circle cx="${hx - .6}" cy="${hy - .6}" r="1" style="fill:${metal.light};opacity:.8"/>`
      + `<path d="${lever}" style="${lineStyle(metal.base, 3, `stroke:${metal.base}`)}"/>`
      + `<path d="${lever}" style="${lineStyle(metal.edge, 3.6, 'opacity:.35')}"/>`
      + `<path d="${lever}" style="${lineStyle(metal.base, 2.8)}"/>`
      + `<path d="${glare}" style="${lineStyle(metal.light, .8, 'opacity:.85')}"/>`
      + `</g>`;
  }

  // La bisagra es un nudillo, no un trazo: cilindro metalico con brillo a un
  // lado y sombra al otro. Antes era una linea de .75 de grosor y 4,4 de
  // largo, que sobre un perfil oscuro no se distinguia del propio marco.
  function hingeMarkup(side, count, x, y, width, height, reason, line) {
    if (!count || (side !== 'left' && side !== 'right')) return '';
    const metal = metalFor(line, 'hinge');
    const hx = side === 'left' ? x + 2.2 : x + width - 2.2;
    const barrel = clamp(height * .07, 5, 9), thickness = 2.6;
    return Array.from({ length: count }, (_, index) => {
      const hy = y + height * (index + 1) / (count + 1);
      const top = hy - barrel / 2;
      return `<g class="window-hinge" data-reason="${escape(reason)}">`
        + `<rect x="${hx - thickness / 2}" y="${top}" width="${thickness}" height="${barrel}" rx="${thickness / 2}" style="fill:${metal.base};stroke:${metal.edge};stroke-width:.45"/>`
        + `<line x1="${hx - thickness / 2 + .55}" y1="${top + .8}" x2="${hx - thickness / 2 + .55}" y2="${top + barrel - .8}" style="${lineStyle(metal.light, .6, 'opacity:.85')}"/>`
        + `</g>`;
    }).join('');
  }

  function glassPaneCount(line) {
    const explicit = number(line?.cantidad_vidrios_por_unidad ?? line?.dibujo_cantidad_vidrios);
    if (explicit > 0) return Math.round(explicit);
    const source = typeof state !== 'undefined' && Array.isArray(state?.project?.instantanea?.vidrios)
      ? state.project.instantanea.vidrios : [];
    const lineId = String(line?.linea_hetmo ?? '').trim();
    const model = String(line?.modelo ?? '').trim();
    const matching = source.filter(item => lineId
      ? String(item?.linea_hetmo ?? '').trim() === lineId
      : String(item?.linea_modelo ?? '').trim() === model);
    if (!matching.length) return 0;
    const lineUnits = Math.max(1, number(line?.uds ?? line?.cantidad));
    const totalGlassUnits = matching.reduce((sum, item) => sum + number(item?.UDS ?? item?.cantidad), 0);
    return Math.max(1, Math.round(totalGlassUnits / lineUnits));
  }

  // Convierte las líneas de barrotillos del núcleo compartido (en el espacio
  // propio del paño) a trazos SVG en el lienzo de dibujo.
  function muntinMarkup(line, x, y, width, height, color) {
    const lines = core.muntinLines(line, width, height);
    const stroke = profileColors(color).dark;
    return lines.map(item => `<line x1="${x + item.x1}" y1="${y + Math.max(2, item.y1)}" x2="${x + item.x2}" y2="${y + item.y2}" style="${lineStyle(stroke, 1.1)}"/>`).join('');
  }

  function buildComposite(line, target, composite) {
    const width = Math.max(1, number(line?.dibujo_ancho ?? line?.ancho) || 1);
    const height = Math.max(1, number(line?.dibujo_alto ?? line?.alto) || 1);
    const maxWidth = 180, maxHeight = 116;
    const scale = Math.min(maxWidth / width, maxHeight / height);
    const drawingW = Math.max(14, width * scale), drawingH = Math.max(14, height * scale);
    const x = 30 + (180 - drawingW) / 2, y = 8 + (116 - drawingH) / 2;
    const finish = finishFor(line), glassOnly = Boolean(line?.dibujo_sin_marco);
    const guideCount = core.sliderGuideCount({ linea: line, materiales: line?.materiales });
    const frameClass = target === 'line' ? 'line-window-frame' : 'offer-frame';
    const glassClass = target === 'line' ? 'line-window-glass' : 'offer-glass';
    const codeClass = target === 'line' ? 'line-window-glass-code' : 'offer-glass-code';
    const frame = glassOnly ? '' : frameMarkup(frameClass, x, y, drawingW, drawingH, finish);
    const sqlGlassCodes = core.renderGlassRows(line).map(item => String(item?.codigo_componente || '').trim()).filter(Boolean);
    const glassCodes = Array.isArray(line?.dibujo_vidrios) && line.dibujo_vidrios.length
      ? line.dibujo_vidrios.map(value => String(value || '').trim()).filter(Boolean)
      : sqlGlassCodes.length ? sqlGlassCodes
        : String(line?.dibujo_vidrio ?? line?.vidrio_codigo ?? '').split(/\s+(?:y|\+)\s+/i).map(value => value.trim()).filter(Boolean);
    const uniqueGlassCodes = [...new Set(glassCodes.filter(Boolean))];
    const singleGlassCode = uniqueGlassCodes.length === 1 ? uniqueGlassCodes[0] : '';
    const compositeOperable = composite.panels.reduce((sum, panel) => {
      const definition = core.apertureDefinition(line, panel.apertura);
      if (!['hinged', 'door', 'tilt-turn'].includes(definition.family)) return sum;
      return sum + Math.max(1, definition.leafCount === 2 ? panel.aperturaCount || 2 : 1);
    }, 0);
    const compositeHinges = core.hingeCountFromHardware(line?.materiales, line?.uds ?? line?.UDS, compositeOperable);
    const scaleX = drawingW / Math.max(1, composite.width), scaleY = drawingH / Math.max(1, composite.height);
    // Las etiquetas se emiten después de todos los paños. En una ventana
    // unida, el marco/hoja del paño siguiente no puede volver a taparlas.
    const foregroundGlassCodes = [];
    const panels = composite.tiles.map((tile, index) => {
      const panel = tile.panel;
      const px = x + tile.x * scaleX, py = y + tile.y * scaleY;
      const pw = tile.width * scaleX, ph = tile.height * scaleY;
      const inset = 2.2;
      // Misma resolución de hojas que usa la línea simple (core.slidingPieces):
      // decide paño fijo contra móvil con el N1/N2 de la fila de apertura de
      // ESTE paño. Antes esta rama leía sliderLayouts crudo del catálogo y se
      // saltaba esa detección por completo, así que las ventanas compuestas
      // ignoraban el fijo que HETMO declaraba.
      const panelPieces = core.slidingPieces({
        apertura: panel.apertura, raw: panel.raw, width: panel.width,
        movilLado: panel.movilLado, movilAncho: panel.movilAncho,
        materiales: Array.isArray(line?.materiales) ? line.materiales : null,
        unidades: number(line?.uds ?? line?.UDS),
        linea: line
      });
      const panelLayout = panelPieces
        ? panelPieces.map(piece => piece.kind)
        : core.sliderLayouts[panel.apertura];
      const panelWeights = panelLayout
        ? (panelPieces
          ? panelPieces.map(piece => Math.max(0, Number(piece.width) || 0))
          : (core.sliderWeights[panel.apertura] || panelLayout.map(() => 1 / panelLayout.length)).slice())
        : null;
      const exactLeaves = !panelPieces && panelLayout ? core.exactPanelLeaves(panel, panelLayout.length) : null;
      if (panelLayout && exactLeaves) {
        panelWeights.splice(0, panelWeights.length, ...exactLeaves.map(item => Math.max(0, Number(item.ancho ?? item.ancho_mm) || 0)));
      }
      let sash = '';
      // HETMO puede dejar dos hojas abatibles (código 17/18/21) dentro del
      // mismo paño de una ventana compuesta, registradas como dos filas de
      // apertura (ver panel.aperturaCount en window-geometry-core.js). Sin
      // esto se dibujaba una sola marca abarcando todo el paño, ocultando
      // que en realidad son dos puertas independientes.
      const panelDefinition = core.apertureDefinition(line, panel.apertura);
      sash = glassOnly ? '' : panelDefinition.family === 'fixed'
        ? fixedGlazingMarkup(px, py, pw, ph, finish)
        : sashMarkup(px, py, pw, ph, finish, inset);
      const panelAxisY = panelDefinition?.family === 'projecting' ? py + ph - 3 : openingAxisY(line, { component: panel }, py, ph, panel.height);
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
          hardwareMarkup += handleMark({ role: 'handle', side: activeSide === 'left' ? 'right' : 'left', reason: 'catalog-active-leaf' }, line, { component: panel }, activeX, py, pw / 2, ph, panel.height);
          hardwareMarkup += handleMark({ role: 'striker', side: activeSide === 'left' ? 'left' : 'right', reason: 'catalog-passive-leaf' }, line, { component: panel }, passiveX, py, pw / 2, ph, panel.height);
          if (compositeHinges.count && ['hinged', 'door', 'tilt-turn'].includes(panelDefinition.family)) {
            hardwareMarkup += hingeMarkup('left', compositeHinges.count, px, py, pw / 2, ph, compositeHinges.reason, line);
            hardwareMarkup += hingeMarkup('right', compositeHinges.count, px + pw / 2, py, pw / 2, ph, compositeHinges.reason, line);
          }
        }
      } else if (!glassOnly && (panelDefinition.family === 'hinged' || panelDefinition.family === 'door' || panelDefinition.family === 'tilt-turn')) {
        hardwareMarkup += handleMark({ role: 'handle', side: panelDefinition.hinge === 'right' ? 'left' : 'right', reason: 'opposite-hinge' }, line, { component: panel }, px, py, pw, ph, panel.height);
        if (compositeHinges.count && ['hinged', 'door', 'tilt-turn'].includes(panelDefinition.family)) hardwareMarkup += hingeMarkup(panelDefinition.hinge, compositeHinges.count, px, py, pw, ph, compositeHinges.reason, line);
      } else if (!glassOnly && panelDefinition.family === 'projecting') {
        hardwareMarkup += handleMark({ role: 'handle', side: 'center', position: 'bottom', orientation: 'up', reason: 'projecting-bottom' }, line, { component: panel }, px, py, pw, ph, panel.height);
      } else if (!glassOnly && panelDefinition.family === 'tilt') {
        hardwareMarkup += handleMark({ role: 'handle', side: 'center', reason: 'center-forced' }, line, { component: panel }, px, py, pw, ph, panel.height);
      }
      const panelGlass = glassCodes[index] || (glassCodes.length === 1 ? glassCodes[0] : '');
      let foregroundHardware = hardwareMarkup;
      if (panelLayout) {
        const totalWeight = panelWeights.reduce((sum, value) => sum + value, 0) || 1;
        const resolvedLeaves = panelLayout.map((kind, leafIndex) => {
          const piece = panelPieces?.[leafIndex] || exactLeaves?.[leafIndex] || {};
          const leaf = { ...piece, kind, width: panelWeights[leafIndex], apertura: panel.apertura, component: panel };
          const rail = core.railForLeaf(leaf, panelDefinition, leafIndex);
          return { ...leaf, carril: rail.number, carrilFuente: rail.source };
        });
        const overlap = clamp(pw * .035, 2.6, 4.6);
        const boundaryOverlaps = resolvedLeaves.slice(0, -1).map((leaf, leafIndex) => leaf.carril !== resolvedLeaves[leafIndex + 1].carril ? overlap : 0);
        const availableWidth = pw + boundaryOverlaps.reduce((sum, value) => sum + value, 0);
        let leafX = px;
        const sliderHardware = core.sliderHardware(resolvedLeaves);
        sash = '';
        const sliderLayers = panelLayout.map((kind, leafIndex) => {
          const leafWidth = availableWidth * panelWeights[leafIndex] / totalWeight;
          const depth = resolvedLeaves[leafIndex].carril;
          const leafInset = depth > 0 ? clamp(3.2 - (depth - 1) * .8, 1.4, 3.2) : 2.2;
          const leafSash = glassOnly ? '' : sashMarkup(leafX, py, leafWidth, ph, finish, leafInset);
          const leafAxisY = openingAxisY(line, resolvedLeaves[leafIndex], py, ph, panel.height);
          const leafMark = slidingMark(kind, leafX, py, leafWidth, ph, '#2452d6', leafAxisY);
          const leafHandle = glassOnly ? '' : handleMark(sliderHardware[leafIndex], line, resolvedLeaves[leafIndex], leafX, py, leafWidth, ph, panel.height);
          foregroundHardware += leafHandle;
          const visibleGlassCode = leafIndex === 0 && (!singleGlassCode || index === 0) ? panelGlass : '';
          const leafCode = glassCodeMarkup(codeClass, visibleGlassCode, leafX + 3, Math.min(py + ph - 3, 140));
          if (leafCode) foregroundGlassCodes.push(leafCode);
          const leafMuntins = muntinMarkup(line, leafX, py, leafWidth, ph, finish.frame);
          const depthStyle = depth === 1 ? 'filter:drop-shadow(1.2px 1px .7px #26344555)' : depth > 1 ? `opacity:${Math.max(.9, .98 - (depth - 1) * .025)}` : '';
          const railName = depth > 0 ? `C${depth}` : '';
          const markup = `<g class="window-leaf-depth window-rail-${depth || 0}" data-leaf-index="${leafIndex}" data-leaf-x="${leafX}" data-leaf-width="${leafWidth}" data-rail="${railName}" data-rail-source="${escape(resolvedLeaves[leafIndex].carrilFuente)}" style="${depthStyle}">${leafSash}${leafMark}${leafMuntins}</g>`;
          leafX += leafWidth - (boundaryOverlaps[leafIndex] || 0);
          return { depth, index: leafIndex, markup };
        });
        mark = sliderLayers.sort((left, right) => right.depth - left.depth || left.index - right.index).map(item => item.markup).join('');
      } else if (!panel.apertura && composite.verticalCuts?.length > 1 && composite.direction === 'vertical') {
        let fixedX = px;
        const cutWidths = [...composite.verticalCuts, composite.width].map((cut, cutIndex, values) => cut - (cutIndex ? values[cutIndex - 1] : 0));
        const fixedTotal = cutWidths.reduce((sum, value) => sum + value, 0) || 1;
        sash = '';
        mark = cutWidths.map((cutWidth, fixedIndex) => {
          const fixedWidth = pw * cutWidth / fixedTotal;
          const fixedSash = glassOnly ? '' : fixedGlazingMarkup(fixedX, py, fixedWidth, ph, finish);
          const fixedIndicator = fixedMark(fixedX, py, fixedWidth, ph, '#2452d6');
          const fixedDivider = fixedIndex < cutWidths.length - 1 ? dividerMarkup(fixedX + fixedWidth, py + 2, py + ph - 2, finish, 2.5) : '';
          fixedX += fixedWidth;
          return `${fixedSash}${fixedIndicator}${fixedDivider}`;
        }).join('');
      }
      const traverses = core.panelTraverseLines(panel).map(item => {
        const x1 = px + pw * item.x1 / Math.max(1, panel.width);
        // Las cotas BH de HETMO crecen desde el borde inferior. SVG crece
        // desde arriba, por lo que el eje vertical debe invertirse.
        const y1 = py + ph * (1 - item.y1 / Math.max(1, panel.height));
        const x2 = px + pw * item.x2 / Math.max(1, panel.width);
        const y2 = py + ph * (1 - item.y2 / Math.max(1, panel.height));
        return transomMarkup(x1, y1, x2, y2, finish.frame);
      }).join('');
      const splits = glassSplitMarkup(panel, px, py, pw, ph, finish.frame, !panelLayout && !isDoubleOpening);
      const visiblePanelGlass = !singleGlassCode || index === 0 ? panelGlass : '';
      const panelCodeY = panelDefinition.family === 'projecting' ? py + 9 : Math.min(py + ph - 3, 140);
      const code = panelLayout ? '' : glassCodeMarkup(codeClass, visiblePanelGlass, px + 3, panelCodeY);
      if (code) foregroundGlassCodes.push(code);
      const panelMuntins = panelLayout ? '' : muntinMarkup(line, px, py, pw, ph, finish.frame);
      const panelDimension = composite.direction === 'vertical' ? '' : segmentDimensionMarkup(px, pw, y + drawingH, tile.width);
      // El herraje es la capa frontal: un travesano puede coincidir con la
      // cota de manilla (P6), pero nunca debe taparla.
      return `${glassMarkup(glassClass, px, py, pw, ph)}${sash}${mark}${traverses}${splits}${panelMuntins}${panelDimension}${foregroundHardware}`;
    }).join('');
    const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';
    const apertureCodes = [...new Set(composite.panels.map(panel => number(panel.apertura)))];
    const apertureText = apertureCodes.map(code => `Apertura ${code} · ${core.apertureDefinition(line, code).label || 'Sin nombre confirmado'}`).join(' + ');
    return `<svg class="${className}${glassOnly ? ` ${target === 'line' ? 'line-window-glass-only' : 'offer-window-glass-only'}` : ''}" data-aperture-code="${escape(apertureCodes.join(','))}" data-aperture-name="${escape(core.apertureLabel(line))}" data-guide-count="${guideCount || ''}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 240 178" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema compuesto de ${escape(line?.modelo || 'ventana')}"><title>${escape(apertureText)}</title>${frame}${panels}<g class="window-glass-code-layer">${foregroundGlassCodes.join('')}</g>${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
  }

  function build(line, target) {
    const composite = core.compositePanels(line);
    if (composite) return buildComposite(line, target, composite);
    const width = Math.max(1, number(line?.dibujo_ancho ?? line?.ancho) || 1);
    const height = Math.max(1, number(line?.dibujo_alto ?? line?.alto) || 1);
    // El lienzo reserva una franja real para ambas cotas: nunca quedan sobre
    // el vidrio aunque la ventana sea muy alta o muy ancha.
    const maxWidth = 180, maxHeight = 116;
    const scale = Math.min(maxWidth / width, maxHeight / height);
    const drawingW = Math.max(14, width * scale), drawingH = Math.max(14, height * scale);
    const x = 30 + (180 - drawingW) / 2, y = 8 + (116 - drawingH) / 2;
    const finish = finishFor(line), glassOnly = Boolean(line?.dibujo_sin_marco);
    const guideCount = core.sliderGuideCount({ linea: line, materiales: line?.materiales });
    const noGlass = core.isWithoutGlass(line), outline = core.specialOutline(line);
    if (outline) {
      const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';
      const glassClass = target === 'line' ? 'line-window-glass' : 'offer-glass';
      const shape = outline.kind === 'circle'
        ? `<ellipse${noGlass ? '' : ` class="${glassClass}"`} cx="${x + drawingW / 2}" cy="${y + drawingH / 2}" rx="${drawingW / 2}" ry="${drawingH / 2}" style="fill:${noGlass ? '#fff' : visual.glass};stroke:${glassOnly ? visual.glassEdge : finish.frame};stroke-width:${glassOnly ? 1.2 : 5}"/>`
        : (() => {
          const points = outline.points.map(([px, py]) => `${x + drawingW * px / outline.width},${y + drawingH * py / outline.height}`).join(' ');
          return `<polygon${noGlass ? '' : ` class="${glassClass}"`} points="${points}" style="fill:${noGlass ? '#fff' : visual.glass};stroke:${glassOnly ? visual.glassEdge : finish.frame};stroke-width:${glassOnly ? 1.2 : 5};stroke-linejoin:round"/>`;
        })();
      // SINxx puede transportar la forma de un hueco especial, pero no
      // describe un vidrio ni una hoja. Se conserva solo la geometria.
      const mark = noGlass ? '' : fixedMark(x, y, drawingW, drawingH, '#2452d6');
      const specialCode = number(line?.tipo_apertura ?? line?.dibujo_tipo_apertura);
      const specialName = core.apertureDefinition(line, specialCode).label || core.apertureLabel(line);
      return `<svg class="${className}" data-aperture-code="${specialCode || ''}" data-aperture-name="${escape(specialName)}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 240 178" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Geometria especial de ${escape(line?.modelo || 'ventana')}"><title>${escape(`Apertura ${specialCode || 0} · ${specialName}`)}</title>${shape}${mark}${muntinMarkup(line, x, y, drawingW, drawingH, finish.frame)}${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
    }
    const allLeaves = core.leavesFor(line), totalLeafWidth = allLeaves.reduce((sum, leaf) => sum + leaf.width, 0) || width;
    const isSlider = allLeaves.some(leaf => /^(?:int|ext|fijo):?/.test(String(leaf.kind || '')));
    const leafRails = allLeaves.map((leaf, index) => {
      const definition = core.apertureDefinition(line, leaf.apertura);
      return core.railForLeaf(leaf, definition, index);
    });
    const overlap = isSlider && allLeaves.length > 1 ? clamp(drawingW * .03, 3, 5) : 0;
    const boundaryOverlaps = allLeaves.slice(0, -1).map((leaf, index) => leafRails[index].number !== leafRails[index + 1].number ? overlap : 0);
    const leafDrawingWidth = drawingW + boundaryOverlaps.reduce((sum, value) => sum + value, 0);
    let cursor = x;
    const leafLayers = [], hardwareLayers = [], glassCodeLayers = [], segmentDimensions = [], color = '#2452d6';
    const codeClass = target === 'line' ? 'line-window-glass-code' : 'offer-glass-code';
    const sqlGlassCodes = core.renderGlassRows(line).map(item => String(item?.codigo_componente || '').trim()).filter(Boolean);
    const declaredGlassCodes = Array.isArray(line?.dibujo_vidrios) && line.dibujo_vidrios.length
      ? line.dibujo_vidrios.map(value => String(value || '').trim()).filter(Boolean)
      : sqlGlassCodes.length ? sqlGlassCodes : [String(line?.dibujo_vidrio ?? line?.vidrio_codigo ?? '').trim()].filter(Boolean);
    const uniqueGlassCodes = [...new Set(declaredGlassCodes.filter(Boolean))];
    const singleGlassCode = uniqueGlassCodes.length === 1 ? uniqueGlassCodes[0] : '';
    const sliderHardware = isSlider ? core.sliderHardware(allLeaves) : [];
    const operableHingedLeaves = allLeaves.filter(leaf => {
      const definition = core.apertureDefinition(line, leaf.apertura);
      return ['hinged', 'door', 'tilt-turn'].includes(definition.family);
    }).length;
    const hingeInfo = core.hingeCountFromHardware(line?.materiales, line?.uds ?? line?.UDS, operableHingedLeaves);
    allLeaves.forEach((leaf, index) => {
      const leafWidth = leafDrawingWidth * leaf.width / totalLeafWidth;
      const definition = core.apertureDefinition(line, leaf.apertura);
      const rail = leafRails[index];
      const depth = rail.number;
      const hiddenLeaf = leaf?.oculta === true || leaf?.kind === 'oculta';
      const inset = depth > 0 ? clamp(3.2 - (depth - 1) * .8, 1.4, 3.2) : 2.2;
      // Un fijo de corredera sigue siendo una hoja acristalada completa. No
      // se deja un hueco blanco por contar menos vidrios que hojas.
      const leafGlass = hiddenLeaf ? '' : glassMarkup(target === 'line' ? 'line-window-glass' : 'offer-glass', cursor, y, leafWidth, drawingH, !noGlass);
      const leafMuntins = hiddenLeaf ? '' : muntinMarkup(line, cursor, y, leafWidth, drawingH, finish.frame);
      const leafGlassCode = singleGlassCode ? (index === 0 ? singleGlassCode : '') : (declaredGlassCodes[index] || '');
      // En las proyectantes la manilla y el vértice viven abajo. La
      // nomenclatura permanece dentro del vidrio, pero en la esquina superior
      // izquierda, donde nunca compite con ese herraje.
      const labelY = definition.family === 'projecting' ? y + 9 : Math.min(y + drawingH - 3, 140);
      const leafLabel = hiddenLeaf ? '' : glassCodeMarkup(codeClass, leafGlassCode, cursor + 3, labelY);
      if (leafLabel) glassCodeLayers.push(leafLabel);
      if (allLeaves.length > 1) segmentDimensions.push(segmentDimensionMarkup(cursor, leafWidth, y + drawingH, leaf.width));
      const leafSash = glassOnly || hiddenLeaf ? '' : (!isSlider && definition.family === 'fixed')
          ? fixedGlazingMarkup(cursor, y, leafWidth, drawingH, finish)
          : sashMarkup(cursor, y, leafWidth, drawingH, finish, inset);
      let leafMark = '';
      const leafAxisY = definition.family === 'projecting' ? y + drawingH - 3 : openingAxisY(line, leaf, y, drawingH, height);
      if (hiddenLeaf) leafMark = '';
      else if (definition.obLeaf === index) leafMark = doubleTiltTurnMark(index === 0 ? 'left' : 'right', cursor, y, leafWidth, drawingH, color);
      else if (leaf.kind === 'single') leafMark = hingedMark(leaf.apertura, cursor, y, leafWidth, drawingH, color, leafAxisY);
      else if (leaf.kind.startsWith?.('double-tilt-turn:')) leafMark = doubleTiltTurnMark(leaf.kind.endsWith('left') ? 'left' : 'right', cursor, y, leafWidth, drawingH, color);
      else if (leaf.kind.startsWith?.('double-hinged:')) leafMark = doubleHingedMark(leaf.kind.endsWith('left') ? 'left' : 'right', cursor, y, leafWidth, drawingH, color, leafAxisY);
      else leafMark = slidingMark(leaf.kind, cursor, y, leafWidth, drawingH, color, leafAxisY);
      let leafHardware = '';
      if (!glassOnly && !hiddenLeaf) {
        let handleSpec = sliderHardware[index] || { role: 'none' };
        if (definition.obLeaf === index) handleSpec = { role: 'handle', side: index === 0 ? 'right' : 'left', reason: 'adene-ob-leaf' };
        else if (!isSlider && definition.family === 'projecting') handleSpec = { role: 'handle', side: 'center', position: 'bottom', orientation: 'up', reason: 'projecting-bottom' };
        else if (!isSlider && definition.family === 'tilt') handleSpec = { role: 'handle', side: 'center', reason: 'center-forced' };
        else if (!isSlider && (definition.family === 'hinged' || definition.family === 'door' || definition.family === 'tilt-turn')) {
          const isDouble = String(leaf.kind).startsWith('double-');
          const leafSide = String(leaf.kind).endsWith(':left') ? 'left' : String(leaf.kind).endsWith(':right') ? 'right' : '';
          const active = !isDouble || !definition.hand || leafSide === definition.hand;
          handleSpec = active
            ? { role: 'handle', side: definition.hinge === 'right' ? 'left' : 'right', reason: isDouble ? 'catalog-active-leaf' : 'opposite-hinge' }
            : { role: 'striker', side: leafSide === 'left' ? 'right' : 'left', reason: 'catalog-passive-leaf' };
        }
        leafHardware += handleMark(handleSpec, line, leaf, cursor, y, leafWidth, drawingH, height);
        if (hingeInfo.count && ['hinged', 'door', 'tilt-turn'].includes(definition.family)) {
          const hingeSide = String(leaf.kind).startsWith('double-') ? (String(leaf.kind).endsWith(':left') ? 'left' : 'right') : definition.hinge;
          leafHardware += hingeMarkup(hingeSide, hingeInfo.count, cursor, y, leafWidth, drawingH, hingeInfo.reason, line);
        }
      }
      const divider = !isSlider && index < allLeaves.length - 1 ? dividerMarkup(cursor + leafWidth, y + 2, y + drawingH - 2, finish) : '';
      // La vista frontal no muestra rótulos de carril, pero sí debe dejar claro
      // qué hoja pasa por delante. C1 recibe una sombra corta; C2/C3 quedan
      // ligeramente retrasados. Dos hojas del mismo carril siguen contiguas y
      // sólo se solapan límites pertenecientes a carriles distintos.
      const depthStyle = depth === 1
        ? 'filter:drop-shadow(1.1px 1px .65px #17212b88);'
        : depth > 1 ? `filter:drop-shadow(-.7px .8px .5px #26313d55);opacity:${Math.max(.9, .98 - (depth - 1) * .025)};` : '';
      leafLayers.push({ depth, index, markup: hiddenLeaf
        ? `<g class="window-leaf-space" data-leaf-index="${index}" data-leaf-x="${cursor}" data-leaf-width="${leafWidth}" data-hidden-leaf="true"></g>`
        : `<g class="window-leaf-depth window-rail-${depth || 0}" data-leaf-index="${index}" data-leaf-x="${cursor}" data-leaf-width="${leafWidth}" data-rail="${depth > 0 ? `C${depth}` : ''}" data-rail-source="${escape(rail.source)}" style="${depthStyle}">${leafGlass}${leafSash}${leafMuntins}${leafMark}${divider}</g>` });
      if (leafHardware) hardwareLayers.push({ depth, index, markup: `<g class="window-hardware-layer" data-leaf-index="${index}">${leafHardware}</g>` });
      cursor += leafWidth - (boundaryOverlaps[index] || 0);
    });
    const leavesMarkup = leafLayers.sort((left, right) => right.depth - left.depth || left.index - right.index).map(item => item.markup).join('');
    const hardwareMarkup = hardwareLayers.sort((left, right) => right.depth - left.depth || left.index - right.index).map(item => item.markup).join('');
    const frameClass = target === 'line' ? 'line-window-frame' : 'offer-frame';
    const glassClass = target === 'line' ? 'line-window-glass' : 'offer-glass';
    const frame = glassOnly ? '' : frameMarkup(frameClass, x, y, drawingW, drawingH, finish);
    const className = target === 'line' ? 'line-window-sketch' : 'offer-window-sketch';
    // Un paño simple (una sola hoja/ventana, sin composición de varios
    // paños) también puede traer travesaños HETMO (bh_*): la geometría
    // completa de la línea ES el paño único, con las mismas cotas 0..width
    // / 0..height que usa panelTraverseLines para un paño de una composición.
    const traverses = core.panelTraverseLines({ raw: Array.isArray(line?.geometria) ? line.geometria : [], width, height }).map(item => {
      const x1 = x + drawingW * item.x1 / Math.max(1, width);
      // Las cotas BH de HETMO crecen desde el borde inferior. SVG crece
      // desde arriba, por lo que el eje vertical debe invertirse.
      const y1 = y + drawingH * (1 - item.y1 / Math.max(1, height));
      const x2 = x + drawingW * item.x2 / Math.max(1, width);
      const y2 = y + drawingH * (1 - item.y2 / Math.max(1, height));
      return transomMarkup(x1, y1, x2, y2, finish.frame);
    }).join('');
    // HETMO no declara bh_* en las puertas: su travesaño se deduce de que el
    // vidrio de la hoja viene partido en dos piezas (ver panelGlassSplits).
    const splits = glassSplitMarkup(line, x, y, drawingW, drawingH, finish.frame, allLeaves.length === 1);
    const apertureCodes = [...new Set(allLeaves.map(leaf => number(leaf.apertura)))];
    const apertureText = apertureCodes.map(code => `Apertura ${code} · ${core.apertureDefinition(line, code).label || 'Sin nombre confirmado'}`).join(' + ');
    return `<svg class="${className}${glassOnly ? ` ${target === 'line' ? 'line-window-glass-only' : 'offer-window-glass-only'}` : ''}" data-aperture-code="${escape(apertureCodes.join(','))}" data-aperture-name="${escape(core.apertureLabel(line))}" data-guide-count="${guideCount || ''}" style="--window-finish:${finish.frame};font-family:system-ui,sans-serif" viewBox="0 0 240 178" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema de ${escape(line?.modelo || 'ventana')}"><title>${escape(apertureText)}</title>${frame}${leavesMarkup}${traverses}${splits}${hardwareMarkup}<g class="window-glass-code-layer">${glassCodeLayers.join('')}</g>${segmentDimensions.join('')}${dimensionMarkup(width, height, x, y, drawingW, drawingH)}</svg>`;
  }

  // Única conversión SVG -> PNG para todos los PDF. El SVG ya contiene su
  // apariencia completa; copiar estilos calculados conserva compatibilidad con
  // navegadores que todavía tengan CSS antiguo en caché, sin reinterpretarlo.
  export { build };




