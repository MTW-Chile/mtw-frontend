import type { Ventana, VentanaGeometria } from '../../../../types';

export interface ProfileFinish {
  name: string;
  base: string;
  light: string;
  dark: string;
  stroke: string;
  glass: string;
  glassStroke: string;
  symbolColor: string;
}

/**
 * Genera la paleta de colores y sombreados 3D según el acabado.
 * Regla general procedural: calcula aristas de luz (superior/izquierda) y sombra (inferior/derecha).
 */
export function getProfileFinish(acabado?: string | null): ProfileFinish {
  const code = (acabado || '').toLowerCase().trim();

  // Roble Dorado / Madera Cálida
  if (code.includes('roble') || code.includes('golden') || code.includes('wood') || code.includes('pino')) {
    return {
      name: 'Roble Dorado',
      base: '#B47230',
      light: '#D38E4C',
      dark: '#6E3A0E',
      stroke: '#582E0B',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#1D4ED8',
    };
  }

  // Nogal / Madera Oscura
  if (code.includes('nogal') || code.includes('walnut') || code.includes('wengue')) {
    return {
      name: 'Nogal',
      base: '#53341E',
      light: '#724A2D',
      dark: '#301C0D',
      stroke: '#241408',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#38BDF8',
    };
  }

  // Gris Antracita / Grafito (RAL 7016)
  if (code.includes('antracita') || code.includes('grafito') || code.includes('gris') || code.includes('7016')) {
    return {
      name: 'Gris Antracita',
      base: '#374151',
      light: '#4B5563',
      dark: '#1F2937',
      stroke: '#111827',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#38BDF8',
    };
  }

  // Negro (RAL 9005)
  if (code.includes('negro') || code.includes('black') || code.includes('9005')) {
    return {
      name: 'Negro',
      base: '#1E293B',
      light: '#334155',
      dark: '#0F172A',
      stroke: '#020617',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#60A5FA',
    };
  }

  // Bronce / Titanio
  if (code.includes('bronce') || code.includes('titanio') || code.includes('anodizado')) {
    return {
      name: 'Bronce',
      base: '#645D56',
      light: '#7E766E',
      dark: '#47413B',
      stroke: '#332E29',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#2563EB',
    };
  }

  // Estándar: Blanco PVC MTW
  return {
    name: 'Blanco',
    base: '#F8FAFC',
    light: '#FFFFFF',
    dark: '#CBD5E1',
    stroke: '#94A3B8',
    glass: '#F0F9FF',
    glassStroke: '#BAE6FD',
    symbolColor: '#0284C7',
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
  | 'double-door';

export interface ApertureSpec {
  code: number;
  family: ApertureFamily;
  label: string;
  leafCount: number;
  hand?: 'left' | 'right';
  layout?: ('fijo' | 'left' | 'right' | 'both')[];
}

/**
 * Catálogo General de Aperturas HETMO SQL
 * Clasificación canónica que cubre los códigos reales de fábrica.
 */
export const GENERAL_APERTURE_CATALOG: Record<number, ApertureSpec> = {
  0: { code: 0, family: 'fixed', label: 'Paño Fijo', leafCount: 1 },
  1: { code: 1, family: 'fixed', label: 'Fijo', leafCount: 1 },
  7: { code: 7, family: 'projecting', label: 'Proyectante', leafCount: 1 },
  8: { code: 8, family: 'projecting', label: 'Proyectante', leafCount: 1 },
  13: { code: 13, family: 'tilt-turn', label: 'Oscilobatiente Derecha', leafCount: 1, hand: 'right' },
  14: { code: 14, family: 'tilt-turn', label: 'Oscilobatiente Izquierda', leafCount: 1, hand: 'left' },
  17: { code: 17, family: 'hinged', label: 'Practicable Derecha', leafCount: 1, hand: 'right' },
  18: { code: 18, family: 'hinged', label: 'Practicable Izquierda', leafCount: 1, hand: 'left' },
  21: { code: 21, family: 'tilt-turn', label: 'Oscilobatiente', leafCount: 1, hand: 'right' },
  23: { code: 23, family: 'projecting', label: 'Proyectante 1 Hoja', leafCount: 1 },
  29: { code: 29, family: 'sliding', label: 'Corredera Fijo + Móvil Der', leafCount: 2, hand: 'right', layout: ['fijo', 'right'] },
  30: { code: 30, family: 'sliding', label: 'Corredera Móvil Izq + Fijo', leafCount: 2, hand: 'left', layout: ['left', 'fijo'] },
  31: { code: 31, family: 'double-door', label: 'Doble Batiente / Puerta', leafCount: 2 },
  32: { code: 32, family: 'sliding', label: 'Corredera 2 Hojas', leafCount: 2, layout: ['right', 'left'] },
  33: { code: 33, family: 'sliding', label: 'Corredera 2 Hojas', leafCount: 2, layout: ['left', 'right'] },
  35: { code: 35, family: 'sliding', label: 'Corredera 3 Hojas (Móvil-Fijo-Móvil)', leafCount: 3, layout: ['right', 'fijo', 'left'] },
  36: { code: 36, family: 'sliding', label: 'Corredera 3 Hojas (3 Carriles)', leafCount: 3, layout: ['left', 'left', 'left'] },
  38: { code: 38, family: 'sliding', label: 'Corredera 4 Hojas (Fijo-Móvil-Móvil-Fijo)', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] },
  41: { code: 41, family: 'sliding', label: 'Corredera 4 Hojas (Fijo-Móvil-Móvil-Fijo)', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] },
  44: { code: 44, family: 'sliding', label: 'Corredera 4 Hojas F-M-M-F', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] },
  46: { code: 46, family: 'sliding', label: 'Corredera 6 Hojas', leafCount: 6, layout: ['right', 'right', 'right', 'left', 'left', 'left'] },
  47: { code: 47, family: 'sliding', label: 'Corredera 6 Hojas', leafCount: 6, layout: ['right', 'right', 'right', 'left', 'left', 'left'] },
  54: { code: 54, family: 'parallel', label: 'Paralela 1 Hoja', leafCount: 1 },
  55: { code: 55, family: 'parallel', label: 'Paralela Izquierda', leafCount: 1, hand: 'left' },
  57: { code: 57, family: 'parallel', label: 'Paralela 2 Hojas Der', leafCount: 2, hand: 'right' },
  58: { code: 58, family: 'parallel', label: 'Paralela 2 Hojas Izq', leafCount: 2, hand: 'left' },
  61: { code: 61, family: 'lift-slide', label: 'Elevadora Móvil-Fijo', leafCount: 2, layout: ['right', 'fijo'] },
  62: { code: 62, family: 'lift-slide', label: 'Elevadora Fijo-Móvil', leafCount: 2, layout: ['fijo', 'left'] },
  67: { code: 67, family: 'lift-slide', label: 'Elevadora Doble Móvil', leafCount: 2, layout: ['right', 'left'] },
  68: { code: 68, family: 'lift-slide', label: 'Elevadora Doble Móvil', leafCount: 2, layout: ['right', 'left'] },
};

