import type { Ventana, MaterialVentana, VentanaGeometria } from '../../../../types';

export interface ProfileFinish {
  code: string;
  name: string;
  base: string;
  light: string;
  dark: string;
  stroke: string;
  glass: string;
  glassStroke: string;
  symbolColor: string;
  glassCrossColor: string;
}

/**
 * Resuelve el color y acabado de la perfilería de forma general para cualquier proyecto.
 * Inspecciona: código de acabado HETMO, descripción de la ventana y materiales de perfilería.
 */
export function resolveProfileFinish(ventana: Ventana): ProfileFinish {
  const codeRaw = String(ventana.acabadoCodigo || '').toLowerCase().trim();
  const desc = `${ventana.modelo} ${ventana.descripcionCorta || ''}`.toLowerCase();
  
  // Buscar también pistas en los materiales de la ventana si existen (ej. "MARCO 70 ROBLE")
  const matText = (ventana.materiales || [])
    .map((m: MaterialVentana) => `${m.material?.descripcion || ''} ${m.acabado || ''}`)
    .join(' ')
    .toLowerCase();

  const fullText = `${codeRaw} ${desc} ${matText}`;

  // 1. Roble Dorado / Madera Cálida / Golden Oak (HETMO 2052, etc.)
  if (
    codeRaw === '2052' ||
    /roble|golden\s*oak|wood|pino|madera\s*clara/.test(fullText)
  ) {
    return {
      code: '2052',
      name: '2052 - Roble Dorado',
      base: '#A4682A',
      light: '#C88746',
      dark: '#633912',
      stroke: '#482508',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#1D4ED8',
      glassCrossColor: '#0284C7',
    };
  }

  // 2. Nogal / Madera Oscura / Walnut (HETMO 2178, etc.)
  if (
    codeRaw === '2178' ||
    /nogal|walnut|wengue|teak|madera\s*oscura/.test(fullText)
  ) {
    return {
      code: '2178',
      name: '2178 - Nogal',
      base: '#4A2F1B',
      light: '#6B462C',
      dark: '#2A180C',
      stroke: '#1A0C06',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#38BDF8',
      glassCrossColor: '#38BDF8',
    };
  }

  // 3. Gris Antracita / Grafito (HETMO 7016, etc.)
  if (
    codeRaw === '7016' ||
    /antracita|grafito|gris|gray|7016/.test(fullText)
  ) {
    return {
      code: '7016',
      name: '7016 - Gris Antracita',
      base: '#374151',
      light: '#4B5563',
      dark: '#1F2937',
      stroke: '#111827',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#38BDF8',
      glassCrossColor: '#38BDF8',
    };
  }

  // 4. Negro Mate / Black (HETMO 9005, Kitami, Mattex, etc.)
  if (
    codeRaw === '9005' ||
    /negro|black|kitami|mattex|9005/.test(fullText)
  ) {
    return {
      code: '9005',
      name: '9005 - Negro Mate',
      base: '#1E293B',
      light: '#334155',
      dark: '#0F172A',
      stroke: '#020617',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#60A5FA',
      glassCrossColor: '#60A5FA',
    };
  }

  // 5. Bronce / Titanio / Marrón
  if (/bronce|titanio|marron|brown|anodizado/.test(fullText)) {
    return {
      code: 'BRONCE',
      name: 'Bronce Anodizado',
      base: '#5A534C',
      light: '#726A62',
      dark: '#3C3630',
      stroke: '#28231E',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#2563EB',
      glassCrossColor: '#2563EB',
    };
  }

  // 6. Blanco Estándar MTW PVC (HETMO 6997, 9016, etc.)
  return {
    code: '6997',
    name: '6997 - Blanco',
    base: '#F8FAFC',
    light: '#FFFFFF',
    dark: '#CBD5E1',
    stroke: '#94A3B8',
    glass: '#F0F9FF',
    glassStroke: '#BAE6FD',
    symbolColor: '#0284C7',
    glassCrossColor: '#0284C7',
  };
}

export type ApertureFamily = 
  | 'fixed' 
  | 'hinged' 
  | 'tilt-turn' 
  | 'projecting' 
  | 'sliding' 
  | 'parallel' 
  | 'lift-slide' 
  | 'double-door'
  | 'door';

export interface ApertureSpec {
  code: number;
  family: ApertureFamily;
  label: string;
  leafCount: number;
  hand?: 'left' | 'right';
  layout?: ('fijo' | 'left' | 'right' | 'both')[];
}

/**
 * Catálogo Canónico HETMO SQL de Aperturas
 */
