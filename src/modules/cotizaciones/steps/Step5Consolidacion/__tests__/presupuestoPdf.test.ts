import { describe, it, expect } from 'vitest';
import { cropSvgToContent } from '../presupuestoPdf';

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