/**
 * Resuelve la especificación de apertura para una ventana dada.
 * Si el código SQL exacto está en el catálogo, lo utiliza; si no, usa heurísticas limpias.
 */
export function resolveAperture(ventana: Ventana): ApertureSpec {
  const code = Number(ventana.dibujoTipoApertura) || 0;

  if (GENERAL_APERTURE_CATALOG[code]) {
    return GENERAL_APERTURE_CATALOG[code];
  }

  const desc = `${ventana.modelo} ${ventana.descripcionCorta || ''}`.toLowerCase();
  const hojas = Math.max(1, ventana.numeroCuadrosHojas || 1);

  if (desc.includes('fijo') || desc.includes('paño fijo')) {
    return { code: 0, family: 'fixed', label: 'Fijo', leafCount: 1 };
  }

  if (desc.includes('proyect')) {
    return { code: 7, family: 'projecting', label: 'Proyectante', leafCount: 1 };
  }

  if (desc.includes('oscilobatiente') || desc.includes('o/b') || desc.includes('ob')) {
    const isIzq = desc.includes('izq');
    return { code: isIzq ? 14 : 13, family: 'tilt-turn', label: `Oscilobatiente ${isIzq ? 'Izq' : 'Der'}`, leafCount: 1, hand: isIzq ? 'left' : 'right' };
  }

  if (desc.includes('doble') || desc.includes('puerta') || hojas === 2 && desc.includes('batiente')) {
    return { code: 31, family: 'double-door', label: 'Doble Batiente', leafCount: 2 };
  }

  if (desc.includes('batiente') || desc.includes('practicable')) {
    const isIzq = desc.includes('izq');
    return { code: isIzq ? 18 : 17, family: 'hinged', label: `Practicable ${isIzq ? 'Izq' : 'Der'}`, leafCount: 1, hand: isIzq ? 'left' : 'right' };
  }

  if (desc.includes('corred') || desc.includes('desliz') || desc.includes('slider')) {
    if (hojas === 4) return { code: 38, family: 'sliding', label: 'Corredera 4 Hojas', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] };
    if (hojas === 3) return { code: 36, family: 'sliding', label: 'Corredera 3 Hojas', leafCount: 3, layout: ['left', 'left', 'left'] };
    return { code: 32, family: 'sliding', label: 'Corredera 2 Hojas', leafCount: 2, layout: ['right', 'left'] };
  }

  if (hojas === 4) return { code: 38, family: 'sliding', label: 'Corredera 4 Hojas', leafCount: 4, layout: ['fijo', 'left', 'right', 'fijo'] };
  if (hojas === 3) return { code: 36, family: 'sliding', label: 'Corredera 3 Hojas', leafCount: 3, layout: ['left', 'left', 'left'] };
  if (hojas === 2) return { code: 32, family: 'sliding', label: 'Corredera 2 Hojas', leafCount: 2, layout: ['right', 'left'] };

  return { code: 0, family: 'fixed', label: 'Fijo', leafCount: 1 };
}

