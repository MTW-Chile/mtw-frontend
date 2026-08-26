import { describe, it, expect } from 'vitest';
import { toWindowLine, toCoreLine } from '../ventanaAdapter';
import * as core from '../legacyGeometryCore';
import { ventana, geometria } from './fixtures';

describe('toWindowLine + toCoreLine — contrato con el núcleo', () => {
  // A1: el núcleo lee snake_case. Si algún día alguien vuelve a pasarle un
  // WindowLine (camelCase) directo a core.*, este test lo detecta: la
  // apertura real (32, corredera) no debe degradar a 0 (fija).
  it('la apertura real llega al núcleo aunque no haya filas geometria tipo 3', () => {
    const v = ventana({
      lineaHetmo: 101,
      modelo: 'Advance',
      unidades: 2,
      anchoMm: 1500,
      altoMm: 1200,
      numeroCuadrosHojas: 2,
      dibujoTipoApertura: 32,
      acabadoCodigo: 'NO',
      geometrias: [],
    });
    const coreLine = toCoreLine(toWindowLine(v)!);
    const leaves = core.leavesFor(coreLine) as { kind: string; apertura: number }[];
    expect(leaves.map(l => l.kind)).toEqual(['ext:right', 'int:left']);
    expect(leaves.every(l => l.apertura === 32)).toBe(true);
  });

  it('apertureLabel resuelve el nombre real, no "Ventana fija" por defecto', () => {
    const v = ventana({ dibujoTipoApertura: 32, unidades: 1 });
    const coreLine = toCoreLine(toWindowLine(v)!);
    expect(core.apertureLabel(coreLine)).toBe('Corredera 2 hojas derecha');
  });
});

describe('toRawGeometry — nivel 1 (columnas tipadas)', () => {
  // A3: los modificadores de forma son desplazamientos con signo, no
  // dimensiones. Un trapecio con modificador negativo no debe perderse.
  it('conserva modificadorX/Y negativos (trapecios) y forma_codigo 0', () => {
    const v = ventana({
      geometrias: [
        geometria({ ordenGeometria: 1, tipoElemento: 1, anchoMm: 1000, altoMm: 1000 }),
        geometria({ ordenGeometria: 2, tipoElemento: 10001, formaCodigo: '0', modificadorX: -300, modificadorY: 0 }),
      ],
    });
    const line = toWindowLine(v)!;
    const mod = line.geometria![1] as Record<string, unknown>;
    expect(mod.modificador_x).toBe(-300);
    expect(mod.forma_codigo).toBe(0);
  });

  // A4: numero_ventana debe salir de perteneceHueco, nunca de posicion
  // (que en HETMO significa la posición de la hoja dentro del hueco).
  it('numero_ventana usa perteneceHueco, no posicion', () => {
    const v = ventana({
      geometrias: [geometria({ tipoElemento: 3, perteneceHueco: 2, posicion: 5 })],
    });
    const row = toWindowLine(v)!.geometria![0] as Record<string, unknown>;
    expect(row.numero_ventana).toBe(2);
  });

  it('numeroHoja y carril tipados tienen prioridad sobre parametrosJson', () => {
    const v = ventana({
      geometrias: [
        geometria({
          tipoElemento: 40001,
          numeroHoja: 2,
          carril: 1,
          parametrosJson: { numero_hoja: 99, carril: 99 },
        }),
      ],
    });
    const row = toWindowLine(v)!.geometria![0] as Record<string, unknown>;
    expect(row.numero_hoja).toBe(2);
    expect(row.carril).toBe(1);
  });
});