export const GENERAL_APERTURE_CATALOG: Record<number, ApertureSpec> = {
  0: { code: 0, family: 'fixed', label: 'Ventana Fija', leafCount: 1 },
  1: { code: 1, family: 'fixed', label: 'Paño Fijo', leafCount: 1 },
  2: { code: 2, family: 'fixed', label: 'Paño Fijo', leafCount: 1 },
  3: { code: 3, family: 'hinged', label: 'Practicable Derecha · 1 Hoja', leafCount: 1, hand: 'right' },
  4: { code: 4, family: 'hinged', label: 'Practicable Izquierda · 1 Hoja', leafCount: 1, hand: 'left' },
  6: { code: 6, family: 'hinged', label: 'Practicable Derecha · 2 Hojas', leafCount: 2, hand: 'right' },
  7: { code: 7, family: 'projecting', label: 'Proyectante', leafCount: 1 },
  8: { code: 8, family: 'projecting', label: 'Proyectante', leafCount: 1 },
  10: { code: 10, family: 'tilt-turn', label: 'Oscilobatiente Derecha · 1 Hoja', leafCount: 1, hand: 'right' },
  11: { code: 11, family: 'tilt-turn', label: 'Oscilobatiente Izquierda · 1 Hoja', leafCount: 1, hand: 'left' },
  13: { code: 13, family: 'tilt-turn', label: 'Oscilobatiente Derecha · 2 Hojas', leafCount: 2, hand: 'right' },
  14: { code: 14, family: 'tilt-turn', label: 'Oscilobatiente Izquierda · 2 Hojas', leafCount: 2, hand: 'left' },
  17: { code: 17, family: 'door', label: 'Puerta Practicable Derecha · 1 Hoja', leafCount: 1, hand: 'right' },
  18: { code: 18, family: 'door', label: 'Puerta Practicable Izquierda · 1 Hoja', leafCount: 1, hand: 'left' },
  20: { code: 20, family: 'door', label: 'Puerta Practicable Derecha · 2 Hojas', leafCount: 2, hand: 'right' },
  21: { code: 21, family: 'door', label: 'Puerta Practicable Izquierda · 2 Hojas', leafCount: 2, hand: 'left' },
  22: { code: 22, family: 'projecting', label: 'Abatible', leafCount: 1 },
  23: { code: 23, family: 'projecting', label: 'Proyectante · 1 Hoja', leafCount: 1 },
  25: { code: 25, family: 'projecting', label: 'Pivotante Horizontal', leafCount: 1 },
  26: { code: 26, family: 'hinged', label: 'Pivotante Vertical Derecha', leafCount: 1, hand: 'right' },
  27: { code: 27, family: 'hinged', label: 'Pivotante Vertical Izquierda', leafCount: 1, hand: 'left' },
  29: { code: 29, family: 'sliding', label: 'Corredera 1 Hoja Der + Fijo', leafCount: 2, hand: 'right', layout: ['fijo', 'right'] },
  30: { code: 30, family: 'sliding', label: 'Corredera 1 Hoja Izq + Fijo', leafCount: 2, hand: 'left', layout: ['left', 'fijo'] },
  31: { code: 31, family: 'double-door', label: 'Puerta Doble Batiente', leafCount: 2 },
  32: { code: 32, family: 'sliding', label: 'Corredera 2 Hojas Derecha', leafCount: 2, layout: ['right', 'left'] },
  33: { code: 33, family: 'sliding', label: 'Corredera 2 Hojas Izquierda', leafCount: 2, layout: ['left', 'right'] },
  35: { code: 35, family: 'sliding', label: 'Corredera 3 Hojas Int-Fijo-Int', leafCount: 3, layout: ['right', 'fijo', 'left'] },
  36: { code: 36, family: 'sliding', label: 'Corredera 3 Hojas Int-Ext-Int', leafCount: 3, layout: ['left', 'left', 'left'] },
  38: { code: 38, family: 'sliding', label: 'Corredera 4 Hojas Int-Ext-Ext-Int', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] },
  41: { code: 41, family: 'sliding', label: 'Corredera 4 Hojas Ext-Int-Int-Ext', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] },
  44: { code: 44, family: 'sliding', label: 'Corredera 4 Hojas Fijo-Int-Int-Fijo', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] },
  46: { code: 46, family: 'sliding', label: 'Corredera 6 Hojas Derecha', leafCount: 6, layout: ['right', 'right', 'right', 'left', 'left', 'left'] },
  47: { code: 47, family: 'sliding', label: 'Corredera 6 Hojas', leafCount: 6, layout: ['right', 'right', 'right', 'left', 'left', 'left'] },
  54: { code: 54, family: 'parallel', label: 'Corredera Paralela Derecha · 1 Hoja', leafCount: 1 },
  55: { code: 55, family: 'parallel', label: 'Paralela Izquierda', leafCount: 1, hand: 'left' },
  57: { code: 57, family: 'parallel', label: 'Corredera Paralela Derecha · 2 Hojas', leafCount: 2, hand: 'right' },
  58: { code: 58, family: 'parallel', label: 'Corredera Paralela Izquierda · 2 Hojas', leafCount: 2, hand: 'left' },
  61: { code: 61, family: 'lift-slide', label: 'Elevadora Esquema A · Móvil-Fijo', leafCount: 2, layout: ['right', 'fijo'] },
  62: { code: 62, family: 'lift-slide', label: 'Elevadora Esquema A · Fijo-Móvil', leafCount: 2, layout: ['fijo', 'left'] },
  67: { code: 67, family: 'lift-slide', label: 'Elevadora Esquema D Derecha', leafCount: 2, layout: ['right', 'left'] },
  68: { code: 68, family: 'lift-slide', label: 'Elevadora Esquema D Izquierda', leafCount: 2, layout: ['right', 'left'] },
};

