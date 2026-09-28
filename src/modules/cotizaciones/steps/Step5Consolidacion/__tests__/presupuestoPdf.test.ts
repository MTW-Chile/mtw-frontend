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
});
