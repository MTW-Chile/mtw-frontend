// Lógica de armado del PDF del Presupuesto, separada de PresupuestoOferta.tsx
// a propósito: sin imports de React, se puede ejecutar tal cual desde un
// script standalone (Playwright) para generar y revisar el PDF real ANTES
// de pushear un cambio -- ver scripts/preview-presupuesto.mjs. Cualquier
// cambio a como se arma la tarjeta o el documento va acá, no duplicado en el
// componente ni en scripts de prueba sueltos (esa duplicación fue la causa
// real de varios rounds de bugs de paginación que no se detectaron a tiempo).
import type { Proyecto, Ventana } from '../../../../types';
import { formatNumber } from '../../../../lib/utils';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { buildWindow } from '../../components/drawing/windowGeometryBuilder';
import { getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';
import type { PrecioVentaLinea } from '../../lib/presupuesto';

// Paleta medida a pixel del documento de referencia real (Presupuesto Casa La
// Aurora, PDF del sistema anterior): borde/franja de cabecera #bacce5, filas
// zebra #f2f7fc/#ffffff alternadas, texto navy #121929, texto de etiqueta
// #52637a -- no son colores aproximados a ojo, se sacaron de la imagen del
// PDF original con un script de muestreo de pixeles.
export const HEX = { navy: '#121929', gris: '#52637a', borde: '#bacce5', rojo: '#e34a26', headBg: '#bacce5', zebra: '#f2f7fc' };

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const ufLabel = (valorCLP: number, tasaUf: number) =>
  tasaUf > 0 ? `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valorCLP / tasaUf)} UF` : '—';

// buildWindow() no declara el namespace SVG -- no hace falta para insertarlo
// en el DOM (WindowRendererSvg lo hace vía innerHTML, donde el parser HTML5
// ya asume xmlns en un <svg> inline), pero un <img src="data:image/svg+xml">
// SÍ exige un documento standalone valido: sin xmlns el navegador descarta
// la imagen en silencio (onerror), dejando la tarjeta del PDF sin dibujo.
export const ensureSvgNamespace = (svg: string) =>
  svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');

export const svgToPngDataUrl = (svgRaw: string, width: number, height: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const svg = ensureSvgNamespace(svgRaw);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Sin contexto de canvas')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  });

// buildWindow() dibuja siempre dentro de un lienzo fijo (240×178) pensado
// para el visor en pantalla, donde ese espacio de sobra alrededor del dibujo
// no se nota -- pero en la tarjeta del PDF, angosta y con la ventana ya
// agrandada, ese margen fijo (hasta 30-40% del lienzo en ventanas muy
// horizontales o verticales, confirmado renderizando el SVG real de
// ventanas de Casa La Aurora) se veía como un vacío en blanco debajo del
// dibujo, no como "la ventana ocupando la tarjeta". Se recorta el viewBox
// al bounding box real de lo dibujado (marco, hojas, cotas) antes de
// rasterizar -- solo para esta exportación, no toca el visor en pantalla.
export const cropSvgToContent = (svg: string): { svg: string; aspect: number } => {
  const points: [number, number][] = [];
  const push = (x: unknown, y: unknown) => {
    const nx = Number(x), ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) points.push([nx, ny]);
  };
  const attr = (tagAttrs: string, name: string): number | undefined => {
    const m = new RegExp(`\\s${name}="(-?[\\d.]+)"`).exec(tagAttrs);
    return m ? parseFloat(m[1]) : undefined;
  };

  for (const m of svg.matchAll(/<rect\b([^>]*)\/?>/g)) {
    const x = attr(m[1], 'x'), y = attr(m[1], 'y'), w = attr(m[1], 'width'), h = attr(m[1], 'height');
    if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
      push(x, y);
      push(x + w, y + h);
    }
  }
  // Las etiquetas de cota (windowSvgMarkup.tsx: dimensionMarkup) usan
  // text-anchor="middle" -- el texto renderizado se extiende a ambos lados
  // del punto (x,y), no solo en ese punto. En una ventana angosta (una
  // puerta practicable de 500-1300mm) el label "1.300 mm" es MÁS ANCHO que
  // el propio marco dibujado, así que capturar solo (x,y) como si fuera un
  // punto sin extensión recortaba el texto por los costados al calcular el
  // viewBox -- confirmado comparando con el PDF real, donde las medidas de
  // las puertas angostas salían cortadas. Se estima el ancho real del
  // texto (largo del contenido × tamaño de fuente, con un factor fijo para
  // fuente system-ui) y se empuja el punto izquierdo Y derecho de esa
  // extensión, no solo el centro.
  for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const tagAttrs = m[1];
    const contenido = m[2];
    const x = attr(tagAttrs, 'x');
    const y = attr(tagAttrs, 'y');
    if (x === undefined || y === undefined) continue;
    const fontMatch = /font:[^;"]*?(\d+(?:\.\d+)?)px/.exec(tagAttrs);
    const fontPx = fontMatch ? parseFloat(fontMatch[1]) : 9;
    const anchoTexto = contenido.length * fontPx * 0.58;
    const esVertical = /rotate\(-?90/.test(tagAttrs);
    if (esVertical) {
      // Rotado -90°: el texto se extiende en el eje Y, no en X.
      push(x - fontPx * 0.6, y - anchoTexto / 2);
      push(x + fontPx * 0.6, y + anchoTexto / 2);
    } else {
      push(x - anchoTexto / 2, y - fontPx * 0.4);
      push(x + anchoTexto / 2, y + fontPx * 0.4);
    }
  }
  for (const m of svg.matchAll(/<line\b([^>]*)\/?>/g)) {
    push(attr(m[1], 'x1'), attr(m[1], 'y1'));
    push(attr(m[1], 'x2'), attr(m[1], 'y2'));
  }
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    const tokens = m[1].match(/[MLmlHhVv]|-?[\d.]+/g) || [];
    let cmd: string | null = null, cx = 0, cy = 0, i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; continue; }
      if (cmd === 'M' || cmd === 'L') { cx = parseFloat(tokens[i]); cy = parseFloat(tokens[i + 1]); push(cx, cy); i += 2; }
      else if (cmd === 'H') { cx = parseFloat(tokens[i]); push(cx, cy); i += 1; }
      else if (cmd === 'V') { cy = parseFloat(tokens[i]); push(cx, cy); i += 1; }
      else { i++; }
    }
  }

  if (!points.length) return { svg, aspect: 240 / 178 };
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const PAD = 6;
  const minX = Math.min(...xs) - PAD, minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - Math.min(...xs) + PAD * 2;
  const h = Math.max(...ys) - Math.min(...ys) + PAD * 2;
  return {
    svg: svg.replace(/viewBox="[^"]*"/, `viewBox="${minX} ${minY} ${w} ${h}"`),
    aspect: w / h,
  };
};