export function resolveApertureCode(code: number | null | undefined, fallbackDesc = ''): ApertureSpec {
  const c = Number(code) || 0;
  if (GENERAL_APERTURE_CATALOG[c]) return GENERAL_APERTURE_CATALOG[c];

  const desc = fallbackDesc.toLowerCase();
  if (desc.includes('fijo') || desc.includes('paño fijo')) return { code: 0, family: 'fixed', label: 'Ventana Fija', leafCount: 1 };
  if (desc.includes('proyect')) return { code: 7, family: 'projecting', label: 'Proyectante', leafCount: 1 };
  if (desc.includes('oscilobatiente') || desc.includes('o/b') || desc.includes('ob')) {
    const isIzq = desc.includes('izq');
    return { code: isIzq ? 11 : 10, family: 'tilt-turn', label: `Oscilobatiente ${isIzq ? 'Izquierda' : 'Derecha'}`, leafCount: 1, hand: isIzq ? 'left' : 'right' };
  }
  if (desc.includes('doble') || desc.includes('puerta 2') || desc.includes('puerta practicable')) {
    return { code: 21, family: 'door', label: 'Puerta Practicable Izquierda · 2 Hojas', leafCount: 2, hand: 'left' };
  }
  if (desc.includes('puerta')) {
    const isIzq = desc.includes('izq');
    return { code: isIzq ? 18 : 17, family: 'door', label: `Puerta Practicable ${isIzq ? 'Izquierda' : 'Derecha'}`, leafCount: 1, hand: isIzq ? 'left' : 'right' };
  }
  if (desc.includes('batiente') || desc.includes('practicable')) {
    const isIzq = desc.includes('izq');
    return { code: isIzq ? 4 : 3, family: 'hinged', label: `Practicable ${isIzq ? 'Izquierda' : 'Derecha'}`, leafCount: 1, hand: isIzq ? 'left' : 'right' };
  }
  if (desc.includes('corred') || desc.includes('desliz') || desc.includes('slider')) {
    return { code: 32, family: 'sliding', label: 'Corredera 2 Hojas', leafCount: 2, layout: ['right', 'left'] };
  }

  return { code: 0, family: 'fixed', label: 'Ventana Fija', leafCount: 1 };
}

export interface CompositePanel {
  panelIndex: number;
  widthMm: number;
  heightMm: number;
  apertura: ApertureSpec;
  aperturaCount: number;
  isOperable: boolean;
}

export interface CompositeWindow {
  isComposite: boolean;
  totalWidthMm: number;
  totalHeightMm: number;
  panels: CompositePanel[];
  apertureLabel: string;
}

/**
 * Interpreta la estructura geométrica de la ventana:
 * Agrupa por panel (perteneceHueco / posicion) tal como lo hace el catálogo HETMO SQL.
 */
