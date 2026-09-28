import { describe, it, expect } from 'vitest';
import { cropSvgToContent, buildDocumentoHtml } from '../presupuestoPdf';
import type { Proyecto, Ventana } from '../../../../../types';
import type { PrecioVentaLinea } from '../../../lib/presupuesto';

describe('cropSvgToContent — ventana "con forma" (poliforme) dibujada como <polygon>', () => {
  // windowGeometryBuilder.ts (rama specialOutline) dibuja una ventana con
  // forma ENTERA como un único <polygon>, sin marco <rect> aparte -- ver
  // buildSimpleWindow. Antes del fix, cropSvgToContent no sabía leer
  // <polygon>, así que el viewBox recortado no tenía nada que ver con el
  // trapezoide real (V02A/V02B, "DVH ... CON FORMA").
  it('el viewBox recortado contiene todos los puntos del polígono', () => {
    const svg = `<svg viewBox="0 0 240 178"><polygon class="offer-glass" points="20,20 220,20 220,150 20,60" style="fill:#d8f2f4"/><text x="120" y="170" style="font:700 9px system-ui">1.200 mm</text></svg>`;
    const { svg: recortado } = cropSvgToContent(svg);
    const viewBox = /viewBox="([^"]*)"/.exec(recortado)![1].split(' ').map(Number);
    const [minX, minY, w, h] = viewBox;
    for (const [px, py] of [[20, 20], [220, 20], [220, 150], [20, 60]]) {
      expect(px).toBeGreaterThanOrEqual(minX);
      expect(px).toBeLessThanOrEqual(minX + w);
      expect(py).toBeGreaterThanOrEqual(minY);
      expect(py).toBeLessThanOrEqual(minY + h);
    }
  });

  it('sin el fix (regex sin <polygon>), el recorte ignoraba el polígono por completo', () => {
    // Mismo SVG, pero solo contando <text> como hacía el crop antes del fix
    // -- confirma que el bug era real: el viewBox quedaba angostísimo,
    // muy lejos de cubrir el trapezoide de 20..220 x 20..150.
    const svg = `<svg viewBox="0 0 240 178"><polygon points="20,20 220,20 220,150 20,60"/><text x="120" y="170" style="font:700 9px system-ui">1.200 mm</text></svg>`;
    const soloTexto = svg.replace(/<polygon[^>]*\/?>/, '');
    const { svg: recortadoSinPolygon } = cropSvgToContent(soloTexto);
    const viewBoxSinPolygon = /viewBox="([^"]*)"/.exec(recortadoSinPolygon)![1].split(' ').map(Number);

    const { svg: recortadoConPolygon } = cropSvgToContent(svg);
    const viewBoxConPolygon = /viewBox="([^"]*)"/.exec(recortadoConPolygon)![1].split(' ').map(Number);
    // El ancho real del trapezoide (20..220 = 200) es varias veces más
    // ancho que lo que quedaba contando solo el texto de la cota -- esa
    // brecha es justo el bug: el recorte "sin polygon" ni se acerca al
    // ancho real del dibujo.
    expect(viewBoxConPolygon[2]).toBeGreaterThan(viewBoxSinPolygon[2] * 3);
    expect(viewBoxConPolygon[2]).toBeGreaterThan(190); // ahora sí cubre el ancho real (200 + padding)
  });

  it('también recorta un <ellipse> (ventana circular)', () => {
    const svg = `<svg viewBox="0 0 240 178"><ellipse cx="120" cy="89" rx="80" ry="60" style="fill:#d8f2f4"/></svg>`;
    const { svg: recortado } = cropSvgToContent(svg);
    const [minX, minY, w, h] = /viewBox="([^"]*)"/.exec(recortado)![1].split(' ').map(Number);
    expect(minX).toBeLessThanOrEqual(40);
    expect(minY).toBeLessThanOrEqual(29);
    expect(minX + w).toBeGreaterThanOrEqual(200);
    expect(minY + h).toBeGreaterThanOrEqual(149);
  });
});