export async function rasterizarDibujos(ventanas: Ventana[]): Promise<Map<string, string | null>> {
  const pngPorVentana = new Map<string, string | null>();
  await Promise.all(
    ventanas.map(async (v) => {
      const line = toWindowLine(v);
      if (!line) { pngPorVentana.set(v.id, null); return; }
      try {
        const svg = buildWindow(line, 'offer').svg;
        const { svg: svgRecortado, aspect } = cropSvgToContent(svg);
        const alturaRaster = 480;
        pngPorVentana.set(v.id, await svgToPngDataUrl(svgRecortado, Math.round(alturaRaster * aspect), alturaRaster));
      } catch {
        pngPorVentana.set(v.id, null);
      }
    })
  );
  return pngPorVentana;
}

interface CardDeps {
  preciosVenta: Map<string, PrecioVentaLinea>;
  pngPorVentana: Map<string, string | null>;
  tasaUf: number;
}

// Cada tarjeta es HTML/CSS real (tabla con bordes), no coordenadas
// calculadas a mano -- este HTML se manda tal cual al relay, que lo
// imprime a PDF con Chromium real (page.pdf()), igual al documento de
// referencia (Vista Monseñor, Casa La Aurora), no una aproximación.
interface VentanaAnalisis {
  metaFilas: [string, string][];
}

// Centraliza qué filas de metadatos lleva cada tarjeta -- usado tanto para
// dibujarlas (buildCardHtml) como para ESTIMAR su alto real (estimarAltoTarjeta,
// para el paginado adaptativo) -- las dos partes cuentan las mismas filas
// para la misma tarjeta. Antes esta lógica vivía duplicada inline en
// buildCardHtml; la misma clase de bug de duplicación que ya nos costó caro con el script de
// preview en su momento.
function analizarVentana(v: Ventana): VentanaAnalisis {
  const line = toWindowLine(v);
  const isFrameless = Boolean(line?.dibujoSinMarco);
  // Una ventana sin paños con apertura declarada (p.ej. sin marco, solo
  // vidrio fijo) no debe dejar "Apertura:" en blanco -- no se abre, y
  // eso hay que decirlo, no omitirlo. apertureLabel() ya cae a
  // "Ventana fija" en casi todos los casos ambiguos, pero esta es la
  // red de seguridad final para que la fila nunca salga vacía.
  const apertura = (line ? core.apertureLabel(line) : '') || 'Ventana fija';
  // "Serie de perfiles" en el documento de referencia trae el acabado
  // pegado con un guion ("Línea Efficient - Black Matt"), no como fila
  // aparte -- mismo formato que generate_project_budget.js del sistema
  // anterior: `${serie_perfiles} - ${finish.description||finish.label}`.
  const serieBase = core.profileSeries({ modelo: v.descripcionCorta || v.modelo });
  const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
  const serieP = [serieBase !== 'Línea no especificada' ? serieBase : null, finishLabel]
    .filter(Boolean)
    .join(' - ');
  const vidrio = Array.from(
    new Set((v.materiales || []).filter((m) => !m.excluido && m.material?.familia === 'VIDRIOS').map((m) => m.material?.descripcion || ''))
  ).filter(Boolean).join(' + ');
  const herraje = Array.from(
    new Set((v.materiales || []).filter((m) => !m.excluido && m.material?.familia === 'HERRAJES').map((m) => m.material?.proveedor?.nombre || m.material?.descripcion || ''))
  ).filter(Boolean).join(' + ');
  // Una línea "sin marco" (dibujoSinMarco/isFrameless -- exige material
  // coincidente Y vidrio explícito, no es un simple "vacío -> sin marco",
  // ver el comentario largo en ventanaAdapter.ts) es en los hechos solo
  // vidrio: no tiene perfil que amerite "Serie de perfiles", no tiene
  // hoja que "abra" (Apertura no aplica) y no lleva herrajes propios --
  // esas tres filas se omiten. Para el resto, orden igual al Presupuesto
  // de referencia: Dimensiones, Serie de perfiles con el acabado incluido,
  // Apertura, Herrajes, Vidrios.
  const metaFilas: [string, string][] = [
    ['Dimensiones', `${formatNumber(v.anchoMm, 0)} × ${formatNumber(v.altoMm, 0)} mm`],
    ...(!isFrameless ? [['Serie de perfiles', serieP] as [string, string]] : []),
    ...(!isFrameless ? [['Apertura', apertura] as [string, string]] : []),
    ...(!isFrameless && herraje ? [['Herrajes', herraje] as [string, string]] : []),
    ...(vidrio ? [['Vidrios', vidrio] as [string, string]] : []),
  ];
  return { metaFilas };
}