export function buildCompositeStructure(ventana: Ventana): CompositeWindow {
  const totalWidthMm = Math.max(100, ventana.anchoMm || 1000);
  const totalHeightMm = Math.max(100, ventana.altoMm || 1000);
  const raw: VentanaGeometria[] = ventana.geometrias || [];

  // Agrupar filas de geometría por paño/hueco
  const groups = new Map<number, {
    number: number;
    order: number;
    width: number;
    height: number;
    apertura: number;
    aperturaCount: number;
    raw: VentanaGeometria[];
  }>();

  raw.forEach((item, index) => {
    // Si viene perteneceHueco o posicion lo usamos; si no, agrupamos por orden si es tipo 10000
    const tipo = Number(item.tipoElemento);
    let panelNumber = Number(item.perteneceHueco) || Number(item.posicion);
    if (!panelNumber && tipo === 10000) {
      panelNumber = index + 1;
    }
    if (!panelNumber) return;

    if (!groups.has(panelNumber)) {
      groups.set(panelNumber, {
        number: panelNumber,
        order: item.ordenGeometria ?? index,
        width: 0,
        height: 0,
        apertura: 0,
        aperturaCount: 0,
        raw: [],
      });
    }

    const panel = groups.get(panelNumber)!;
    panel.raw.push(item);
    panel.order = Math.min(panel.order, item.ordenGeometria ?? index);

    const itemW = Number(item.anchoMm) || 0;
    const itemH = Number(item.altoMm) || 0;

    if (tipo === 10000 || (itemW > 0 && itemH > 0 && panel.width === 0)) {
      panel.width = itemW || panel.width;
      panel.height = itemH || panel.height;
    }

    // Fila tipo 3 declara la apertura específica de ESTE paño
    if (tipo === 3) {
      panel.apertura = Number(item.tipoApertura) || 0;
      panel.aperturaCount += 1;
    }
  });

  const panelsWithDims = [...groups.values()]
    .filter(p => p.width > 0 && p.height > 0)
    .sort((a, b) => a.number - b.number || a.order - b.order);

  // Si se detectaron 2 o más módulos con medidas reales
  if (panelsWithDims.length >= 2) {
    const declaredLeaves = Number(ventana.numeroCuadrosHojas) || 1;
    
    // Si sólo un paño tiene apertura y la línea declara 2 hojas para puerta (ej. apertura 21)
    const openingPanels = panelsWithDims.filter(p => p.aperturaCount > 0 && p.apertura > 0);
    if (openingPanels.length === 1 && declaredLeaves === 2) {
      openingPanels[0].aperturaCount = 2;
    }

    const panels: CompositePanel[] = panelsWithDims.map((p, idx) => {
      let spec: ApertureSpec;
      let aptCount = p.aperturaCount;

      if (p.apertura > 0) {
        spec = resolveApertureCode(p.apertura, ventana.descripcionCorta || ventana.modelo);
        if (spec.leafCount === 2 || aptCount >= 2) {
          aptCount = 2;
        }
      } else {
        // Paño Fijo
        spec = { code: 0, family: 'fixed', label: 'Ventana Fija', leafCount: 1 };
        aptCount = 1;
      }

      return {
        panelIndex: idx,
        widthMm: p.width,
        heightMm: p.height,
        apertura: spec,
        aperturaCount: aptCount,
        isOperable: spec.family !== 'fixed',
      };
    });

    const uniqueLabels = [...new Set(panels.map(p => p.apertura.label))];

    return {
      isComposite: true,
      totalWidthMm,
      totalHeightMm,
      panels,
      apertureLabel: uniqueLabels.join(' + '),
    };
  }

  // 2. Ventana Simple (Monolítica)
  const singleSpec = resolveApertureCode(
    ventana.dibujoTipoApertura,
    `${ventana.modelo} ${ventana.descripcionCorta || ''}`
  );

  return {
    isComposite: false,
    totalWidthMm,
    totalHeightMm,
    panels: [
      {
        panelIndex: 0,
        widthMm: totalWidthMm,
        heightMm: totalHeightMm,
        apertura: singleSpec,
        aperturaCount: singleSpec.leafCount || 1,
        isOperable: singleSpec.family !== 'fixed',
      }
    ],
    apertureLabel: singleSpec.label,
  };
}

/**
 * Obtiene el código o descripción del vidrio principal de la ventana para rotulación técnica.
 */
export function getGlassLabel(ventana: Ventana): string {
  const glassMat = (ventana.materiales || []).find(m => {
    const fam = (m.material?.familia || '').toLowerCase();
    const desc = (m.material?.descripcion || '').toLowerCase();
    return fam.includes('vidrio') || desc.includes('vidrio') || desc.includes('dvh') || desc.includes('inc');
  });

  if (glassMat?.material?.descripcion) {
    const desc = glassMat.material.descripcion;
    // Simplificar a formato corto ej: "5/12/5 INC" o código SKU
    const match = desc.match(/\d+[/-]\d+[/-]\d+.*$/i) || desc.match(/\d+[/-]\d+.*$/i);
    if (match) return match[0];
    return glassMat.material.skuInterno || 'DVH';
  }

  return '';
}
