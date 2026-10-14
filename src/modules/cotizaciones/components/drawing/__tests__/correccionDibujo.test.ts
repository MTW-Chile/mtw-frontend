import { describe, it, expect } from 'vitest';
import { toWindowLine } from '../ventanaAdapter';
import { buildWindow } from '../windowGeometryBuilder';
import * as core from '../geometryCore';
import { ventana, geometria } from './fixtures';
import { correccionConCambios } from '../../../steps/Step2Lineas/correccionDibujo';

const puerta = (extra = {}) => ventana({
  anchoMm: 900, altoMm: 2100, dibujoTipoApertura: 18, acabadoCodigo: 'NO',
  geometrias: [geometria({ tipoElemento: 3, tipoApertura: 18, anchoMm: 900, altoMm: 2100, posicion: 1 })],
  ...extra,
});
const conCorreccion = (c: object) => ({ correccionGeometria: { esquema: 2, lineaHetmo: 1, apertura: 18, hojas: [], ...c } } as never);
const transoms = (svg: string) => (svg.match(/class="window-transom"/g) || []).length;

describe('mirroredAperture', () => {
  it('espeja la mano dentro de la misma familia y cantidad de hojas', () => {
    expect(core.mirroredAperture(3)).toBe(4);
    expect(core.mirroredAperture(18)).toBe(17);
    expect(core.mirroredAperture(20)).toBe(21);
    expect(core.mirroredAperture(14)).toBe(13);
  });
  it('no inventa espejo para fijas, abatibles ni correderas', () => {
    expect(core.mirroredAperture(0)).toBeNull();
    expect(core.mirroredAperture(22)).toBeNull();
    expect(core.mirroredAperture(32)).toBeNull();
    expect(core.mirroredAperture(999)).toBeNull();
  });
});

describe('invertirMano', () => {
  it('cambia la apertura de la puerta al código espejo', () => {
    const line = toWindowLine(puerta(conCorreccion({ invertirMano: true })))!;
    expect(core.sourceComponents(line)[0].apertura).toBe(17);
    expect(buildWindow(line, 'line').apertureCodes).toEqual([17]);
  });
  it('sin invertirMano la apertura de HETMO queda intacta', () => {
    expect(core.sourceComponents(toWindowLine(puerta())!)[0].apertura).toBe(18);
  });
  it('una corrección sin hojas no reemplaza la apertura de HETMO', () => {
    const line = toWindowLine(puerta(conCorreccion({ apertura: 0 })))!;
    expect(core.sourceComponents(line)[0].apertura).toBe(18);
  });
});

describe('travesaños manuales', () => {
  const sinTravesanos = transoms(buildWindow(toWindowLine(puerta())!, 'line').svg);

  it('agrega un travesaño horizontal en una línea de un solo paño', () => {
    const v = puerta(conCorreccion({ travesanos: [{ eje: 'horizontal', cota: 1000 }] }));
    expect(transoms(buildWindow(toWindowLine(v)!, 'line').svg)).toBe(sinTravesanos + 1);
  });

  it('mide la cota desde arriba (y=0 es la base en el espacio del núcleo)', () => {
    const line = { correccionGeometria: { travesanos: [{ eje: 'horizontal', cota: 700 }] } };
    expect(core.manualTraverseLines(line, null, 900, 2100, [])).toEqual([{ x1: 0, y1: 1400, x2: 900, y2: 1400 }]);
  });

  it('no duplica un travesaño que HETMO ya trae', () => {
    const line = { correccionGeometria: { travesanos: [{ eje: 'horizontal', cota: 700 }] } };
    expect(core.manualTraverseLines(line, null, 900, 2100, [{ x1: 0, y1: 1401, x2: 900, y2: 1401 }])).toEqual([]);
  });

  it('descarta cotas fuera del paño y filtra por paño', () => {
    const line = { correccionGeometria: { travesanos: [
      { eje: 'horizontal', cota: 2100 }, { eje: 'vertical', cota: 0 }, { eje: 'horizontal', cota: 500, panel: 2 },
    ] } };
    expect(core.manualTraverseLines(line, null, 900, 2100, [])).toEqual([]);
    expect(core.manualTraverseLines(line, 1, 900, 2100, [])).toEqual([]);
    expect(core.manualTraverseLines(line, 2, 900, 2100, [])).toHaveLength(1);
  });

  it('en una ventana fija dibuja el vertical', () => {
    const fija = ventana({ anchoMm: 1500, altoMm: 1200, dibujoTipoApertura: 0, acabadoCodigo: 'NO', geometrias: [] });
    const base = transoms(buildWindow(toWindowLine(fija)!, 'line').svg);
    const con = ventana({ anchoMm: 1500, altoMm: 1200, dibujoTipoApertura: 0, acabadoCodigo: 'NO', geometrias: [],
      ...conCorreccion({ apertura: 0, travesanos: [{ eje: 'vertical', cota: 750 }] }) });
    expect(transoms(buildWindow(toWindowLine(con)!, 'line').svg)).toBe(base + 1);
  });
});

describe('correccionConCambios', () => {
  it('conserva las hojas de corredera al agregar travesaños', () => {
    const v = ventana(conCorreccion({ apertura: 32, hojas: [{ indice: 0, ancho: 700, carril: 1, movimiento: 'izquierda' }] }));
    const c = correccionConCambios(v, { travesanos: [{ eje: 'horizontal', cota: 500 }] })!;
    expect(c.hojas).toHaveLength(1);
    expect(c.apertura).toBe(32);
    expect(c.travesanos).toHaveLength(1);
  });
  it('devuelve null (eliminar) cuando no queda nada que corregir', () => {
    const v = ventana(conCorreccion({ invertirMano: true }));
    expect(correccionConCambios(v, { invertirMano: false })).toBeNull();
  });
});