// Cuántas líneas visuales va a ocupar un texto libre (Observación,
// párrafo de presentación) dado un ancho de columna disponible -- se usa
// tanto para estimar el alto de una tarjeta como el del encabezado de
// portada. Cuenta los saltos de línea manuales (\n) Y estima el
// wrap automático por ancho, no solo uno de los dos.
function estimarLineasTexto(texto: string, anchoColumnaPx: number, anchoCaracterPx: number): number {
  const caracteresPorLinea = Math.max(1, Math.floor(anchoColumnaPx / anchoCaracterPx));
  return texto.split('\n').reduce((acc, linea) => acc + Math.max(1, Math.ceil(linea.length / caracteresPorLinea)), 0);
}

// En la práctica casi ningún comentario de presupuesto pasa de 3 líneas --
// se estandariza ahí el tope (visualmente se recorta con "…" vía
// -webkit-line-clamp en observacionRowHtml si el texto real es más largo).
const LINEAS_OBSERVACION_TOPE = 3;

// Cupo FIJO -- 2 tarjetas en la portada, 3 en cada página siguiente,
// siempre, sin variar según el contenido. El alto de CADA tarjeta es el
// máximo que le puede tocar dado ese cupo fijo (el alto útil de la página
// dividido en partes iguales -- ver slotPortada/slotSiguiente en
// buildDocumentoHtml), no un cálculo por tarjeta. El dibujo mide siempre
// lo mismo (ALTO_IMAGEN_BASE x ANCHO_IMAGEN_BASE, fijo) -- no se estira
// para llenar el sobrante del slot, eso se sentía invasivo con tarjetas
// livianas (a pedido explícito); el aire que sobra en la fila imagen/
// valores queda como aire, centrado.
const ALTO_FILA_META = 19;
const ALTO_HEADER_TARJETA = 26;
const ALTO_BORDE_TARJETA = 2;
// Tamaño FIJO del dibujo -- el mismo en toda tarjeta, con o sin
// Observación, sobre o no sobre espacio en el slot.
const ALTO_IMAGEN_BASE = 132;
const ANCHO_IMAGEN_BASE = 184;
// Piso REAL (medido renderizando la caja de "Valores comerciales" sola,
// con su padding) de la fila imagen/valores -- esa caja no puede achicarse
// más, tenga o no dibujo al lado. Ignorarlo fue justamente el bug: con
// un piso más chico (o sin piso), el cálculo de cuánto le "sobraba" al
// dibujo daba un número optimista, pero la fila terminaba siendo más alta
// igual (por la caja de valores) y la tarjeta entera se pasaba del slot,
// recortando en silencio la Observación por el overflow:hidden.
const ALTO_MIN_FILA_IMAGEN_VALORES = 99;

// Cuánto de una tarjeta ocupan sus filas de texto (todo menos la fila
// imagen/valores), dada esta ventana en particular.
function alturaFilasTexto(v: Ventana, analisis: VentanaAnalisis): number {
  let alto = ALTO_HEADER_TARJETA + analisis.metaFilas.length * ALTO_FILA_META + ALTO_BORDE_TARJETA;
  if (v.comentarioPresupuesto) {
    alto += ALTO_FILA_META * LINEAS_OBSERVACION_TOPE;
  }
  return alto;
}

// Alto MÍNIMO absoluto que esta tarjeta puede llegar a ocupar, incluso sin
// dibujo -- el piso real de la caja de valores ya está adentro. Si el slot
// que le toca (portada o siguiente) es menor a esto, NO hay forma de que
// la tarjeta entre sin cortar texto -- el paginado tiene que bajarle el
// cupo a esa página en vez de forzarla (ver buildDocumentoHtml).
function altoMinimoTarjeta(v: Ventana, analisis: VentanaAnalisis): number {
  return alturaFilasTexto(v, analisis) + ALTO_MIN_FILA_IMAGEN_VALORES;
}

// Alto del encabezado completo de portada (logos + título + divisor +
// código/fecha + datos del cliente formato factura + saludo + párrafo de
// presentación) -- todo fijo salvo el párrafo (crece con el texto real) y
// el bloque de datos del cliente (crece según cuántos campos trae ese
// cliente -- Señor(es)/R.U.T./Giro/Dirección/Comuna/Contacto/Obra, cada
// fila se omite si no hay dato). Si cualquiera de los dos crece sin
// avisarle al paginado, el header se come más alto del que el cupo fijo de
// la portada tenía presupuestado -- mismo tipo de bug que el resumen de
// totales cortado (ver ALTO_RESUMEN más abajo). ALTO_HEADER_PORTADA_BASE
// ya NO incluye el bloque de cliente (antes eran 2 líneas fijas,
// "Cliente:"/"Obra:", medidas en 26px) -- ese alto ahora se calcula aparte
// con ALTO_FILA_CLIENTE, medido renderizando la tabla real: cada fila mide
// 13px exactos, sin overhead fijo de por medio (1 fila = 13px, 7 filas =
// 91px, lineal).
const ALTO_HEADER_PORTADA_BASE = 210 - 26;
const ALTO_HEADER_PORTADA_CON_SALUDO = 30;
const ANCHO_COLUMNA_TEXTO_PRESENTACION = 690;
const ANCHO_CARACTER_TEXTO_PRESENTACION = 4.7;
const ALTO_LINEA_TEXTO_PRESENTACION = 14;
const ALTO_FILA_CLIENTE = 13;

function estimarAltoHeaderCompleto(texto: string, filasCliente: number): number {
  const altoCliente = filasCliente * ALTO_FILA_CLIENTE;
  if (!texto.trim()) return ALTO_HEADER_PORTADA_BASE + altoCliente;
  const lineas = estimarLineasTexto(texto.trim(), ANCHO_COLUMNA_TEXTO_PRESENTACION, ANCHO_CARACTER_TEXTO_PRESENTACION);
  return ALTO_HEADER_PORTADA_BASE + altoCliente + ALTO_HEADER_PORTADA_CON_SALUDO + lineas * ALTO_LINEA_TEXTO_PRESENTACION;
}

