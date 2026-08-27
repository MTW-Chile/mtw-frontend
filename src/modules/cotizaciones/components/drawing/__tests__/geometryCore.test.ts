import { describe, it, expect } from 'vitest';
import * as core from '../geometryCore';

/**
 * Tests directos sobre el núcleo geométrico, con su vocabulario nativo
 * (snake_case para los campos de nivel 2, sin columna propia -- ver
 * normalizeGeometryItem() en geometryCore.ts). Cada caso documentado en
 * sus comentarios como "confirmado en terreno" se convierte aquí en una
 * regla ejecutable: si alguien la rompe, esto falla en vez de esperar a
 * que se note en una ficha de fábrica real.
 */

describe('slidingPieces — paño fijo detectado por N1/N2 (Portal Las Pataguas)', () => {
  // Código 33: layout ['int:right', 'ext:left']. Confirmado cruzando N2
  // con los anchos reales del despiece en 8 líneas de la obra.
  it('V2H1: N1=1, N2=1500 sobre 3662mm totales -> móvil 1500, fijo 2162', () => {
    const pieces = core.slidingPieces({
      apertura: 33,
      raw: [],
      width: 3662,
      movilLado: 1,
      movilAncho: 1500,
      materiales: null,
      unidades: 0,
      linea: null,
    }) as { kind: string; width: number }[];
    expect(pieces.map(p => Math.round(p.width))).toEqual([1500, 2162]);
    expect(pieces[0].kind).toBe('int:right'); // móvil: kind real del layout
    expect(pieces[1].kind).toBe('fijo');
  });

  it('sin N1 (movilLado=0) no hay paño fijo: se respeta el layout del código', () => {
    const pieces = core.slidingPieces({
      apertura: 33,
      raw: [],
      width: 1528, // V8A1: 764|764, dos hojas móviles iguales
      movilLado: 0,
      movilAncho: 0,
      materiales: null,
      unidades: 0,
      linea: null,
    });
    expect(pieces).toBeNull(); // sin N1 ni hojas exactas, slidingPieces no resuelve por sí solo
  });
});

describe('mobileLeavesFromHardware — carro vs. su calzo (Gorbea)', () => {
  it('cuenta los CARRO pero no el CALZO CARRO (evita duplicar hojas móviles)', () => {
    const materiales = [
      { descripcionArticulo: 'CARRO VENTO SIMP VE180', cantidad: 8 },
      { descripcionArticulo: 'CALZO CARRO VENTO SIMP VE180', cantidad: 8 },
    ];
    // 8 carros reales / 2 por hoja = 4 hojas móviles, no 8.
    expect(core.mobileLeavesFromHardware(materiales, 1)).toBe(4);
  });

  it('sin materiales no inventa hojas móviles', () => {
    expect(core.mobileLeavesFromHardware([], 1)).toBe(0);
    expect(core.mobileLeavesFromHardware(null, 1)).toBe(0);
  });
});

describe('mobileLeavesFromHardware — V1A1 vs V8A1 (mismo código 33, distinto herraje real)', () => {
  it('V1A1: 2 carros -> 1 hoja móvil + 1 fijo', () => {
    const materiales = [{ descripcionArticulo: 'CARRO VENTO SIMP VE180', cantidad: 2 }];
    expect(core.mobileLeavesFromHardware(materiales, 1)).toBe(1);
  });

  it('V8A1: 4 carros -> 2 hojas móviles', () => {
    const materiales = [{ descripcionArticulo: 'CARRO VENTO SIMP VE180', cantidad: 4 }];
    expect(core.mobileLeavesFromHardware(materiales, 1)).toBe(2);
  });
});