describe('buildDocumentoHtml — el cupo de una página nunca es mayor que las ventanas que le quedan', () => {
  // Confirmado con V21 (Casa La Aurora, 500×1400mm): al quedar UNA sola
  // ventana para la última página, el cupo seguía siendo el máximo (3), así
  // que su alto se calculaba como un TERCIO del alto útil de la página --
  // dejando 2/3 de la página en blanco debajo de una tarjeta artificialmente
  // achicada. El cupo real de una página tiene que ser como máximo cuántas
  // ventanas quedan, no el cupo máximo nominal.
  const ventana = (id: string, modelo: string, anchoMm: number, altoMm: number): Ventana =>
    ({ id, modelo, descripcionCorta: 'Línea Efficient', anchoMm, altoMm, unidades: 1, acabadoCodigo: '7310', materiales: [], comentarioPresupuesto: null }) as unknown as Ventana;

  it('una sola ventana en la última página recibe TODO el alto disponible, no un tercio', () => {
    // 2 en portada (cupo 2) + 3 en la siguiente (cupo 3) + 1 sola al final.
    const ventanas = [
      ventana('a', 'V1', 1200, 1350), ventana('b', 'V2', 1200, 1550),
      ventana('c', 'V3', 1200, 1350), ventana('d', 'V4', 1200, 1550), ventana('e', 'V5', 1200, 1350),
      ventana('f', 'V21', 500, 1400),
    ];
    const pngPorVentana = new Map(ventanas.map((v) => [v.id, 'data:image/png;base64,AA==']));
    const preciosVenta = new Map<string, PrecioVentaLinea>(ventanas.map((v) => [v.id, { precioUnitarioCLP: 1, precioVentaCLP: 1 }]));
    const html = buildDocumentoHtml({
      proyecto: { obra: 'TEST', codigoInterno: 'T', numeroPresupuesto: 1 } as unknown as Proyecto,
      ventanas, texto: '', condiciones: '', venta: 1, iva: 1, totalConIva: 1, ivaPct: 19, tasaUf: 38500,
      logoDataUrl: null, logoMuchtekDataUrl: null, preciosVenta, pngPorVentana,
    });
    // La tarjeta de V21 (la única en su página) declara su alto real vía
    // height:...px en el div de la tarjeta -- si el cupo se calculó mal
    // (3 en vez de 1), ese alto sale ~1/3 del útil de página (~326px); si
    // se calculó bien, sale prácticamente el alto útil completo (~900+px,
    // descontando el resumen de totales que comparte esa misma página).
    const idxV21 = html.indexOf('V21');
    const inicioTarjeta = html.lastIndexOf('<div style="border:1px solid', idxV21);
    const alturaTarjeta = Number(/height:(\d+)px/.exec(html.slice(inicioTarjeta, inicioTarjeta + 200))![1]);
    expect(alturaTarjeta).toBeGreaterThan(500);
  });

  it('una ventana ANCHA y BAJA sola en la última página NO recibe todo el alto disponible (no infla una caja vacía)', () => {
    // Regresión: el fix de arriba (dar el alto disponible completo a una
    // tarjeta sola) reventó con L01 (Casa La Aramoni, 800×500mm) -- ancha y
    // baja, el ANCHO es lo que fija su escala, no el alto, así que darle
    // TODO el alto disponible (igual que a V21) no agranda su dibujo en
    // nada: solo deja una caja casi vacía ocupando casi toda la página.
    // El alto de la tarjeta tiene que ser el que el CONTENIDO (dibujo a la
    // escala que le tocó + filas de texto) necesita de verdad, acotado por
    // el slot -- nunca forzado a ocupar todo el slot si no lo necesita.
    const ventanas = [
      ventana('a', 'V1', 1200, 1350), ventana('b', 'V2', 1200, 1550),
      ventana('c', 'V3', 1200, 1350), ventana('d', 'V4', 1200, 1550), ventana('e', 'V5', 1200, 1350),
      ventana('f', 'L01', 800, 500),
    ];
    const pngPorVentana = new Map(ventanas.map((v) => [v.id, 'data:image/png;base64,AA==']));
    const preciosVenta = new Map<string, PrecioVentaLinea>(ventanas.map((v) => [v.id, { precioUnitarioCLP: 1, precioVentaCLP: 1 }]));
    const html = buildDocumentoHtml({
      proyecto: { obra: 'TEST', codigoInterno: 'T', numeroPresupuesto: 1 } as unknown as Proyecto,
      ventanas, texto: '', condiciones: '', venta: 1, iva: 1, totalConIva: 1, ivaPct: 19, tasaUf: 38500,
      logoDataUrl: null, logoMuchtekDataUrl: null, preciosVenta, pngPorVentana,
    });
    const idxL01 = html.indexOf('L01');
    const inicioTarjeta = html.lastIndexOf('<div style="border:1px solid', idxL01);
    const alturaTarjeta = Number(/height:(\d+)px/.exec(html.slice(inicioTarjeta, inicioTarjeta + 200))![1]);
    // Una tarjeta ancha-baja normal (con sus 3 filas de texto + el piso de
    // la caja de valores) no pasa de ~300px de alto real -- si el bug
    // reaparece, esto sale en 800+ (el alto útil casi completo de la página).
    expect(alturaTarjeta).toBeLessThan(400);
  });
});

