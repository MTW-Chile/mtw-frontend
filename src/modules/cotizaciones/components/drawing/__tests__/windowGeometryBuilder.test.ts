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

  it('ventana compuesta: cada paño dibuja su propio marco, no uno solo compartido para toda la línea', () => {
    // Confirmado contra el propio dibujo de HETMO: cada paño de una
    // compuesta es un marco físico unido al de al lado, igual que en una
    // ventana simple de varias hojas -- no un solo marco exterior con los
    // paños sueltos por dentro.
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
    expect((result.svg.match(/class="line-window-frame"/g) || []).length).toBe(2);
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

  it('fija + practicable: dos marcos unidos, y la fija no lleva hoja', () => {
    // Una ventana fija es marco + vidrio (sin hoja); la practicable es marco +
    // hoja. Juntas en una línea son dos marcos pegados borde con borde, así
    // que hay 2 marcos pero una sola hoja.
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
    expect((result.svg.match(/class="line-window-frame"/g) || []).length).toBe(2);
    expect((result.svg.match(/window-sash-profile/g) || []).length).toBe(1);
  });

  it('Casa A V13 (10595, 1830x1520, practicable + fija): cada hoja dibuja su propio marco biselado, no una línea divisoria', () => {
    // Confirmado contra el propio dibujo de HETMO para esta línea: se ven
    // dos marcos completos y separados (cada uno con su bisel de esquina),
    // no un solo marco con una línea fina entre las dos hojas.
    const v = ventana({
      anchoMm: 1830,
      altoMm: 1520,
      dibujoTipoApertura: 4,
      acabadoCodigo: 'NO',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 4, anchoMm: 700, altoMm: 1520, posicion: 1 }),
        geometria({ tipoElemento: 3, tipoApertura: 0, anchoMm: 1130, altoMm: 1520, posicion: 2 }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect((result.svg.match(/class="line-window-frame"/g) || []).length).toBe(2);
    expect(result.svg).not.toContain('window-sash-divider');
  });

  it('una corredera de varias hojas sigue con un solo marco compartido (no es "ventanas separadas")', () => {
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
    expect((result.svg.match(/class="line-window-frame"/g) || []).length).toBe(1);
  });

  it('ventana fija sola es marco + vidrio: no lleva hoja', () => {
    const v = ventana({ dibujoTipoApertura: 0, acabadoCodigo: 'BL' });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect((result.svg.match(/class="line-window-frame"/g) || []).length).toBe(1);
    expect(result.svg).not.toContain('window-sash-profile');
  });

  it('practicable de 2 hojas: hojas en paralelo, una sola manilla y sin cerradero oculto', () => {
    // El cerradero (manilla oculta de la hoja pasiva) es exclusivo de las
    // correderas; una practicable de dos hojas lleva una sola manilla.
    const v = ventana({
      anchoMm: 1600,
      altoMm: 1200,
      dibujoTipoApertura: 7,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 7, anchoMm: 1600, altoMm: 1200, posicion: 1 }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect((result.svg.match(/class="line-window-frame"/g) || []).length).toBe(1);
    expect((result.svg.match(/window-sash-profile/g) || []).length).toBe(2);
    expect((result.svg.match(/class="window-handle"/g) || []).length).toBe(1);
    expect(result.svg).not.toContain('window-striker');
  });

  it('línea de puro vidrio (SOLO DVH) se dibuja sin marco ni hoja', () => {
    // Casa A V01 (HETMO 10583, COND. QUILLAYES DE LA DEHESA): la receta trae
    // un único material, el termopanel. Sin perfiles no hay nada que dibujar
    // salvo el vidrio.
    const v = ventana({
      anchoMm: 740,
      altoMm: 2425,
      dibujoTipoApertura: 0,
      acabadoCodigo: '7000',
      materiales: [materialDescrito('DVH 5/12/5 INC', { cantidad: 1, piezas: 1 })],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).not.toContain('line-window-frame');
    expect(result.svg).not.toContain('window-sash-profile');
    expect(result.svg).toContain('line-window-glass');
  });

  it('una receta con herrajes pero sin perfiles NO es una línea de puro vidrio', () => {
    // Receta incompleta, no una venta de termopanel suelto: debe seguir
    // dibujándose con su marco.
    const v = ventana({
      anchoMm: 900,
      altoMm: 1200,
      dibujoTipoApertura: 4,
      acabadoCodigo: 'BL',
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: 4, anchoMm: 900, altoMm: 1200, posicion: 1 })],
      materiales: [materialDescrito('MANILLA NEPTUNO F 33MM , NEGRO', { cantidad: 1, piezas: 1 })],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).toContain('line-window-frame');
  });

  it('composición del vidrio declarada como fila tipo 200 se muestra en el dibujo', () => {
    // Casa A PV02 (HETMO 10581): el único portador de "5/12/5 INC" es una fila
    // tipo_elemento 200 (sin medidas). Mirar sólo las filas 40000 dejaba sin
    // composición de vidrio a todas las líneas de este tipo.
    const v = ventana({
      anchoMm: 870,
      altoMm: 2475,
      dibujoTipoApertura: 18,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 18, anchoMm: 870, altoMm: 2475, posicion: 1 }),
        geometria({ tipoElemento: 200, parametrosJson: { codigo_componente: '5/12/5 INC' } }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).toContain('5/12/5 INC');
  });

  it('herraje blanco sólo con acabado blanco; cualquier otro acabado lo lleva negro', () => {
    const practicable = (acabado: string) => ventana({
      anchoMm: 900,
      altoMm: 1200,
      dibujoTipoApertura: 4,
      acabadoCodigo: acabado,
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: 4, anchoMm: 900, altoMm: 1200, posicion: 1 })],
      // La descripción del artículo ya no decide el color del herraje.
      materiales: [materialDescrito('MANILLA NEPTUNO F 33MM , PLATA', { cantidad: 1, piezas: 1 })],
    });
    const blanco = buildWindow(toWindowLine(practicable('BL'))!, 'line');
    expect(blanco.svg).toContain('#eef1f4');
    expect(blanco.svg).not.toContain('#1c1f24');

    ['NO', 'GRA', '7020', 'NE'].forEach(acabado => {
      const otro = buildWindow(toWindowLine(practicable(acabado))!, 'line');
      expect(otro.svg).toContain('#1c1f24');
      expect(otro.svg).not.toContain('#eef1f4');
    });
  });

  it('la base de la manilla de corredera cabe dentro de la hoja', () => {
    // La manilla es la misma de una puerta, girada hacia abajo: lo que tiene
    // que caber en la hoja es su base (el disco), no la palanca.
    const v = ventana({
      anchoMm: 1200,
      altoMm: 1400,
      dibujoTipoApertura: 32,
      acabadoCodigo: 'NO',
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: 32, anchoMm: 1200, altoMm: 1400, posicion: 1 })],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    const leaves = [...result.svg.matchAll(/data-leaf-x="([\d.]+)" data-leaf-width="([\d.]+)"/g)]
      .map(m => ({ x: Number(m[1]), width: Number(m[2]) }));
    expect(leaves.length).toBeGreaterThan(0);
    const bases = [...result.svg.matchAll(/<g class="window-handle"[\s\S]*?<circle cx="([\d.-]+)" cy="[\d.-]+" r="([\d.]+)"/g)]
      .map(m => ({ cx: Number(m[1]), r: Number(m[2]) }));
    expect(bases.length).toBeGreaterThan(0);
    bases.forEach(base => {
      const leaf = leaves.find(l => base.cx - base.r >= l.x - 0.01 && base.cx + base.r <= l.x + l.width + 0.01);
      expect(leaf).toBeDefined();
    });
  });

  it('el cerradero de la corredera es más chico que la manilla', () => {
    // El cerradero sólo existe cuando dos hojas se encuentran en el MISMO
    // carril (código 44: Fijo-Int-Int-Fijo), no en una corredera de 2 hojas.
    const v = ventana({
      anchoMm: 5200,
      altoMm: 1800,
      dibujoTipoApertura: 44,
      acabadoCodigo: 'NO',
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: 44, anchoMm: 5200, altoMm: 1800, posicion: 1 })],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    const striker = result.svg.match(/<g class="window-striker"[\s\S]*?<rect x="[\d.-]+" y="[\d.-]+" width="([\d.]+)" height="([\d.]+)"/);
    expect(striker).not.toBeNull();
    // La barra del cerradero no puede superar el diámetro de la base de la
    // manilla (2 * 2.4): antes medía 14 de alto y se comía el dibujo.
    expect(Number(striker![2])).toBeLessThanOrEqual(2.4 * 2.8);
  });

  it('MONOBLOCK pone cerradura en la puerta, y nunca en una corredera', () => {
    const conMonoblock = (apertura: number) => ventana({
      anchoMm: 1600,
      altoMm: 2400,
      dibujoTipoApertura: apertura,
      acabadoCodigo: 'NO',
      geometrias: [geometria({ tipoElemento: 3, tipoApertura: apertura, anchoMm: 1600, altoMm: 2400, posicion: 1 })],
      materiales: [materialDescrito('MONOBLOCK PUERTA NEGRO', { cantidad: 1, piezas: 1 })],
    });
    // 18 = puerta practicable izquierda
    expect(buildWindow(toWindowLine(conMonoblock(18))!, 'line').svg).toContain('data-hardware="monoblock"');
    // 32 = corredera: mismo material, pero sin cerradura en el dibujo
    const corredera = buildWindow(toWindowLine(conMonoblock(32))!, 'line');
    expect(corredera.svg).not.toContain('data-hardware="monoblock"');
    expect(corredera.svg).toContain('data-hardware="manilla"');
    // Una practicable normal (no puerta) tampoco la lleva
    expect(buildWindow(toWindowLine(conMonoblock(4))!, 'line').svg).not.toContain('data-hardware="monoblock"');
  });

  it('el travesaño se dibuja dentro del vidrio de cada hoja, no sobre la ventana entera', () => {
    const v = ventana({
      anchoMm: 1600,
      altoMm: 1400,
      dibujoTipoApertura: 7,
      acabadoCodigo: 'NO',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 7, anchoMm: 1600, altoMm: 1400, posicion: 1 }),
        geometria({ tipoElemento: 6, parametrosJson: { cota: 400 } }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    // Una barra por hoja (2 hojas), cada una contenida en su propio grupo.
    const perLeaf = [...result.svg.matchAll(/<g class="window-leaf-depth[\s\S]*?<\/g>\s*<\/g>/g)];
    expect(perLeaf.length).toBeGreaterThan(0);
    expect((result.svg.match(/class="window-transom"/g) || []).length).toBe(2);
  });

  it('toda hoja que abre lleva bisagras aunque HETMO no declare el herraje', () => {
    const v = ventana({
      anchoMm: 900,
      altoMm: 1200,
      dibujoTipoApertura: 4,
      acabadoCodigo: 'BL',
      geometrias: [
        geometria({ tipoElemento: 3, tipoApertura: 4, anchoMm: 900, altoMm: 1200, posicion: 1 }),
      ],
    });
    const result = buildWindow(toWindowLine(v)!, 'line');
    expect(result.svg).toContain('window-hinge');
    expect(result.svg).toContain('minimo-fisico-por-familia');
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