describe('toRawGeometry — nivel 2 (parametrosJson)', () => {
  it('lee barrotillos, bh_*, cota, geometria_n1/n2, altura_manilla y curvatura desde parametrosJson', () => {
    const v = ventana({
      geometrias: [
        geometria({
          tipoElemento: 40000,
          parametrosJson: {
            barrotillos_horizontales: 1,
            barrotillos_verticales: 2,
            bh_numero_travesano: 1,
            bh_x_inicio: 0,
            bh_y_inicio: 1438,
            bh_x_fin: 842,
            bh_y_fin: 1438,
            cota: 500,
            geometria_n1: 1,
            geometria_n2: 1500,
            altura_manilla: 1020,
            radio_curvatura: 500,
            angulo_curvatura: 360,
          },
        }),
      ],
    });
    const row = toWindowLine(v)!.geometria![0] as Record<string, unknown>;
    expect(row.barrotillos_horizontales).toBe(1);
    expect(row.barrotillos_verticales).toBe(2);
    expect(row.bh_numero_travesano).toBe(1);
    expect(row.bh_y_inicio).toBe(1438);
    expect(row.cota).toBe(500);
    expect(row.geometria_n1).toBe(1);
    expect(row.geometria_n2).toBe(1500);
    expect(row.altura_manilla).toBe(1020);
    expect(row.radio_curvatura).toBe(500);
    expect(row.angulo_curvatura).toBe(360);
  });

  it('una fila sin parametrosJson (datos previos al backfill) no rompe el mapeo', () => {
    const v = ventana({
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: 32, anchoMm: 1500, altoMm: 1200, posicion: 1 })],
    });
    expect(() => toWindowLine(v)).not.toThrow();
    const row = toWindowLine(v)!.geometria![0] as Record<string, unknown>;
    expect(row.cota).toBeUndefined();
    expect(row.altura_manilla).toBeNull(); // toFiniteOrNull(undefined) => null
  });
});