export function buildCardHtml(v: Ventana, deps: CardDeps, opts: { altoTarjeta: number; esUltimaEnPagina?: boolean }): string {
  const { preciosVenta, pngPorVentana, tasaUf } = deps;
  const analisis = analizarVentana(v);
  const { metaFilas } = analisis;
  // Tabla de metadatos a todo el ancho de la tarjeta, sin grilla -- el
  // documento de referencia distingue las filas con una banda de color
  // alternada (zebra), no con líneas divisorias entre celdas.
  const metaRowsHtml = metaFilas.map(([label, value], i) => `
    <tr style="background:${i % 2 === 0 ? HEX.zebra : '#ffffff'};">
      <td style="padding:4px 10px;color:${HEX.gris};width:150px;font-size:9px;">${escapeHtml(label)}:</td>
      <td style="padding:4px 10px;color:${HEX.navy};font-weight:bold;font-size:9px;">${escapeHtml(value)}</td>
    </tr>`).join('');
  // Tope estandarizado de 3 líneas -- en la práctica casi ningún comentario
  // pasa de ahí, y fijar un tope predecible es lo que hace posible
  // estimar el alto de esta fila para el paginado sin adivinar cuánto
  // texto real trae cada comentario (siempre 3 líneas si hay Observación,
  // ver LINEAS_OBSERVACION_TOPE en estimarAltoTarjeta). -webkit-line-clamp corta con "…" en
  // vez de recortar a la mitad de una palabra -- funciona porque el motor
  // de render es siempre Chromium (el mismo que arma el PDF), no hace
  // falta soportar otros navegadores acá. OJO: el clamp tiene que ir en un
  // <div> propio, NO directo en el <td> -- aplicado directo sobre la celda
  // deja una 4ta línea parcial colgando (confirmado renderizando: el
  // algoritmo de layout de la celda de tabla no combina bien con
  // display:-webkit-box ahí).
  const observacionRowHtml = v.comentarioPresupuesto ? `
    <tr style="background:${metaFilas.length % 2 === 0 ? HEX.zebra : '#ffffff'};">
      <td style="padding:4px 10px;color:${HEX.gris};width:150px;font-size:9px;vertical-align:top;">Observación:</td>
      <td style="padding:4px 10px;color:${HEX.navy};font-weight:bold;font-size:9px;">
        <div style="white-space:pre-line;display:-webkit-box;-webkit-line-clamp:${LINEAS_OBSERVACION_TOPE};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(v.comentarioPresupuesto)}</div>
      </td>
    </tr>` : '';

  const precio = preciosVenta.get(v.id);
  const png = pngPorVentana.get(v.id);

  // Alto de tarjeta FIJO (opts.altoTarjeta -- el slot que le toca según el
  // cupo fijo de la página, portada o siguiente, ver buildDocumentoHtml).
  // La fila imagen/valores se lleva lo que sobra después de las filas de
  // texto reales de ESTA tarjeta (nunca menos de ALTO_MIN_FILA_IMAGEN_VALORES,
  // el piso real de la caja de "Valores comerciales", medido -- esa caja
  // no se achica más). buildDocumentoHtml ya garantiza -- vía
  // altoMinimoTarjeta, que usa este mismo piso -- que opts.altoTarjeta
  // nunca es menor a lo que esta tarjeta necesita como mínimo, así que
  // este Math.max no debería activarse nunca en la práctica; queda como
  // red de seguridad.
  //
  // El DIBUJO en sí ya NO se escala con ese sobrante -- mide siempre lo
  // mismo (ANCHO_IMAGEN_BASE x ALTO_IMAGEN_BASE), tenga la tarjeta
  // Observación o no, quede mucho o poco aire en la fila. Escalarlo hacia
  // arriba se sentía invasivo con más espacio disponible (cupo 2/3) -- a
  // pedido explícito, el aire sobrante en la fila queda como aire
  // (centrado, vertical-align:middle), no lo absorbe el dibujo.
  const filaImagenValores = Math.max(ALTO_MIN_FILA_IMAGEN_VALORES, opts.altoTarjeta - alturaFilasTexto(v, analisis));

  // margin-bottom SOLO si no es la última tarjeta de la página -- el
  // presupuesto de alto que reparte el cupo (calcularSlot en
  // buildDocumentoHtml) solo cuenta (cupo-1) espacios ENTRE tarjetas, no
  // uno extra después de la última. Aplicar el margen igual ahí (como
  // pasaba antes) sumaba un 10px que no estaba presupuestado, y el
  // overflow:hidden de la página se comía buena parte del aire agregado
  // para separar el footer -- confirmado con una captura real donde el
  // footer seguía leyéndose pegado a la tarjeta pese a haber subido el
  // padding de la página.
  const margenInferior = opts.esUltimaEnPagina ? '' : 'margin-bottom:10px;';

  return `
  <div style="border:1px solid ${HEX.borde};height:${Math.round(opts.altoTarjeta)}px;overflow:hidden;${margenInferior}page-break-inside:avoid;">
    <div style="background:${HEX.headBg};padding:6px 12px;font-size:12px;font-weight:bold;color:${HEX.navy};">${escapeHtml(v.modelo)}</div>
    <table style="width:100%;border-collapse:collapse;">${metaRowsHtml}</table>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr>
        <td style="width:56%;height:${Math.round(filaImagenValores)}px;padding:8px 10px 8px 12px;vertical-align:middle;">
          ${png ? `<img src="${png}" style="max-width:${ANCHO_IMAGEN_BASE}px;max-height:${ALTO_IMAGEN_BASE}px;width:auto;height:auto;display:block;margin:0 auto;" />` : ''}
        </td>
        <td style="width:44%;vertical-align:top;padding:8px 12px 8px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td colspan="2" style="background:${HEX.headBg};font-weight:bold;padding:5px 10px;font-size:9px;color:${HEX.navy};">Valores comerciales</td></tr>
            <tr><td style="padding:5px 10px;font-size:9px;color:${HEX.gris};border-bottom:1px solid ${HEX.borde};">Precio unitario neto</td><td style="padding:5px 10px;font-size:9px;text-align:right;color:${HEX.navy};border-bottom:1px solid ${HEX.borde};">${escapeHtml(ufLabel(precio?.precioUnitarioCLP || 0, tasaUf))}</td></tr>
            <tr><td style="padding:5px 10px;font-size:9px;color:${HEX.gris};border-bottom:1px solid ${HEX.borde};">Cantidad</td><td style="padding:5px 10px;font-size:9px;text-align:right;color:${HEX.navy};border-bottom:1px solid ${HEX.borde};">${v.unidades} unidad(es)</td></tr>
            <tr><td style="padding:5px 10px;font-size:9px;color:${HEX.navy};font-weight:bold;border-bottom:1px solid ${HEX.borde};">Total neto</td><td style="padding:5px 10px;font-size:9px;text-align:right;font-weight:bold;color:${HEX.navy};border-bottom:1px solid ${HEX.borde};">${escapeHtml(ufLabel(precio?.precioVentaCLP || 0, tasaUf))}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    ${observacionRowHtml ? `<table style="width:100%;border-collapse:collapse;">${observacionRowHtml}</table>` : ''}
  </div>`;
}