describe('exactLeavesFor — Casa La Aurora, apertura 36: anchos genéricos no confiables', () => {
  it('descarta 3 hojas "exactas" de 1393,30mm cuando no calzan con el ancho real (4100mm)', () => {
    const rawItems = [1, 2, 3].map(numeroHoja => ({
      tipo_elemento: 40001,
      numero_ventana: 1,
      numero_hoja: numeroHoja,
      orden_hoja: numeroHoja,
      ancho: 1393.3,
      alto: 1400,
    }));
    // Suma real: 4179.9mm contra un ANCHO de línea de 4100mm -- ninguna
    // corredera física tiene ~80mm de holgura ahí.
    expect(core.exactLeavesFor(rawItems, 3, 4100)).toBeNull();
  });

  it('acepta las mismas 3 hojas cuando la suma sí calza con el ancho real', () => {
    const rawItems = [1, 2, 3].map(numeroHoja => ({
      tipo_elemento: 40001,
      numero_ventana: 1,
      numero_hoja: numeroHoja,
      orden_hoja: numeroHoja,
      ancho: 1366.63,
      alto: 1400,
    }));
    const leaves = core.exactLeavesFor(rawItems, 3, 4100 - 0.1); // 3 x 1366.63 ~= 4099.9
    expect(leaves).not.toBeNull();
    expect(leaves).toHaveLength(3);
  });
});

describe('handleHeightFor — puerta P6 Vista Monseñor (10332, 900x2600, código 18)', () => {
  it('alturaManilla=1020 resuelve "hetmo-custom", no el centro por defecto', () => {
    const result = core.handleHeightFor({ alturaManilla: 1020 }, {}, 2600);
    expect(result).toMatchObject({ millimeters: 1020, reason: 'hetmo-custom' });
  });

  it('sin altura_manilla cae al centro de la hoja', () => {
    const result = core.handleHeightFor({}, {}, 2600);
    expect(result).toMatchObject({ millimeters: 1300, reason: 'center-default' });
  });
});

describe('handleHeightFor — puerta Casa A PV02 (10581, 870x2475, código 18) sin altura_manilla', () => {
  // Confirmado en terreno: esta puerta no trae altura_manilla, pero sí un
  // travesaño (tipo_elemento 6, cota=1375mm desde arriba de 2475mm de alto).
  // La manilla real queda a la altura de ese travesaño, no al centro -- así
  // que la manilla y el eje de apertura deben moverse ahí en vez de a 1237.5.
  const line = {
    ancho: 870,
    geometria: [
      { tipo_elemento: 6, parametrosJson: { cota: 1375 } },
    ],
  };

  it('usa la altura del travesaño (2475 - 1375 = 1100mm desde la base), no el centro', () => {
    const result = core.handleHeightFor(line, { apertura: 18 }, 2475);
    expect(result).toMatchObject({ millimeters: 1100, reason: 'hetmo-transom' });
  });

  it('una ventana fija con el mismo travesaño sigue centrada (la regla sólo aplica a puertas/abatibles/correderas)', () => {
    const result = core.handleHeightFor(line, { apertura: 0 }, 2475);
    expect(result).toMatchObject({ millimeters: 2475 / 2, reason: 'center-default' });
  });
});

describe('panelGlassSplits — la misma puerta P6: travesaño detectado por partición de vidrio', () => {
  it('dos vidrios de igual ancho y distinto alto en la misma hoja producen un corte horizontal', () => {
    const splits = core.panelGlassSplits({
      raw: [
        { tipo_elemento: 40000, numero_ventana: 1, numero_hoja: 1, codigo_componente: '4/12/4', ancho: 670, alto: 1438 },
        { tipo_elemento: 40000, numero_ventana: 1, numero_hoja: 1, codigo_componente: '4/12/4', ancho: 670, alto: 878 },
      ],
    }) as { axis: string; at: number }[];
    expect(splits).toHaveLength(1);
    expect(splits[0].axis).toBe('horizontal');
    expect(splits[0].at).toBeCloseTo(1438 / (1438 + 878), 3);
  });

  it('dos vidrios idénticos (repetición por unidades) no producen ningún corte', () => {
    const splits = core.panelGlassSplits({
      raw: [
        { tipo_elemento: 40000, numero_ventana: 1, numero_hoja: 1, codigo_componente: '4/12/4', ancho: 670, alto: 1000 },
        { tipo_elemento: 40000, numero_ventana: 1, numero_hoja: 1, codigo_componente: '4/12/4', ancho: 670, alto: 1000 },
      ],
    });
    expect(splits).toHaveLength(0);
  });
});