describe('assignPanelNumbers — inferencia de numero_ventana cuando perteneceHueco falta', () => {
  it('infiere paños a partir de items tipo 10000 cuando hay 2 o más', () => {
    const v = ventana({
      anchoMm: 1200,
      altoMm: 1800,
      geometrias: [
        geometria({ ordenGeometria: 1, tipoElemento: 10000, anchoMm: 1200, altoMm: 600 }),
        geometria({ ordenGeometria: 2, tipoElemento: 3, tipoApertura: 23, anchoMm: 1200, altoMm: 600 }),
        geometria({ ordenGeometria: 3, tipoElemento: 10000, anchoMm: 1200, altoMm: 1200 }),
        geometria({ ordenGeometria: 4, tipoElemento: 3, tipoApertura: 0, anchoMm: 1200, altoMm: 1200 }),
      ],
    });
    const coreLine = toCoreLine(toWindowLine(v)!);
    const composite = core.compositePanels(coreLine) as { panels: { number: number }[] } | null;
    expect(composite).not.toBeNull();
    expect(composite!.panels.map(p => p.number)).toEqual([1, 2]);
  });

  // D3 caso 2: un único valor de perteneceHueco no alcanza para confiar en él
  // directamente (podría ser un dato suelto de una sola fila); se sigue
  // infiriendo por items tipo 10000 en vez de aceptar un solo paño.
  it('un solo perteneceHueco declarado no corta la inferencia por items tipo 10000', () => {
    const v = ventana({
      anchoMm: 1200,
      altoMm: 1800,
      geometrias: [
        geometria({ ordenGeometria: 1, tipoElemento: 10000, anchoMm: 1200, altoMm: 600 }),
        geometria({ ordenGeometria: 2, tipoElemento: 3, tipoApertura: 23, anchoMm: 1200, altoMm: 600, perteneceHueco: 1 }),
        geometria({ ordenGeometria: 3, tipoElemento: 10000, anchoMm: 1200, altoMm: 1200 }),
        geometria({ ordenGeometria: 4, tipoElemento: 3, tipoApertura: 0, anchoMm: 1200, altoMm: 1200 }),
      ],
    });
    const coreLine = toCoreLine(toWindowLine(v)!);
    const composite = core.compositePanels(coreLine) as { panels: { number: number }[] } | null;
    expect(composite).not.toBeNull();
    expect(composite!.panels.map(p => p.number)).toEqual([1, 2]);
  });

  // D3 caso 3: perteneceHueco === 0 no identifica un paño real en HETMO
  // (significa "sin asignar"), así que no debe contarse como valor distinto.
  it('perteneceHueco === 0 se trata como ausente, no como paño 0', () => {
    const v = ventana({
      anchoMm: 1200,
      altoMm: 1800,
      geometrias: [
        geometria({ ordenGeometria: 1, tipoElemento: 10000, anchoMm: 1200, altoMm: 600 }),
        geometria({ ordenGeometria: 2, tipoElemento: 3, tipoApertura: 23, anchoMm: 1200, altoMm: 600, perteneceHueco: 0 }),
        geometria({ ordenGeometria: 3, tipoElemento: 10000, anchoMm: 1200, altoMm: 1200 }),
        geometria({ ordenGeometria: 4, tipoElemento: 3, tipoApertura: 0, anchoMm: 1200, altoMm: 1200, perteneceHueco: 0 }),
      ],
    });
    const coreLine = toCoreLine(toWindowLine(v)!);
    const composite = core.compositePanels(coreLine) as { panels: { number: number }[] } | null;
    expect(composite).not.toBeNull();
    expect(composite!.panels.map(p => p.number)).toEqual([1, 2]);
  });

  it('confía en perteneceHueco cuando hay al menos 2 valores distintos declarados', () => {
    const v = ventana({
      anchoMm: 1200,
      altoMm: 1800,
      geometrias: [
        geometria({ ordenGeometria: 1, tipoElemento: 10000, anchoMm: 1200, altoMm: 600, perteneceHueco: 1 }),
        geometria({ ordenGeometria: 2, tipoElemento: 3, tipoApertura: 23, anchoMm: 1200, altoMm: 600, perteneceHueco: 1 }),
        geometria({ ordenGeometria: 3, tipoElemento: 10000, anchoMm: 1200, altoMm: 1200, perteneceHueco: 2 }),
        geometria({ ordenGeometria: 4, tipoElemento: 3, tipoApertura: 0, anchoMm: 1200, altoMm: 1200, perteneceHueco: 2 }),
      ],
    });
    const coreLine = toCoreLine(toWindowLine(v)!);
    const composite = core.compositePanels(coreLine) as { panels: { number: number }[] } | null;
    expect(composite).not.toBeNull();
    expect(composite!.panels.map(p => p.number)).toEqual([1, 2]);
  });

  // D3 caso 1: tipoElemento sin normalizar (string en vez de number) no debe
  // impedir la inferencia por items tipo 10000.
  it('detecta paños aunque tipoElemento llegue como string', () => {
    const v = ventana({
      anchoMm: 1000,
      altoMm: 2800, // dos paños de 1400 apilados verticalmente
      geometrias: [
        geometria({ ordenGeometria: 1, tipoElemento: 10000 as unknown as number, anchoMm: 1000, altoMm: 1400 }),
        geometria({ ordenGeometria: 2, tipoElemento: 3, tipoApertura: 10, anchoMm: 1000, altoMm: 1400 }),
        geometria({ ordenGeometria: 3, tipoElemento: 10000 as unknown as number, anchoMm: 1000, altoMm: 1400 }),
        geometria({ ordenGeometria: 4, tipoElemento: 3, tipoApertura: 0, anchoMm: 1000, altoMm: 1400 }),
      ],
    });
    const coreLine = toCoreLine(toWindowLine(v)!);
    const composite = core.compositePanels(coreLine) as { panels: unknown[] } | null;
    expect(composite?.panels.length).toBe(2);
  });
});

describe('toWindowLine — regresión ventana simple', () => {
  it('ventana fija sin geometría no rompe y resuelve apertura 0', () => {
    const v = ventana({ dibujoTipoApertura: 0 });
    const coreLine = toCoreLine(toWindowLine(v)!);
    expect(core.apertureLabel(coreLine)).toBe('Ventana fija');
  });
});