export interface DocumentoHtmlParams {
  proyecto: Proyecto;
  ventanas: Ventana[];
  texto: string;
  condiciones: string;
  venta: number;
  iva: number;
  totalConIva: number;
  ivaPct: number;
  tasaUf: number;
  logoDataUrl: string | null;
  logoMuchtekDataUrl: string | null;
  preciosVenta: Map<string, PrecioVentaLinea>;
  pngPorVentana: Map<string, string | null>;
}

// Documento completo: header con logo (solo primera página) + todas las
// tarjetas en un solo flujo continuo + resumen de totales, y Condiciones
// Comerciales en su propia página (page-break-before:always). Se dejó de
// intentar calcular manualmente en qué página cae cada ventana -- ver el
// comentario largo en git log de este archivo (commit
// "dejar de calcular la pagina de cada ventana, usar flujo natural") --
// es Chromium, en el relay, quien decide los saltos de página reales.
export function buildDocumentoHtml(params: DocumentoHtmlParams): string {
  const {
    proyecto, ventanas, texto, condiciones, venta, iva, totalConIva, ivaPct, tasaUf,
    logoDataUrl, logoMuchtekDataUrl, preciosVenta, pngPorVentana,
  } = params;

  const codigoLabel = `Presupuesto - ${proyecto.codigoInterno || proyecto.numeroPresupuesto}`;
  const fechaLabel = new Date().toLocaleDateString('es-CL');
  const clienteNombre = proyecto.cliente?.nombre || proyecto.clienteNombreRaw;
  // Mismo patron de fallback que clienteNombre: si el cliente esta
  // vinculado al maestro (proyecto.cliente) se usan sus datos reales, si no
  // caemos a los *Raw que trae directo HETMO (nunca vacio a la fuerza).
  const clienteRut = proyecto.cliente?.rut || proyecto.clienteRutRaw;
  const clienteGiro = proyecto.cliente?.giro || null;
  const clienteDireccion = proyecto.cliente?.direccion || proyecto.clienteDireccionRaw;
  const clienteComuna = proyecto.cliente?.localidad || proyecto.clienteLocalidadRaw;
  const clienteContacto = proyecto.cliente?.contacto || null;

  const logoImg = logoDataUrl ? `<img src="${logoDataUrl}" style="width:101px;height:46px;display:block;margin-bottom:12px;" />` : '';
  // En el documento de referencia el logo de Muchtek (Tecnoperfiles Group,
  // el proveedor del perfil) va arriba a la derecha, a la misma altura
  // que el logo de MTW -- solo en la primera página.
  const logosHeaderHtml = logoMuchtekDataUrl
    ? `<table style="width:100%;margin-bottom:12px;"><tr>
        <td style="vertical-align:top;">${logoImg}</td>
        <td style="vertical-align:top;text-align:right;"><img src="${logoMuchtekDataUrl}" style="width:120px;height:auto;display:inline-block;" /></td>
      </tr></table>`
    : logoImg;

  const cardHtml = (v: Ventana, altoTarjeta: number, esUltimaEnPagina: boolean) =>
    buildCardHtml(v, { preciosVenta, pngPorVentana, tasaUf }, { altoTarjeta, esUltimaEnPagina });

  // Encabezado completo (primera página): logo, "Oferta Cliente" como
  // título, línea divisoria, "Presupuesto - X / Fecha", datos del cliente
  // en formato factura (Señor(es)/R.U.T./Giro/Dirección/Comuna/Contacto,
  // una fila por dato -- calcado del formato de factura de referencia para
  // que quepa compacto), "Obra:", saludo y párrafo de presentación.
  // Filas presentes (con dato real) -- misma lista alimenta el HTML y el
  // conteo que usa estimarAltoHeaderCompleto para el paginado, así nunca
  // pueden desincronizarse entre sí.
  const filasClienteData: [string, string | null | undefined][] = [
    ['Señor(es)', clienteNombre],
    ['R.U.T.', clienteRut],
    ['Giro', clienteGiro],
    ['Dirección', clienteDireccion],
    ['Comuna', clienteComuna],
    ['Contacto', clienteContacto],
    ['Obra', proyecto.obra],
  ];
  const filasClientePresentes = filasClienteData.filter(([, valor]) => Boolean(valor));
  const datosClienteHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${filasClientePresentes
        .map(
          ([label, valor]) =>
            `<tr><td style="width:70px;font-size:9px;font-weight:bold;color:${HEX.navy};padding:1.5px 0;">${label}:</td><td style="font-size:9px;font-weight:bold;color:${HEX.navy};padding:1.5px 0;">${escapeHtml(valor!)}</td></tr>`
        )
        .join('')}
    </table>`;

  const headerCompletoHtml = `
    <div style="height:4px;background:${HEX.rojo};"></div>
    <div style="padding:20px 42px 0 42px;">
      ${logosHeaderHtml}
      <div style="font-size:19px;font-weight:bold;color:${HEX.navy};margin-bottom:10px;">Oferta Cliente</div>
      <div style="border-top:1px solid ${HEX.borde};margin-bottom:16px;"></div>
      <table style="width:100%;margin-bottom:10px;"><tr>
        <td style="font-size:10px;font-weight:bold;color:${HEX.navy};">${escapeHtml(codigoLabel)}</td>
        <td style="font-size:10px;color:${HEX.gris};text-align:right;">Fecha: ${escapeHtml(fechaLabel)}</td>
      </tr></table>
      ${datosClienteHtml}
      ${texto.trim() ? `
        <div style="font-size:9.5px;color:${HEX.navy};margin-bottom:4px;">Estimado Cliente,</div>
        <div style="font-size:9.5px;color:${HEX.navy};line-height:1.5;margin-bottom:16px;">${escapeHtml(texto.trim())}</div>
      ` : ''}
    </div>`;

  // Filas apiladas (etiqueta izquierda / valor derecha), NO columnas lado a
  // lado -- calcado del documento de referencia, comparado directamente
  // contra una captura del original: "SUBTOTAL NETO" y "IVA" son filas
  // livianas del mismo tamaño, una línea divisoria fina, y "TOTAL CON IVA"
  // como fila final en mayúsculas y bold, con el valor más grande.
  const resumenHtml = `
    <div style="background:${HEX.navy};border-radius:6px;padding:14px 18px;color:#ffffff;margin-top:10px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:5px 0;font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.02em;">Subtotal neto</td>
          <td style="padding:5px 0;font-size:11px;font-weight:bold;text-align:right;">${escapeHtml(ufLabel(venta, tasaUf))}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.02em;border-bottom:1px solid #334155;">IVA (${ivaPct}%)</td>
          <td style="padding:5px 0;font-size:11px;font-weight:bold;text-align:right;border-bottom:1px solid #334155;">${escapeHtml(ufLabel(iva, tasaUf))}</td>
        </tr>
        <tr>
          <td style="padding:8px 0 0 0;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.02em;">Total con IVA</td>
          <td style="padding:8px 0 0 0;font-size:15px;font-weight:bold;text-align:right;">${escapeHtml(ufLabel(totalConIva, tasaUf))}</td>
        </tr>
      </table>
    </div>`;

  // Paginado FIJO: 3 tarjetas en la portada, 4 en cada página siguiente --
  // ese cupo se usa SIEMPRE que el contenido real quepa (la enorme mayoría
  // de los casos reales). 1006px = 1056px carta - 32px margen superior -
  // 18px inferior, el mismo margen que aplica renderHtmlToPdfConCabecera
  // en el relay a AMBOS renders -- portada y con cabecera -- así que este
  // número es el real, no un valor aproximado. El slot que le toca a cada
  // tarjeta es ese alto útil dividido en partes iguales según el cupo de
  // esa página (en la portada, descontando primero lo que se come el
  // encabezado completo) -- el máximo que una tarjeta puede llegar a medir
  // ahí. Cada tarjeta usa ese slot (buildCardHtml) y escala su dibujo para
  // llenar lo que sobre, en vez de dejarlo en blanco.
  //
  // VÁLVULA DE SEGURIDAD: una línea completa (5 filas de metadatos) con
  // Observación de 3 líneas puede, en casos extremos, no entrar ni con el
  // dibujo oculto -- confirmado renderizando ese caso exacto (recortaba la
  // Observación en silencio). Antes de fijar el cupo de una página, se
  // verifica que la tarjeta más pesada de ese grupo entre al menos a su
  // mínimo absoluto (altoMinimoTarjeta); si no entra, se le baja el cupo A
  // ESA página (una tarjeta menos, más alto disponible) hasta que entre.
  // En el 99% de los casos reales esto nunca se activa y el cupo queda en
  // 3/4 -- solo actúa como red para no perder contenido.
  const CUPO_PORTADA = 2;
  const CUPO_SIGUIENTE = 3;
  const ALTO_UTIL_PAGINA = 1006;
  const GAP_TARJETAS = 10;
  // Aire real entre la última tarjeta y el footer -- con solo 6px, el
  // borde de la última tarjeta quedaba a centímetros del texto del
  // footer y se leía como si el footer fuera una fila más de esa misma
  // tabla (confirmado con una captura real). Tiene que restarse ACÁ, del
  // presupuesto que reparte el cupo -- si no, esos 20px se los come el
  // overflow:hidden de la página en vez de quedar como espacio visible.
  const PADDING_INFERIOR_PAGINA = 26;
  // Alto REAL del resumen de totales (Subtotal/IVA/Total con IVA), medido
  // renderizando resumenHtml solo a 732px de ancho (el ancho útil real de
  // la columna de tarjetas). El cupo llenaba SIEMPRE el 100% del alto
  // disponible con tarjetas (calcularSlot reparte todo el alto entre
  // ellas, sin dejar sobrante) -- así que en la página final, el resumen
  // se agregaba después sin ningún espacio reservado y el overflow:hidden
  // de la página lo recortaba entero en silencio. Confirmado: pasaba
  // SIEMPRE que la última página quedara con su cupo lleno (ej. 3
  // ventanas completas), no solo en casos raros.
  const ALTO_RESUMEN = 98;
  const altoHeaderPortada = estimarAltoHeaderCompleto(texto, filasClientePresentes.length);

  const calcularSlot = (cupo: number, altoDisponible: number) => (altoDisponible - GAP_TARJETAS * (cupo - 1)) / cupo;

  const paginas: { ventanas: Ventana[]; slot: number }[] = [];
  {
    let idx = 0;
    while (idx < ventanas.length) {
      const esPortada = paginas.length === 0;
      const cupoMax = esPortada ? CUPO_PORTADA : CUPO_SIGUIENTE;
      // Si lo que queda entra en esta página con el cupo máximo, ES la
      // última página de ventanas -- reservamos el alto del resumen ANTES
      // de repartir el cupo. Si esa reserva obliga a bajar el cupo (menos
      // tarjetas entran), sobran ventanas para una página siguiente, que
      // vuelve a evaluar esta misma condición y reserva el resumen ahí en
      // vez de acá -- se autocorrige sin necesitar un segundo pase.
      const esUltimaCandidata = ventanas.length - idx <= cupoMax;
      const altoDisponible =
        ALTO_UTIL_PAGINA - PADDING_INFERIOR_PAGINA - (esPortada ? altoHeaderPortada : 0) - (esUltimaCandidata ? ALTO_RESUMEN : 0);
      let cupo = cupoMax;
      let slot = calcularSlot(cupo, altoDisponible);
      while (cupo > 1) {
        const candidatas = ventanas.slice(idx, idx + cupo);
        const minimoNecesario = Math.max(...candidatas.map((v) => altoMinimoTarjeta(v, analizarVentana(v))));
        if (minimoNecesario <= slot) break;
        cupo -= 1;
        slot = calcularSlot(cupo, altoDisponible);
      }
      paginas.push({ ventanas: ventanas.slice(idx, idx + cupo), slot });
      idx += cupo;
    }
    if (paginas.length === 0) {
      const altoDisponible = ALTO_UTIL_PAGINA - PADDING_INFERIOR_PAGINA - altoHeaderPortada - ALTO_RESUMEN;
      paginas.push({ ventanas: [], slot: calcularSlot(CUPO_PORTADA, altoDisponible) });
    }
  }

  // Todas las páginas se arman igual -- tarjetas a su slot, apiladas con
  // su propio margin-bottom. La única diferencia entre páginas es: la
  // portada lleva headerCompletoHtml y las demás no, y la ÚLTIMA lleva el
  // resumen de totales al final y no fuerza salto de página después (no
  // hace falta -- si sigue Condiciones Comerciales, esa sección ya trae
  // su propio page-break-before). height+overflow:hidden en cada página
  // es un margen de seguridad, no lo que reparte el alto.
  const contenidoVentanasHtml = paginas.map(({ ventanas: cardsPagina, slot }, idx) => {
    const esPortada = idx === 0;
    const esUltima = idx === paginas.length - 1;
    const tarjetasHtml = cardsPagina.map((v, i) => cardHtml(v, slot, i === cardsPagina.length - 1)).join('');
    return `
      <div style="width:100%;height:${ALTO_UTIL_PAGINA}px;box-sizing:border-box;overflow:hidden;font-family:Helvetica,Arial,sans-serif;background:#ffffff;${esUltima ? '' : 'page-break-after:always;'}">
        ${esPortada ? headerCompletoHtml : ''}
        <div style="padding:0 42px ${PADDING_INFERIOR_PAGINA}px 42px;">
          ${tarjetasHtml}
          ${esUltima ? resumenHtml : ''}
        </div>
      </div>`;
  }).join('');

  // Sin logo ni franja roja acá -- Condiciones Comerciales es una página
  // más DESPUÉS de la portada, así que ya lleva el encabezado compacto de
  // Puppeteer (Obra · Presupuesto / Fecha, con su propia línea divisoria)
  // en la banda superior de margen. Repetir logo+franja roja acá los ponía
  // a centímetros uno del otro -- dos encabezados distintos casi pegados
  // -- confirmado con una captura real. Las páginas de tarjetas de ventana
  // ya seguían este mismo criterio (sin logo propio); Condiciones ahora es
  // consistente con ellas.
  const condicionesHtml = condiciones.trim() ? `
    <div style="width:100%;font-family:Helvetica,Arial,sans-serif;background:#ffffff;page-break-before:always;">
      <div style="padding:20px 42px 0 42px;">
        <div style="font-size:19px;font-weight:bold;color:${HEX.navy};margin-bottom:10px;">Condiciones Comerciales</div>
        <div style="border-top:1px solid ${HEX.borde};margin-bottom:16px;"></div>
        <ul style="font-size:9px;color:${HEX.navy};line-height:1.7;padding-left:16px;margin:0;">
          ${condiciones.trim().split('\n').filter(Boolean).map((l) => `<li style="margin-bottom:4px;">${escapeHtml(l.trim())}</li>`).join('')}
        </ul>
      </div>
    </div>` : '';

  // width:595px (el ancho en puntos de una hoja A4) es un error de
  // unidades, no un tamaño real: Chromium arma el layout de impresion
  // en pixeles CSS del tamaño de pagina elegido (carta = 816px a
  // 96dpi), asi que un contenedor de 595 CSS-px ocupaba solo ~73% del
  // ancho fisico de la hoja, dejando una franja en blanco a la derecha
  // -- confirmado midiendo el PDF resultante, no a ojo. width:100% lo
  // corrige: la pagina ocupa el ancho real de la hoja carta.
  //
  // OJO: @page no declara margin -- el margen real lo pone SIEMPRE la
  // opcion `margin` de page.pdf() en el relay (0 si no hay
  // header/footer, o el margen reservado para ellos si los hay).
  // Declarar `margin:0` acá competía con esa opción: el header/footer
  // quedaba reservado en la banda superior/inferior (según lo que pide
  // page.pdf()), pero el contenido del body arrancaba en la esquina
  // física de la hoja (ignorando esa reserva) -- confirmado
  // renderizando: el encabezado compacto quedaba superpuesto con la
  // primera tarjeta de cada página siguiente a la portada.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; }
  * { box-sizing: border-box; }
  body { margin: 0; }
</style>
</head>
<body>
  ${contenidoVentanasHtml}
  ${condicionesHtml}
</body>
</html>`;
}