describe('buildDocumentoHtml — una ventana angosta no queda ilegible por compartir página con una ventana alta', () => {
  // Regresión real: Casa La Aurora, presupuesto 1679-3. V21 (500×1400mm)
  // terminaba en un rectángulo de ~40×112px, perdido en su celda, al
  // compartir página (cupo 3, full) con V19 (2500×1800mm) y sobre todo V20
  // (2000×2600mm) -- la escala COMÚN de la página la fija la ventana más
  // alta (V20), y V21 hereda esa misma escala reducida aunque su propia
  // altura (1400mm) no la necesite. altoMinimoTarjeta (el único freno que
  // existía para bajar el cupo de una página) solo mira que el TEXTO entre
  // sin cortarse -- un dibujo de 40×112px pasa esa vara sin problema y
  // queda igual de ilegible. Ahora el cupo también baja si la escala común
  // resultante dejaría a alguna ventana del grupo por debajo del piso de
  // legibilidad (ver escalaEsLegible).
  const ventana = (id: string, modelo: string, anchoMm: number, altoMm: number): Ventana =>
    ({ id, modelo, descripcionCorta: 'Línea Efficient', anchoMm, altoMm, unidades: 1, acabadoCodigo: '7310', materiales: [], comentarioPresupuesto: null }) as unknown as Ventana;

  it('la página se parte en vez de dejar a la ventana angosta con un dibujo ilegible', () => {
    const ventanas = [
      ventana('a', 'V1', 1200, 1350), ventana('b', 'V2', 1200, 1550),
      ventana('c', 'V19', 2500, 1800), ventana('d', 'V20', 2000, 2600), ventana('e', 'V21', 500, 1400),
    ];
    const pngPorVentana = new Map(ventanas.map((v) => [v.id, 'data:image/png;base64,AA==']));
    const preciosVenta = new Map<string, PrecioVentaLinea>(ventanas.map((v) => [v.id, { precioUnitarioCLP: 1, precioVentaCLP: 1 }]));
    const html = buildDocumentoHtml({
      proyecto: { obra: 'TEST', codigoInterno: 'T', numeroPresupuesto: 1 } as unknown as Proyecto,
      ventanas, texto: '', condiciones: '', venta: 1, iva: 1, totalConIva: 1, ivaPct: 19, tasaUf: 38500,
      logoDataUrl: null, logoMuchtekDataUrl: null, preciosVenta, pngPorVentana,
    });
    const idxV21 = html.indexOf('>V21<');
    const inicioTarjeta = html.lastIndexOf('<div style="border:1px solid', idxV21);
    const bloque = html.slice(inicioTarjeta, inicioTarjeta + 1400);
    const maxHeightImg = Number(/max-height:(\d+)px/.exec(bloque)![1]);
    // Antes del fix, la escala común (fijada por V20) dejaba a V21 con un
    // dibujo de ~112px de alto -- por debajo del piso de legibilidad. El
    // fix baja el cupo de la página hasta que la escala resultante deje a
    // TODAS las ventanas del grupo, V21 incluida, por encima de ese piso.
    expect(maxHeightImg).toBeGreaterThanOrEqual(150);
  });

  it('la legibilidad nunca aísla una ventana sola en una página casi vacía -- el piso es 2, no 1', () => {
    // Regresión real (Casa La Aurora, 1679-3): V04 (1.250×550mm) caía justo
    // antes de tres ventanas muy altas (V05A/B/C, ~3.300mm). El freno de
    // legibilidad, sin piso, bajaba el cupo de V04 hasta 1 -- la tarjeta de
    // V04 quedaba legible, pero sola en una página de ~900px de alto útil
    // usando solo ~260px: la página entera se veía vacía. La legibilidad
    // ahora nunca baja el cupo de una página hasta 1 por sí sola (piso 2)
    // -- solo el texto que no entra puede hacerlo, porque ahí no hay
    // alternativa.
    const ventanas = [
      ventana('a', 'V1', 1200, 1350), ventana('b', 'V2', 1200, 1550),
      ventana('c', 'V03A', 4100, 3120), ventana('d', 'V03B', 4100, 3120),
      ventana('e', 'V04', 1250, 550),
      ventana('f', 'V05A', 1300, 3320), ventana('g', 'V05B', 1300, 3320), ventana('h', 'V05C', 1200, 3120),
    ];
    const pngPorVentana = new Map(ventanas.map((v) => [v.id, 'data:image/png;base64,AA==']));
    const preciosVenta = new Map<string, PrecioVentaLinea>(ventanas.map((v) => [v.id, { precioUnitarioCLP: 1, precioVentaCLP: 1 }]));
    const html = buildDocumentoHtml({
      proyecto: { obra: 'TEST', codigoInterno: 'T', numeroPresupuesto: 1 } as unknown as Proyecto,
      ventanas, texto: '', condiciones: '', venta: 1, iva: 1, totalConIva: 1, ivaPct: 19, tasaUf: 38500,
      logoDataUrl: null, logoMuchtekDataUrl: null, preciosVenta, pngPorVentana,
    });
    // Toda tarjeta que comparte página con V04 aparece en el mismo bloque
    // "height:1006px" que ella -- si V04 quedó sola, ese bloque no
    // contiene ningún otro modelo.
    const idxV04 = html.indexOf('>V04<');
    const inicioPagina = html.lastIndexOf('height:1006px', idxV04);
    const finPagina = html.indexOf('height:1006px', idxV04 + 1);
    const bloquePagina = html.slice(inicioPagina, finPagina === -1 ? undefined : finPagina);
    const otroModeloEnPagina = ['V03A', 'V03B', 'V05A', 'V05B', 'V05C'].some((m) => bloquePagina.includes(`>${m}<`));
    expect(otroModeloEnPagina).toBe(true);
  });
});
