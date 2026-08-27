import { describe, it, expect } from 'vitest';
import { toWindowLine } from '../ventanaAdapter';
import { buildWindow } from '../windowGeometryBuilder';
import * as core from '../geometryCore';
import { ventana, geometria, materialDescrito } from './fixtures';

/**
 * Tests de integración: Ventana (API) -> buildWindow() -> RenderResult.
 * Cada caso fija en el tiempo un comportamiento verificado manualmente
 * durante los pasos 1 y 4 de la refactorización del renderizador.
 */

describe('buildWindow — regresión del fix A1 (el núcleo lee WindowLine directamente)', () => {
  it('corredera 32 sin filas geometria tipo 3 dibuja la apertura real, no fija', () => {
    const v = ventana({
      lineaHetmo: 101,
      modelo: 'Advance',
      unidades: 2,
      anchoMm: 1500,
      altoMm: 1200,
      numeroCuadrosHojas: 2,
      dibujoTipoApertura: 32,
      acabadoCodigo: 'NO',
      materiales: [materialDescrito('CARRO VENTO SIMP VE180', { cantidad: 8, piezas: 8 })],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.apertureCodes).toEqual([32]);
    expect(result.apertureLabel).toBe('Corredera 2 hojas derecha');
  });

  it('compuesta con perteneceHueco ausente detecta los 2 paños', () => {
    const v = ventana({
      anchoMm: 1200,
      altoMm: 1800,
      dibujoTipoApertura: 23,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({ ordenGeometria: 1, tipoElemento: 10000, anchoMm: 1200, altoMm: 600 }),
        geometria({ ordenGeometria: 2, tipoElemento: 3, tipoApertura: 23, anchoMm: 1200, altoMm: 600 }),
        geometria({ ordenGeometria: 3, tipoElemento: 10000, anchoMm: 1200, altoMm: 1200 }),
        geometria({ ordenGeometria: 4, tipoElemento: 3, tipoApertura: 0, anchoMm: 1200, altoMm: 1200 }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.apertureCodes.sort()).toEqual([0, 23]);
  });

  it('ventana fija simple sigue resolviendo apertura 0 (sin regresión)', () => {
    const v = ventana({ dibujoTipoApertura: 0, acabadoCodigo: 'BL' });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.apertureCodes).toEqual([0]);
    expect(result.apertureLabel).toBe('Ventana fija');
  });

  it('practicable con manilla y bisagras genera hardware en el SVG', () => {
    const v = ventana({
      dibujoTipoApertura: 3,
      acabadoCodigo: 'BL',
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: 3, anchoMm: 1000, altoMm: 1000, posicion: 1 })],
      materiales: [
        materialDescrito('MANILLA NEPTUNO F 33MM , NEGRO', { cantidad: 1, piezas: 1 }),
        materialDescrito('BISAGRA REGULABLE 100KG', { cantidad: 2, piezas: 2 }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.apertureCodes).toEqual([3]);
    expect(result.svg).toContain('window-handle');
    expect(result.svg).toContain('window-hinge');
  });
});

describe('buildWindow — nivel 2 vía parametrosJson', () => {
  it('puerta P6 Vista Monseñor: altura_manilla real se refleja en el SVG', () => {
    const v = ventana({
      lineaHetmo: 10332,
      modelo: 'Puerta P6',
      anchoMm: 900,
      altoMm: 2600,
      dibujoTipoApertura: 18,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({
          tipoElemento: 3,
          tipoApertura: 18,
          anchoMm: 900,
          altoMm: 2600,
          posicion: 1,
          parametrosJson: { altura_manilla: 1020 },
        }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).toContain('data-height-source="hetmo-custom"');
  });

  it('barrotillos (2 verticales + 1 horizontal) se dibujan dentro del vidrio', () => {
    const v = ventana({
      anchoMm: 1000,
      altoMm: 1000,
      dibujoTipoApertura: 0,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({
          tipoElemento: 40000,
          anchoMm: 1000,
          altoMm: 1000,
          parametrosJson: { barrotillos_horizontales: 1, barrotillos_verticales: 2 },
        }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    // 3 barrotillos = 3 <line> extra sobre el marco+cotas habituales.
    const lineCount = (result.svg.match(/<line /g) || []).length;
    expect(lineCount).toBeGreaterThanOrEqual(3);
  });

  it('ventana circular (radio/angulo_curvatura) dibuja una elipse, no un rectángulo', () => {
    const v = ventana({
      anchoMm: 1000,
      altoMm: 1000,
      dibujoTipoApertura: 0,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({
          tipoElemento: 1,
          anchoMm: 1000,
          altoMm: 1000,
          parametrosJson: { radio_curvatura: 500, angulo_curvatura: 360 },
        }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).toContain('<ellipse');
  });

  it('corredera V2H1 (N1=1, N2=1500): hoja móvil de 1500mm, fijo de 1162mm', () => {
    const v = ventana({
      anchoMm: 2662,
      altoMm: 1400,
      dibujoTipoApertura: 32,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({
          tipoElemento: 3,
          tipoApertura: 32,
          anchoMm: 2662,
          altoMm: 1400,
          posicion: 1,
          parametrosJson: { geometria_n1: 1, geometria_n2: 1500 },
        }),
      ],
    });
    const leaves = core.leavesFor(toWindowLine(v)!) as { kind: string; width: number }[];
    expect(leaves.map(l => Math.round(l.width))).toEqual([1500, 1162]);
  });

  it('carril explícito en hojas 40001 (apertura 36, Int-Ext-Int) se respeta', () => {
    const v = ventana({
      anchoMm: 4100,
      altoMm: 1400,
      dibujoTipoApertura: 36,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 36, anchoMm: 4100, altoMm: 1400, posicion: 1 }),
        geometria({ tipoElemento: 40001, anchoMm: 1400, altoMm: 1380, numeroHoja: 1, carril: 1 }),
        geometria({ tipoElemento: 40001, anchoMm: 1300, altoMm: 1380, numeroHoja: 2, carril: 2 }),
        geometria({ tipoElemento: 40001, anchoMm: 1400, altoMm: 1380, numeroHoja: 3, carril: 1 }),
      ],
    });
    const leaves = core.leavesFor(toWindowLine(v)!) as { carril: number }[];
    expect(leaves.map(l => l.carril)).toEqual([1, 2, 1]);
  });

  it('travesaño (corte de vidrio) se dibuja con bisel luz/sombra, no una línea plana', () => {
    const v = ventana({
      anchoMm: 670,
      altoMm: 2316,
      dibujoTipoApertura: 18,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 18, anchoMm: 670, altoMm: 2316, posicion: 1 }),
        geometria({ tipoElemento: 40000, numeroHoja: 1, anchoMm: 670, altoMm: 1438, parametrosJson: { codigo_componente: '4/12/4' } }),
        geometria({ tipoElemento: 40000, numeroHoja: 1, anchoMm: 670, altoMm: 878, parametrosJson: { codigo_componente: '4/12/4' } }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    const transomGroup = result.svg.match(/<g class="window-transom">([\s\S]*?)<\/g>/);
    expect(transomGroup).not.toBeNull();
    const lineCount = (transomGroup![1].match(/<line /g) || []).length;
    expect(lineCount).toBeGreaterThanOrEqual(3); // base + realce luz + realce sombra
  });

  it('hoja fija que comparte línea con una practicable dibuja su propio marco (sashMarkup), no solo el junquillo', () => {
    const v = ventana({
      anchoMm: 1800,
      altoMm: 2475,
      dibujoTipoApertura: 3,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 0, anchoMm: 1100, altoMm: 2475, posicion: 1 }),
        geometria({ tipoElemento: 3, tipoApertura: 3, anchoMm: 700, altoMm: 2475, posicion: 2 }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).not.toContain('window-fixed-glazing');
    expect((result.svg.match(/window-sash-profile/g) || []).length).toBe(2);
  });

  it('ventana fija sola sigue usando el junquillo delgado contra el marco (sin regresión)', () => {
    const v = ventana({ dibujoTipoApertura: 0, acabadoCodigo: 'BL' });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).toContain('window-fixed-glazing');
  });

  it('no queda rastro del experimento de sombra de profundidad (drop-shadow)', () => {
    const v = ventana({
      anchoMm: 2662,
      altoMm: 1400,
      dibujoTipoApertura: 32,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({
          tipoElemento: 3,
          tipoApertura: 32,
          anchoMm: 2662,
          altoMm: 1400,
          posicion: 1,
          parametrosJson: { geometria_n1: 1, geometria_n2: 1500 },
        }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).not.toContain('drop-shadow');
  });

  it('una fila sin parametrosJson (previa al backfill) no rompe el dibujo', () => {
    const v = ventana({
      anchoMm: 1500,
      altoMm: 1200,
      dibujoTipoApertura: 32,
      acabadoCodigo: 'NO',
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: 32, anchoMm: 1500, altoMm: 1200, posicion: 1 })],
    });
    expect(() => buildWindow(toWindowLine(v)!, 'line')).not.toThrow();
    expect(buildWindow(toWindowLine(v)!, 'line').apertureCodes).toEqual([32]);
  });
});
