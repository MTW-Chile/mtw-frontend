import { describe, it, expect } from 'vitest';
import * as core from '../geometryCore';

// Paño (tipo 10000) y unión (tipo 5100) como llegan de HETMO: N1 de la unión
// = dónde queda el paño "fin" respecto del "ini" (0 arriba, 1 abajo, 2 derecha, 3 izquierda).
const pano = (n: number, ancho: number, alto: number) => ({ tipo_elemento: 10000, numero_ventana: n, ancho, alto });
const union = (ini: number, fin: number, dir: number) => ({ tipo_elemento: 5100, numero_ventana: 0, unido_inicio: ini, unido_fin: fin, geometria_n1: dir });
const ubicacion = (line: any) => core.compositePanels(line)!.tiles.map((t: any) => [t.panel.number, t.x, t.y, t.width, t.height]);

describe('paños de una ventana compuesta según sus uniones', () => {
  it('v12 de Loma La Cruz: dos paños lado a lado y uno de ancho completo abajo', () => {
    const line = { ancho: 3700, alto: 2510, geometria: [pano(1, 900, 1550), pano(2, 2800, 1550), pano(3, 3700, 960), union(1, 2, 2), union(1, 3, 1)] };
    expect(ubicacion(line)).toEqual([[1, 0, 0, 900, 1550], [2, 900, 0, 2800, 1550], [3, 0, 1550, 3700, 960]]);
  });
  it('V43 de Los Barbechos: arriba, derecha, abajo e izquierda encadenados', () => {
    const line = { ancho: 2600, alto: 3349, geometria: [pano(1, 1700, 1950), pano(2, 900, 1380), pano(3, 900, 570), pano(4, 2600, 1370), union(1, 2, 2), union(2, 3, 1), union(1, 4, 0)] };
    expect(ubicacion(line)).toEqual([[1, 0, 1370, 1700, 1950], [2, 1700, 1370, 900, 1380], [3, 1700, 2750, 900, 570], [4, 0, 0, 2600, 1370]]);
  });
  it('V202 de C_QMr: el paño de la izquierda se pega con dirección 3', () => {
    const line = { ancho: 3235, alto: 1785, geometria: [pano(1, 810, 1084), pano(2, 810, 700), pano(3, 2425, 1785), union(1, 2, 1), union(1, 3, 3)] };
    expect(ubicacion(line)).toEqual([[1, 2425, 0, 810, 1084], [2, 2425, 1084, 810, 700], [3, 0, 0, 2425, 1785]]);
  });
  it('sin uniones sigue el armado por medidas (columnas)', () => {
    const line = { ancho: 1020, alto: 2510, geometria: [pano(1, 1020, 860), pano(2, 1020, 1650)] };
    expect(core.panelsByJoins(core.geometryItemsOf(line), [])).toBeNull();
    expect(core.compositePanels(line)).not.toBeNull();
  });
});
