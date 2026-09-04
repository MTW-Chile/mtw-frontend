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
  for (const m of svg.matchAll(/<text\b([^>]*)>/g)) {
    push(attr(m[1], 'x'), attr(m[1], 'y'));
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
export function buildCardHtml(v: Ventana, deps: CardDeps, opts: { spacing?: boolean } = {}): string {
  const { preciosVenta, pngPorVentana, tasaUf } = deps;
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
  // Mismo orden que el Presupuesto de referencia: Dimensiones, Serie de
  // perfiles con el acabado incluido (omitido en líneas SOLO DVH, que
  // no tienen perfil ni acabado), Apertura, Herrajes, Vidrios.
  const metaFilas: [string, string][] = [
    ['Dimensiones', `${formatNumber(v.anchoMm, 0)} × ${formatNumber(v.altoMm, 0)} mm`],
    ...(!isFrameless ? [['Serie de perfiles', serieP] as [string, string]] : []),
    ['Apertura', apertura],
    ...(herraje ? [['Herrajes', herraje] as [string, string]] : []),
    ...(vidrio ? [['Vidrios', vidrio] as [string, string]] : []),
  ];
  // Tabla de metadatos a todo el ancho de la tarjeta, sin grilla -- el
  // documento de referencia distingue las filas con una banda de color
  // alternada (zebra), no con líneas divisorias entre celdas.
  const metaRowsHtml = metaFilas.map(([label, value], i) => `
    <tr style="background:${i % 2 === 0 ? HEX.zebra : '#ffffff'};">
      <td style="padding:4px 10px;color:${HEX.gris};width:150px;font-size:9px;">${escapeHtml(label)}:</td>
      <td style="padding:4px 10px;color:${HEX.navy};font-weight:bold;font-size:9px;">${escapeHtml(value)}</td>
    </tr>`).join('');
  const observacionRowHtml = v.comentarioPresupuesto ? `
    <tr style="background:${metaFilas.length % 2 === 0 ? HEX.zebra : '#ffffff'};">
      <td style="padding:4px 10px;color:${HEX.gris};width:150px;font-size:9px;vertical-align:top;">Observación:</td>
      <td style="padding:4px 10px;color:${HEX.navy};font-weight:bold;font-size:9px;">${escapeHtml(v.comentarioPresupuesto)}</td>
    </tr>` : '';

  const precio = preciosVenta.get(v.id);
  const png = pngPorVentana.get(v.id);

  // spacing:false se usa en las páginas "llenas" (3 tarjetas en la portada,
  // 4 en las siguientes) -- ahí el espacio entre tarjetas lo pone el `gap`
  // del contenedor flex del que la tarjeta es un item (flex:1 1 0, para
  // ocupar el 100% del alto de la página, sin la franja de espacio en
  // blanco al final que quedaba con el flujo natural). En la última
  // página (con menos ventanas que el cupo) se sigue usando el flujo
  // natural de siempre -- spacing:true -- para que esas tarjetas NO se
  // estiren y queden del mismo tamaño que en cualquier página llena.
  const spacing = opts.spacing !== false;
  return `
  <div style="border:1px solid ${HEX.borde};${spacing ? 'margin-bottom:10px;' : ''}flex:1 1 0;min-height:0;overflow:hidden;page-break-inside:avoid;">
    <div style="background:${HEX.headBg};padding:6px 12px;font-size:12px;font-weight:bold;color:${HEX.navy};">${escapeHtml(v.modelo)} -</div>
    <table style="width:100%;border-collapse:collapse;">${metaRowsHtml}</table>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr>
        <td style="width:56%;padding:8px 10px 8px 12px;vertical-align:top;">
          ${png ? `<img src="${png}" style="max-width:230px;max-height:165px;width:auto;height:auto;display:block;" />` : ''}
        </td>
        <td style="width:44%;vertical-align:top;padding:8px 12px 8px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td colspan="2" style="background:${HEX.headBg};font-weight:bold;padding:8px 10px;font-size:9px;color:${HEX.navy};">Valores comerciales</td></tr>
            <tr><td style="padding:8px 10px;font-size:9px;color:${HEX.gris};border-bottom:1px solid ${HEX.borde};">Precio unitario neto</td><td style="padding:8px 10px;font-size:9px;text-align:right;color:${HEX.navy};border-bottom:1px solid ${HEX.borde};">${escapeHtml(ufLabel(precio?.precioUnitarioCLP || 0, tasaUf))}</td></tr>
            <tr><td style="padding:8px 10px;font-size:9px;color:${HEX.gris};border-bottom:1px solid ${HEX.borde};">Cantidad</td><td style="padding:8px 10px;font-size:9px;text-align:right;color:${HEX.navy};border-bottom:1px solid ${HEX.borde};">${v.unidades} unidad(es)</td></tr>
            <tr><td style="padding:8px 10px;font-size:9px;color:${HEX.navy};font-weight:bold;border-bottom:1px solid ${HEX.borde};">Total neto</td><td style="padding:8px 10px;font-size:9px;text-align:right;font-weight:bold;color:${HEX.navy};border-bottom:1px solid ${HEX.borde};">${escapeHtml(ufLabel(precio?.precioVentaCLP || 0, tasaUf))}</td></tr>
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

  const logoImg = logoDataUrl ? `<img src="${logoDataUrl}" style="width:92px;height:42px;display:block;margin-bottom:12px;" />` : '';
  // En el documento de referencia el logo de Muchtek (Tecnoperfiles Group,
  // el proveedor del perfil) va arriba a la derecha, a la misma altura
  // que el logo de MTW -- solo en la primera página.
  const logosHeaderHtml = logoMuchtekDataUrl
    ? `<table style="width:100%;margin-bottom:12px;"><tr>
        <td style="vertical-align:top;">${logoImg}</td>
        <td style="vertical-align:top;text-align:right;"><img src="${logoMuchtekDataUrl}" style="width:120px;height:auto;display:inline-block;" /></td>
      </tr></table>`
    : logoImg;

  const cardHtml = (v: Ventana, spacing?: boolean) => buildCardHtml(v, { preciosVenta, pngPorVentana, tasaUf }, { spacing });

  // Encabezado completo (primera página): logo, "Oferta Cliente" como
  // título, línea divisoria, "Presupuesto - X / Fecha", "Cliente:",
  // "Obra:", saludo y párrafo de presentación -- igual al documento de
  // referencia.
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
      <div style="font-size:10px;font-weight:bold;color:${HEX.navy};margin-bottom:4px;">Cliente: ${escapeHtml(clienteNombre)}</div>
      <div style="font-size:10px;font-weight:bold;color:${HEX.navy};margin-bottom:16px;">Obra: ${escapeHtml(proyecto.obra)}</div>
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

  // Paginado manual: 3 tarjetas en la portada (comparte espacio con el
  // encabezado completo), 4 en cada página siguiente -- pedido explícito
  // para no dejar la franja de espacio en blanco que quedaba con el flujo
  // natural cuando entraban menos tarjetas de las que cabían físicamente.
  // Todas las páginas MENOS LA ÚLTIMA están garantizadas "llenas" (llegan
  // al cupo, si no la siguiente tarjeta hubiese entrado en esta) y usan
  // flex:1 en cada tarjeta para repartir el alto completo de la página
  // (1006px = 1056px carta - 32px margen superior - 18px inferior, el
  // mismo margen que aplica renderHtmlToPdfConCabecera en el relay a
  // AMBOS renders -- portada y con cabecera -- así que este número es el
  // real, no un valor aproximado). La ÚLTIMA página (la que puede traer
  // menos tarjetas que el cupo) sigue el flujo natural de siempre --
  // tarjetas a su tamaño normal, sin estirar -- para que no queden más
  // grandes que en el resto del documento.
  const CUPO_PORTADA = 3;
  const CUPO_SIGUIENTE = 4;
  const ALTO_UTIL_PAGINA = 1006;

  const paginas: Ventana[][] = [];
  paginas.push(ventanas.slice(0, CUPO_PORTADA));
  for (let i = CUPO_PORTADA; i < ventanas.length; i += CUPO_SIGUIENTE) {
    paginas.push(ventanas.slice(i, i + CUPO_SIGUIENTE));
  }

  const paginasLlenasHtml = paginas.slice(0, -1).map((cardsPagina, idx) => {
    const esPortada = idx === 0;
    const tarjetasHtml = cardsPagina.map((v) => cardHtml(v, false)).join('');
    const cardsWrapHtml = `
      <div style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:10px;padding:0 42px 6px 42px;">
        ${tarjetasHtml}
      </div>`;
    return `
      <div style="width:100%;height:${ALTO_UTIL_PAGINA}px;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;font-family:Helvetica,Arial,sans-serif;background:#ffffff;page-break-after:always;">
        ${esPortada ? headerCompletoHtml : ''}
        ${cardsWrapHtml}
      </div>`;
  }).join('');

  const ultimaPagina = paginas[paginas.length - 1];
  const ultimaEsPortada = paginas.length === 1;
  const ultimaPaginaHtml = `
    <div style="width:100%;font-family:Helvetica,Arial,sans-serif;background:#ffffff;">
      ${ultimaEsPortada ? headerCompletoHtml : ''}
      <div style="padding:0 42px 6px 42px;">
        ${ultimaPagina.map((v) => cardHtml(v, true)).join('')}
        ${resumenHtml}
      </div>
    </div>`;

  const contenidoVentanasHtml = paginasLlenasHtml + ultimaPaginaHtml;

  const condicionesHtml = condiciones.trim() ? `
    <div style="width:100%;font-family:Helvetica,Arial,sans-serif;background:#ffffff;page-break-before:always;">
      <div style="height:4px;background:${HEX.rojo};"></div>
      <div style="padding:20px 42px 0 42px;">
        ${logoImg}
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
  const { proyecto } = params;
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

  const footerTemplate = `
    <div style="width:100%;padding:0 42px;font-family:Helvetica,Arial,sans-serif;">
      <div style="border-top:1px solid ${HEX.borde};margin-bottom:4px;"></div>
      <div style="font-size:8px;color:${HEX.gris};">${escapeHtml(codigoLabel)}</div>
    </div>`;

  return { headerTemplate, footerTemplate };
}