describe('apertureDefinition / apertureCatalog — casos base', () => {
  it('código 0 es fija, con confianza hetmo-fixed-code', () => {
    const def = core.apertureDefinition(null, 0) as { family: string; confidence: string };
    expect(def.family).toBe('fixed');
    expect(def.confidence).toBe('hetmo-fixed-code');
  });

  it('un código desconocido no se inventa: family "unknown", nunca cae a un código cercano', () => {
    const def = core.apertureDefinition(null, 987654) as { family: string; label: string };
    expect(def.family).toBe('unknown');
    expect(def.label).toBe('');
  });
});

describe('sourceComponents — respaldo cuando no hay filas tipo 3', () => {
  it('sin geometría, usa la apertura de la línea como componente único', () => {
    const parts = core.sourceComponents({ geometria: [], tipoApertura: 18 }) as { apertura: number }[];
    expect(parts).toHaveLength(1);
    expect(parts[0].apertura).toBe(18);
  });
});

describe('normalizeGeometryItem — numero_ventana crudo tiene prioridad sobre pertenece_hueco', () => {
  // Confirmado con Franklin Sánchez V01 (HETMO 10200): las filas hijas de
  // un paño (travesaño tipo 6, vidrio tipo 200) traen pertenece_hueco con
  // la sub-región DENTRO del paño (marco=1, vidrio sup=2, vidrio inf=4),
  // no el número de paño -- confiar en ese campo para agrupar paños hacía
  // que compositePanels() nunca encontrara las filas tipo 10000 agrupadas
  // bajo un número real (todas venían con pertenece_hueco=0) y descartara
  // la ventana entera como compuesta.
  it('agrupa por numero_ventana crudo aunque pertenece_hueco traiga valores de otra sub-región', () => {
    const line = {
      dibujoAncho: 2200,
      dibujoAlto: 1900,
      geometria: [
        { tipo_elemento: 10000, ancho: 1100, alto: 1900, perteneceHueco: 0, parametrosJson: { numero_ventana: 1 } },
        { tipo_elemento: 6, perteneceHueco: 1, parametrosJson: { numero_ventana: 1, cota: 700, pertenece_hueco: 1 } },
        { tipo_elemento: 200, perteneceHueco: 2, parametrosJson: { numero_ventana: 1, pertenece_hueco: 2 } },
        { tipo_elemento: 10000, ancho: 1100, alto: 1900, perteneceHueco: 0, parametrosJson: { numero_ventana: 2 } },
      ],
    };
    const composite = core.compositePanels(line) as { panels: { number: number; width: number }[] } | null;
    expect(composite).not.toBeNull();
    expect(composite!.panels.map(p => ({ number: p.number, width: p.width }))).toEqual([
      { number: 1, width: 1100 },
      { number: 2, width: 1100 },
    ]);
  });
});

describe('panelTraverseLines — travesaño declarado como fila tipo_elemento 6 + cota', () => {
  // Confirmado con Franklin Sánchez V01/V02 (HETMO 10200/10201): sin
  // bh_numero_travesano, el travesaño real de cada paño es una fila tipo 6
  // con sólo una cota (medida desde arriba del paño).
  it('cota=700 en un paño de 1900mm de alto -> línea horizontal a y=1200 (base del paño)', () => {
    const lines = core.panelTraverseLines({
      width: 1100,
      height: 1900,
      raw: [{ tipo_elemento: 6, cota: 700 }],
    }) as { x1: number; y1: number; x2: number; y2: number }[];
    expect(lines).toEqual([{ x1: 0, y1: 1200, x2: 1100, y2: 1200 }]);
  });

  it('bh_numero_travesano tiene prioridad cuando existe (no se duplica con tipo 6)', () => {
    const lines = core.panelTraverseLines({
      width: 1100,
      height: 1900,
      raw: [
        { tipo_elemento: 40000, bh_numero_travesano: 1, bh_x_inicio: 0, bh_y_inicio: 1000, bh_x_fin: 1100, bh_y_fin: 1000 },
        { tipo_elemento: 6, cota: 700 },
      ],
    }) as { x1: number; y1: number; x2: number; y2: number }[];
    expect(lines).toEqual([{ x1: 0, y1: 1000, x2: 1100, y2: 1000 }]);
  });
});