export interface HeaderFooterTemplatesParams {
  proyecto: Proyecto;
  logoDataUrl: string | null;
  footerWebUrl?: string | null;
  footerWebLabel?: string | null;
  footerInstagramUrl?: string | null;
  footerInstagramHandle?: string | null;
}

// Encabezado compacto ("{Obra} · Presupuesto - X" + logo chico + "Fecha")
// y pie ("Presupuesto - X") que el documento de referencia repite en cada
// página siguiente a la portada -- NO en la portada misma. Chromium no
// aplica headerTemplate/footerTemplate condicionalmente según la página,
// así que estos strings se usan junto con el margin (mismo en ambos
// renders) en renderHtmlToPdfConCabecera (relay): un primer render con
// header/footer vacíos da la página 1, un segundo con estos da el resto,
// y se combinan -- ver ese comentario en mtw-relay-api/src/pdfRenderer.ts
// para el detalle de por qué hace falta ese rodeo.
export function buildHeaderFooterTemplates(params: HeaderFooterTemplatesParams): { headerTemplate: string; footerTemplate: string } {
  const { proyecto, footerWebUrl, footerWebLabel, footerInstagramUrl, footerInstagramHandle } = params;
  const codigoLabel = `Presupuesto - ${proyecto.codigoInterno || proyecto.numeroPresupuesto}`;
  const fechaLabel = new Date().toLocaleDateString('es-CL');

  // Puppeteer renderiza headerTemplate/footerTemplate en un documento
  // aislado, sin las hojas de estilo de la página -- todo el CSS va inline.
  // "date"/"pageNumber"/"totalPages" son las únicas clases que Puppeteer
  // completa automáticamente; el resto es texto estático (mismo en cada
  // página, correcto acá porque Obra/Presupuesto/Fecha no cambian entre
  // páginas). Sin logo acá -- un <img> dentro de este template hacía que
  // el texto se superpusiera con él (confirmado renderizando: el bloque de
  // texto no respetaba la altura de la imagen), y no vale la pena pelear
  // con el motor de header/footer de Puppeteer -- que es aislado y mucho
  // más limitado que el documento principal -- por un logo chico que el
  // documento de referencia trae más como detalle que como elemento
  // funcional.
  const headerTemplate = `
    <div style="width:100%;padding:0 42px;font-family:Helvetica,Arial,sans-serif;">
      <div style="display:flex;justify-content:space-between;font-size:8px;color:${HEX.navy};font-weight:bold;">
        <span>${escapeHtml(proyecto.obra)} · ${escapeHtml(codigoLabel)}</span>
        <span style="color:${HEX.gris};font-weight:normal;">Fecha: ${escapeHtml(fechaLabel)}</span>
      </div>
      <div style="border-top:1px solid ${HEX.borde};margin-top:4px;"></div>
    </div>`;

  // Sin línea divisoria arriba -- con una tarjeta (que ya trae su propio
  // borde inferior) justo antes del footer, la línea del footer quedaba a
  // centímetros de esa otra, y las dos juntas se leían como una fila de
  // tabla suelta en vez de un footer limpio -- confirmado con una captura
  // real.
  //
  // RRSS a la derecha, cada una como <a href> real -- a diferencia del
  // logo (raster, con overlap confirmado), un <svg> inline chico Y un
  // link con texto SÍ se comportan bien en este contexto aislado
  // (confirmado renderizando y verificando los bytes del PDF resultante:
  // el <a href> se traduce en una anotación /Annot /URI real y
  // clickeable, no solo texto). Cada ícono/link se omite si no hay URL
  // cargada en Configuración -- no se muestra un link roto a "".
  const iconoWeb = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${HEX.gris}" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  const iconoInstagram = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${HEX.gris}" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;
  const linkRrss = (url: string | null | undefined, icono: string, label: string) =>
    url ? `<a href="${escapeHtml(url)}" style="display:flex;align-items:center;gap:3px;font-size:8px;color:${HEX.gris};text-decoration:none;">${icono}${escapeHtml(label)}</a>` : '';
  const rrssHtml = [
    linkRrss(footerWebUrl, iconoWeb, footerWebLabel || footerWebUrl || ''),
    linkRrss(footerInstagramUrl, iconoInstagram, footerInstagramHandle || footerInstagramUrl || ''),
  ].filter(Boolean).join('<span style="width:10px;display:inline-block;"></span>');

  const footerTemplate = `
    <div style="width:100%;padding:0 42px;font-family:Helvetica,Arial,sans-serif;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:8px;color:${HEX.gris};">${escapeHtml(codigoLabel)}</div>
      ${rrssHtml ? `<div style="display:flex;align-items:center;">${rrssHtml}</div>` : ''}
    </div>`;

  return { headerTemplate, footerTemplate };
}