export interface ComputedLeaf {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  role: 'fijo' | 'left' | 'right' | 'both' | 'hinged-left' | 'hinged-right' | 'tilt-left' | 'tilt-right' | 'projecting';
  isOperable: boolean;
}

/**
 * Calcula la distribución geométrica de hojas, respetando cotas de geometrias si existen.
 */
export function computeWindowLeaves(
  spec: ApertureSpec,
  geometrias: VentanaGeometria[] | undefined,
  innerX: number,
  innerY: number,
  innerW: number,
  innerH: number,
  totalWidthMm: number
): ComputedLeaf[] {
  const leafCount = spec.leafCount || 1;

  // Si existen geometrias con anchos individuales declarados por HETMO
  const geoLeaves = (geometrias || []).filter(g => (g.anchoMm || 0) > 0);
  const useGeoProportions = geoLeaves.length === leafCount && totalWidthMm > 0;

  const leaves: ComputedLeaf[] = [];
  let currentX = innerX;

  for (let i = 0; i < leafCount; i++) {
    let leafWidth = innerW / leafCount;

    if (useGeoProportions) {
      const geoWidthMm = geoLeaves[i].anchoMm || 1;
      leafWidth = (geoWidthMm / totalWidthMm) * innerW;
    }

    let role: ComputedLeaf['role'] = 'fijo';

    if (spec.family === 'fixed') {
      role = 'fijo';
    } else if (spec.family === 'hinged') {
      role = spec.hand === 'left' ? 'hinged-left' : 'hinged-right';
    } else if (spec.family === 'tilt-turn') {
      role = spec.hand === 'left' ? 'tilt-left' : 'tilt-right';
    } else if (spec.family === 'projecting') {
      role = 'projecting';
    } else if (spec.family === 'double-door') {
      role = i === 0 ? 'hinged-left' : 'hinged-right';
    } else if (spec.family === 'sliding' || spec.family === 'lift-slide') {
      const layoutRole = spec.layout?.[i] || (i % 2 === 0 ? 'right' : 'left');
      role = layoutRole;
    }

    leaves.push({
      index: i,
      x: currentX,
      y: innerY,
      width: leafWidth,
      height: innerH,
      role,
      isOperable: role !== 'fijo',
    });

    currentX += leafWidth;
  }

  return leaves;
}
