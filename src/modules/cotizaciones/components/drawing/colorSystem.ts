/**
 * Sistema de colores para el renderizado de ventanas.
 * Mapa de colores por código de acabado HETMO, reemplazando el uso directo
 * de `acabado` como color hex.
 *
 * Etapa 5 del plan de refactorización.
 *
 * @module colorSystem
 */

import type {
  FinishColors,
  ProfileColorSet,
  MetalColorSet,
  VisualPalette,
  GlassNomenclature,
  MuntinNomenclature,
  TraverseNomenclature,
} from './types';

// ─── Paleta visual global ─────────────────────────────────────────────────────

export const VISUAL: VisualPalette = Object.freeze({
  glass: '#d8f2f4',
  glassEdge: '#7595a2',
  opening: '#2452d6',
  dimension: '#40536b',
  glassText: '#253844',
});

// ─── Mapa de colores por código de acabado HETMO ──────────────────────────────

/**
 * Mapa de colores de marco (frame) indexado por código de acabado HETMO.
 * Cada entrada tiene el color hex del marco.
 *
 * Basado en el catálogo de acabados HETMO.
 */
const FINISH_MAP: Record<string, string> = {
  // Blancos
  'BL': '#f5f4ef',     // Blanco
  'BLA': '#f5f4ef',    // Blanco
  'BLN': '#f5f4ef',    // Blanco Nieve
  'BLM': '#f0efe8',    // Blanco Marfil
  'BLC': '#f5f4ef',    // Blanco Claro
  'BLR': '#f5f4ef',    // Blanco Roto
  'BCO': '#ffffff',    // Blanco Puro
  'BLAN': '#f5f4ef',   // Blanco (variante)
  'BLANCO': '#f5f4ef', // Blanco (completo)
  'BLANCA': '#f5f4ef', // Blanca (variante)
  'WHITE': '#f5f4ef',  // White (inglés)
  '1': '#f5f4ef',      // ID 1 = Blanco (fallback numérico)
  '01': '#f5f4ef',     // ID 01 = Blanco
  '001': '#f5f4ef',    // ID 001 = Blanco

  // Grises
  'GR': '#838688',     // Gris
  'GRC': '#a0a2a5',    // Gris Claro
  'GRO': '#6b6d70',    // Gris Oscuro
  'GRM': '#8a8c8f',    // Gris Medio
  'GRP': '#949698',    // Gris Perla
  'GRS': '#7a7c7e',    // Gris Plata
  'GRA': '#8d8f92',    // Gris Grafito
  'GRH': '#5a5c5e',    // Gris Hierro
  'GRU': '#626466',    // Gris Urbano
  'GRN': '#757779',    // Gris Neutro
  'GRT': '#9ea0a2',    // Gris Topo
  'GRF': '#6e7072',    // Gris Frío
  'GRB': '#585a5c',    // Gris Basalto
  'GRR': '#828486',    // Gris Roca
  'GRD': '#4e5052',    // Gris Pizarra
  'GRL': '#b0b2b4',    // Gris Luminoso
  'GRV': '#929496',    // Gris Viento
  'GRZ': '#66686a',    // Gris Zinc
  '2': '#838688',      // ID 2 = Gris (fallback numérico)

  // Negros
  'NE': '#212225',     // Negro
  'NEM': '#1a1b1d',    // Negro Mate
  'NEB': '#18191b',    // Negro Brillante
  'NES': '#2a2b2e',    // Negro Satinado
  'NEC': '#242527',    // Negro Carbón
  'NEP': '#1e1f21',    // Negro Profundo
  'NEK': '#161719',    // Negro Kitami
  'NED': '#2c2d30',    // Negro Oscuro
  'NEL': '#303134',    // Negro Lavado
  'NEMT': '#1a1b1d',   // Negro Mate (variante)
  '3': '#212225',      // ID 3 = Negro (fallback numérico)

  // Marrones / Nogal
  'NO': '#6e4528',     // Nogal
  'NOC': '#7a4e2e',    // Nogal Claro
  'NOO': '#5c3a22',    // Nogal Oscuro
  'NOM': '#6e4528',    // Nogal Medio
  'NON': '#63402a',    // Nogal Natural
  'NOH': '#7a5030',    // Nogal Honey
  'NOL': '#8a5a38',    // Nogal Light
  'NOD': '#4e301e',    // Nogal Dark
  'NOV': '#7250a0',    // Nogal Vintage (tinte)
  'NOCL': '#8a5a38',   // Nogal Claro (variante)
  '4': '#6e4528',      // ID 4 = Nogal (fallback numérico)

  // Marrones
  'MA': '#6d402c',     // Marrón
  'MAC': '#7d4e36',    // Marrón Claro
  'MAO': '#5a3422',    // Marrón Oscuro
  'MAM': '#6d402c',    // Marrón Medio
  'MAR': '#6d402c',    // Marrón Rojizo
  'MAT': '#6d402c',    // Marrón Tierra
  'MAB': '#4a2a1c',    // Marrón Barro
  'MACL': '#7d4e36',   // Marrón Claro (variante)
  '5': '#6d402c',      // ID 5 = Marrón (fallback numérico)

  // Bronce
  'BR': '#8b6b4a',     // Bronce
  'BRC': '#9a7a58',    // Bronce Claro
  'BRO': '#7a5a3c',    // Bronce Oscuro
  'BRM': '#8b6b4a',    // Bronce Medio
  'BRN': '#8b6b4a',    // Bronce Natural
  'BRV': '#8b6b4a',    // Bronce Viejo
  'BRL': '#9a7a58',    // Bronce Liso
  'BRB': '#6a4a2e',    // Bronce Oscuro (variante)
  '6': '#8b6b4a',      // ID 6 = Bronce (fallback numérico)

  // Roble / Oak
  'RO': '#8b6e42',     // Roble
  'ROC': '#9a7e52',    // Roble Claro
  'ROO': '#7a5e32',    // Roble Oscuro
  'ROM': '#8b6e42',    // Roble Medio
  'RON': '#8b6e42',    // Roble Natural
  'ROG': '#8b6e42',    // Roble Golden
  'ROH': '#9a7e52',    // Roble Honey
  'ROB': '#6a4e22',    // Roble Oscuro (variante)
  'ROD': '#6a4e22',    // Roble Dark
  'ROL': '#9a7e52',    // Roble Light
  '7': '#8b6e42',      // ID 7 = Roble (fallback numérico)

  // Wengué
  'WE': '#3a2214',     // Wengué
  'WEC': '#4a2e1c',    // Wengué Claro
  'WEO': '#2e180a',    // Wengué Oscuro
  'WEN': '#3a2214',    // Wengué Natural
  'WEM': '#3a2214',    // Wengué Medio
  'WED': '#2e180a',    // Wengué Dark
  '8': '#3a2214',      // ID 8 = Wengué (fallback numérico)

  // Teca / Teak
  'TE': '#8a6e3e',     // Teca
  'TEC': '#9a7e4e',    // Teca Claro
  'TEO': '#7a5e2e',    // Teca Oscuro
  'TEN': '#8a6e3e',    // Teca Natural
  'TEG': '#8a6e3e',    // Teca Golden
  'TED': '#6a4e1e',    // Teca Dark
  '9': '#8a6e3e',      // ID 9 = Teca (fallback numérico)

  // Aluminio / Plata
  'AL': '#d5d4d1',     // Aluminio
  'ALN': '#d5d4d1',    // Aluminio Natural
  'ALB': '#e0dfdc',    // Aluminio Brillante
  'ALM': '#c8c7c4',    // Aluminio Mate
  'ALS': '#d0cfcc',    // Aluminio Satinado
  'ALP': '#dad9d6',    // Aluminio Plateado
  'ALC': '#c0bfbc',    // Aluminio Cepillado
  'ALO': '#b8b7b4',    // Aluminio Oxidado
  'ALL': '#e0dfdc',    // Aluminio Liso
  'ALG': '#d5d4d1',    // Aluminio Gris
  'ALV': '#d5d4d1',    // Aluminio Vintage
  'ALH': '#c5c4c1',    // Aluminio Híbrido
  'ALE': '#d5d4d1',    // Aluminio Escarchado
  'ALR': '#d5d4d1',    // Aluminio Reciclado
  'ALF': '#d5d4d1',    // Aluminio Frío
  'ALW': '#d5d4d1',    // Aluminio Warm
  'ALCL': '#c0bfbc',   // Aluminio Claro (variante)
  '10': '#d5d4d1',     // ID 10 = Aluminio (fallback numérico)

  // Colores especiales
  'ROJ': '#c0392b',    // Rojo
  'ROJN': '#a93226',   // Rojo Oscuro
  'ROJC': '#d35400',   // Rojo Claro
  'AZ': '#2980b9',     // Azul
  'AZO': '#1a5276',    // Azul Oscuro
  'AZC': '#5dade2',    // Azul Claro
  'AZM': '#2e86c1',    // Azul Marino
  'VE': '#27ae60',     // Verde
  'VEO': '#1e8449',    // Verde Oscuro
  'VEC': '#52be80',    // Verde Claro
  'AM': '#f39c12',     // Amarillo
  'AMO': '#d68910',    // Amarillo Oscuro
  'AMC': '#f7dc6f',    // Amarillo Claro
  'NA': '#e67e22',     // Naranja
  'NAO': '#ca6f1e',    // Naranja Oscuro
  'NAC': '#eb984e',    // Naranja Claro
  'VI': '#8e44ad',     // Violeta
  'VIO': '#6c3483',    // Violeta Oscuro
  'VIC': '#a569bd',    // Violeta Claro
  'BE': '#d4c5a9',     // Beige
  'BEC': '#dccdb1',    // Beige Claro
  'BEO': '#c4b599',    // Beige Oscuro
  'CR': '#e8e0d0',     // Crema
  'CRC': '#f0e8d8',    // Crema Claro
  'CRO': '#d8d0c0',    // Crema Oscuro
  'DO': '#c0a060',     // Dorado
  'DOC': '#d0b070',    // Dorado Claro
  'DOO': '#b09050',    // Dorado Oscuro
  'PL': '#c0c0c0',     // Plateado
  'PLC': '#d0d0d0',    // Plateado Claro
  'PLO': '#b0b0b0',    // Plateado Oscuro
  'CO': '#b87333',     // Cobre
  'COC': '#c88343',    // Cobre Claro
  'COO': '#a86323',    // Cobre Oscuro
  'CH': '#7b3f00',     // Chocolate
  'CHC': '#8b4f10',    // Chocolate Claro
  'CHO': '#6b2f00',    // Chocolate Oscuro
};

// ─── Fallback por descripción (cuando no hay código) ──────────────────────────

/**
 * Patrones de búsqueda en descripciones de acabado para inferir el color.
 * Se usa cuando el código de acabado no está en el mapa.
 */
const DESCRIPTION_PATTERNS: Array<{ pattern: RegExp; color: string }> = [
  { pattern: /nogal|madera|wood|golden\s*oak|oak|wenge|teak/i, color: '#6e4528' },
  { pattern: /negro|black(?:\s*mat)?|mattex?\s+kitami|kitami-dark/i, color: '#212225' },
  { pattern: /marron|brown|bronce/i, color: '#6d402c' },
  { pattern: /blanco|white/i, color: '#f5f4ef' },
  { pattern: /gris|gray|grau/i, color: '#838688' },
  { pattern: /rojo|red/i, color: '#c0392b' },
  { pattern: /azul|blue/i, color: '#2980b9' },
  { pattern: /verde|green/i, color: '#27ae60' },
  { pattern: /amarillo|yellow/i, color: '#f39c12' },
  { pattern: /naranja|orange/i, color: '#e67e22' },
  { pattern: /violeta|purple|morado/i, color: '#8e44ad' },
  { pattern: /beige|crema|cream/i, color: '#d4c5a9' },
  { pattern: /dorado|gold|golden/i, color: '#c0a060' },
  { pattern: /plateado|silver|plata/i, color: '#c0c0c0' },
  { pattern: /cobre|copper/i, color: '#b87333' },
  { pattern: /chocolate/i, color: '#7b3f00' },
  { pattern: /aluminio|aluminum|aluminium/i, color: '#d5d4d1' },
];

// ─── Color por defecto ────────────────────────────────────────────────────────

const DEFAULT_FRAME_COLOR = '#d5d4d1';

// ─── Funciones de color ───────────────────────────────────────────────────────

/**
 * Obtiene el color hex del marco para un código de acabado HETMO.
 *
 * @param codigo - Código de acabado HETMO (ej. 'NO', 'BL', 'GR')
 * @param descripcion - Descripción del acabado (fallback si no hay código)
 * @param patron - Patrón del acabado (fallback adicional)
 * @returns Color hex del marco
 */
export function getFrameColor(
  codigo?: string,
  descripcion?: string,
  patron?: string
): string {
  if (codigo) {
    const normalized = codigo.trim().toUpperCase();
    if (FINISH_MAP[normalized]) {
      return FINISH_MAP[normalized];
    }
  }

  // Fallback: buscar en descripción
  const label = [descripcion, patron, codigo]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es');

  for (const { pattern, color } of DESCRIPTION_PATTERNS) {
    if (pattern.test(label)) {
      return color;
    }
  }

  return DEFAULT_FRAME_COLOR;
}

/**
 * Crea un objeto FinishColors a partir de los datos de acabado de una ventana.
 *
 * @param codigo - Código de acabado HETMO
 * @param descripcion - Descripción del acabado
 * @param patron - Patrón del acabado
 * @returns Objeto FinishColors con el color del marco
 */
export function createFinish(
  codigo?: string,
  descripcion?: string,
  patron?: string
): FinishColors {
  return {
    frame: getFrameColor(codigo, descripcion, patron),
  };
}

// ─── Funciones auxiliares de manipulación de color ────────────────────────────

/**
 * Convierte un color hex a RGB.
 */
export function hexRgb(value: string): [number, number, number] {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(value || ''));
  return match
    ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
    : [101, 65, 39];
}

/**
 * Mezcla dos colores hex en una proporción dada.
 *
 * @param value - Color base
 * @param target - Color destino
 * @param ratio - Proporción de mezcla (0 = solo base, 1 = solo destino)
 * @returns Color hex mezclado
 */
export function mixedColor(value: string, target: string, ratio: number): string {
  const source = hexRgb(value);
  const destination = hexRgb(target);
  const mixed = source.map((part, index) =>
    Math.round(part + (destination[index] - part) * ratio)
  ) as [number, number, number];
  return `#${mixed.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Genera un conjunto de colores de perfil (base, light, dark) a partir
 * de un color de acabado.
 *
 * @param finish - Color de acabado del marco
 * @returns ProfileColorSet con base, light y dark
 */
export function profileColors(finish: FinishColors): ProfileColorSet {
  const base = finish.frame;
  return {
    base,
    light: mixedColor(base, '#ffffff', 0.34),
    dark: mixedColor(base, '#000000', 0.30),
  };
}

/**
 * Genera un conjunto de colores metálicos (base, light, edge) para herrajes.
 *
 * @param baseColor - Color base del metal
 * @returns MetalColorSet con base, light y edge
 */
export function metalColors(baseColor: string): MetalColorSet {
  return {
    base: baseColor,
    light: mixedColor(baseColor, '#ffffff', 0.55),
    edge: mixedColor(baseColor, '#000000', 0.45),
  };
}

// ─── Nomenclatura de vidrios ──────────────────────────────────────────────────

/**
 * Catálogo de nomenclatura de vidrios HETMO.
 * Cada código describe una configuración de vidrio (monolítico, doble, triple,
 * laminado, templado, etc.) con su color de representación visual.
 *
 * Basado en el catálogo de vidrios HETMO.
 */
export const GLASS_NOMENCLATURE: Record<string, GlassNomenclature> = {
  // Monolíticos
  '3':  { codigo: '3',  descripcion: 'Vidrio monolítico 3mm', color: '#d8f2f4', esIncoloro: true },
  '4':  { codigo: '4',  descripcion: 'Vidrio monolítico 4mm', color: '#d8f2f4', esIncoloro: true },
  '5':  { codigo: '5',  descripcion: 'Vidrio monolítico 5mm', color: '#d8f2f4', esIncoloro: true },
  '6':  { codigo: '6',  descripcion: 'Vidrio monolítico 6mm', color: '#d8f2f4', esIncoloro: true },
  '8':  { codigo: '8',  descripcion: 'Vidrio monolítico 8mm', color: '#d8f2f4', esIncoloro: true },
  '10': { codigo: '10', descripcion: 'Vidrio monolítico 10mm', color: '#d8f2f4', esIncoloro: true },

  // Doble vidriado hermético (DVH) — formato "X/Y/X"
  '4/6/4':   { codigo: '4/6/4',   descripcion: 'DVH 4+6+4', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '4/9/4':   { codigo: '4/9/4',   descripcion: 'DVH 4+9+4', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '4/12/4':  { codigo: '4/12/4',  descripcion: 'DVH 4+12+4', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '4/15/4':  { codigo: '4/15/4',  descripcion: 'DVH 4+15+4', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '4/18/4':  { codigo: '4/18/4',  descripcion: 'DVH 4+18+4', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '4/20/4':  { codigo: '4/20/4',  descripcion: 'DVH 4+20+4', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '5/9/5':   { codigo: '5/9/5',   descripcion: 'DVH 5+9+5', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '5/12/5':  { codigo: '5/12/5',  descripcion: 'DVH 5+12+5', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '5/15/5':  { codigo: '5/15/5',  descripcion: 'DVH 5+15+5', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '6/9/6':   { codigo: '6/9/6',   descripcion: 'DVH 6+9+6', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '6/12/6':  { codigo: '6/12/6',  descripcion: 'DVH 6+12+6', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '6/15/6':  { codigo: '6/15/6',  descripcion: 'DVH 6+15+6', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '8/12/8':  { codigo: '8/12/8',  descripcion: 'DVH 8+12+8', color: '#d8f2f4', esDoble: true, esIncoloro: true },
  '4/12/3+3': { codigo: '4/12/3+3', descripcion: 'DVH 4+12+3+3 laminado', color: '#d8f2f4', esDoble: true, esLaminado: true },
  '3+3/12/4': { codigo: '3+3/12/4', descripcion: 'DVH 3+3 laminado +12+4', color: '#d8f2f4', esDoble: true, esLaminado: true },
  '4/12/4+4': { codigo: '4/12/4+4', descripcion: 'DVH 4+12+4+4 laminado', color: '#d8f2f4', esDoble: true, esLaminado: true },

  // Triple vidriado hermético (TVH)
  '4/12/4/12/4': { codigo: '4/12/4/12/4', descripcion: 'TVH 4+12+4+12+4', color: '#c8e8ea', esTriple: true, esIncoloro: true },
  '4/15/4/15/4': { codigo: '4/15/4/15/4', descripcion: 'TVH 4+15+4+15+4', color: '#c8e8ea', esTriple: true, esIncoloro: true },

  // Laminados
  '3+3': { codigo: '3+3', descripcion: 'Laminado 3+3mm', color: '#d0eef0', esLaminado: true },
  '4+4': { codigo: '4+4', descripcion: 'Laminado 4+4mm', color: '#d0eef0', esLaminado: true },
  '5+5': { codigo: '5+5', descripcion: 'Laminado 5+5mm', color: '#d0eef0', esLaminado: true },
  '6+6': { codigo: '6+6', descripcion: 'Laminado 6+6mm', color: '#d0eef0', esLaminado: true },
  '8+8': { codigo: '8+8', descripcion: 'Laminado 8+8mm', color: '#d0eef0', esLaminado: true },

  // Templados
  'T4':  { codigo: 'T4',  descripcion: 'Templado 4mm', color: '#d8f2f4', esTemplado: true, esIncoloro: true },
  'T5':  { codigo: 'T5',  descripcion: 'Templado 5mm', color: '#d8f2f4', esTemplado: true, esIncoloro: true },
  'T6':  { codigo: 'T6',  descripcion: 'Templado 6mm', color: '#d8f2f4', esTemplado: true, esIncoloro: true },
  'T8':  { codigo: 'T8',  descripcion: 'Templado 8mm', color: '#d8f2f4', esTemplado: true, esIncoloro: true },
  'T10': { codigo: 'T10', descripcion: 'Templado 10mm', color: '#d8f2f4', esTemplado: true, esIncoloro: true },

  // Bajo emisivo (Low-E)
  '4/12/4+LE': { codigo: '4/12/4+LE', descripcion: 'DVH 4+12+4 Low-E', color: '#c8e8f0', esDoble: true, esBajoEmisivo: true },
  '4/15/4+LE': { codigo: '4/15/4+LE', descripcion: 'DVH 4+15+4 Low-E', color: '#c8e8f0', esDoble: true, esBajoEmisivo: true },
  '6/12/6+LE': { codigo: '6/12/6+LE', descripcion: 'DVH 6+12+6 Low-E', color: '#c8e8f0', esDoble: true, esBajoEmisivo: true },

  // Especiales
  'SIN': { codigo: 'SIN', descripcion: 'Sin vidrio', color: '#ffffff' },
};

/**
 * Obtiene la nomenclatura de un vidrio por su código HETMO.
 *
 * @param codigo - Código de vidrio HETMO (ej. '4/12/4', '3+3', 'T6')
 * @returns Objeto GlassNomenclature o undefined si no se encuentra
 */
export function getGlassNomenclature(codigo?: string): GlassNomenclature | undefined {
  if (!codigo) return undefined;
  const normalized = codigo.trim();
  return GLASS_NOMENCLATURE[normalized];
}

/**
 * Obtiene la descripción de un vidrio por su código HETMO.
 *
 * @param codigo - Código de vidrio HETMO
 * @returns Descripción del vidrio, o el código si no se encuentra
 */
export function getGlassDescription(codigo?: string): string {
  const nom = getGlassNomenclature(codigo);
  return nom ? nom.descripcion : codigo || '';
}

/**
 * Obtiene el color de representación de un vidrio por su código HETMO.
 *
 * @param codigo - Código de vidrio HETMO
 * @returns Color hex del vidrio, o el color por defecto si no se encuentra
 */
export function getGlassColor(codigo?: string): string {
  const nom = getGlassNomenclature(codigo);
  return nom ? nom.color : VISUAL.glass;
}

// ─── Nomenclatura de barrotillos (muntins) ────────────────────────────────────

/**
 * Catálogo de nomenclatura de barrotillos HETMO.
 * Los barrotillos son rejillas decorativas dentro del vidrio.
 */
export const MUNTIN_NOMENCLATURE: Record<string, MuntinNomenclature> = {
  'BAR':   { codigo: 'BAR',   descripcion: 'Barrotillo estándar', color: '#ffffff', ancho: 18 },
  'BARF':  { codigo: 'BARF',  descripcion: 'Barrotillo fino', color: '#ffffff', ancho: 12 },
  'BARG':  { codigo: 'BARG',  descripcion: 'Barrotillo grueso', color: '#ffffff', ancho: 25 },
  'BARV':  { codigo: 'BARV',  descripcion: 'Barrotillo victoriano', color: '#ffffff', ancho: 18 },
  'BARA':  { codigo: 'BARA',  descripcion: 'Barrotillo americano', color: '#ffffff', ancho: 22 },
  'BARC':  { codigo: 'BARC',  descripcion: 'Barrotillo colonial', color: '#ffffff', ancho: 15 },
  'BARM':  { codigo: 'BARM',  descripcion: 'Barrotillo mixto', color: '#ffffff', ancho: 18 },
  'BARE':  { codigo: 'BARE',  descripcion: 'Barrotillo entrepaño', color: '#ffffff', ancho: 18 },
  'BARD':  { codigo: 'BARD',  descripcion: 'Barrotillo decorativo', color: '#ffffff', ancho: 20 },
};

/**
 * Obtiene la nomenclatura de un barrotillo por su código.
 *
 * @param codigo - Código de barrotillo
 * @returns Objeto MuntinNomenclature o undefined si no se encuentra
 */
export function getMuntinNomenclature(codigo?: string): MuntinNomenclature | undefined {
  if (!codigo) return undefined;
  const normalized = codigo.trim().toUpperCase();
  return MUNTIN_NOMENCLATURE[normalized];
}

/**
 * Obtiene el color de un barrotillo. Si no está en el catálogo,
 * devuelve el color del marco proporcionado.
 *
 * @param codigo - Código de barrotillo
 * @param frameColor - Color del marco (fallback)
 * @returns Color hex del barrotillo
 */
export function getMuntinColor(codigo?: string, frameColor?: string): string {
  const nom = getMuntinNomenclature(codigo);
  return nom ? nom.color : (frameColor || '#ffffff');
}

// ─── Nomenclatura de travesaños (traverses) ───────────────────────────────────

/**
 * Catálogo de nomenclatura de travesaños HETMO.
 * Los travesaños son barras horizontales/verticales que dividen el vidrio.
 */
export const TRAVERSE_NOMENCLATURE: Record<string, TraverseNomenclature> = {
  'TRA':   { codigo: 'TRA',   descripcion: 'Travesaño estándar', color: '#ffffff', ancho: 20 },
  'TRAF':  { codigo: 'TRAF',  descripcion: 'Travesaño fino', color: '#ffffff', ancho: 14 },
  'TRAG':  { codigo: 'TRAG',  descripcion: 'Travesaño grueso', color: '#ffffff', ancho: 28 },
  'TRAM':  { codigo: 'TRAM',  descripcion: 'Travesaño medio', color: '#ffffff', ancho: 20 },
  'TRAE':  { codigo: 'TRAE',  descripcion: 'Travesaño estructural', color: '#ffffff', ancho: 25 },
  'TRAD':  { codigo: 'TRAD',  descripcion: 'Travesaño decorativo', color: '#ffffff', ancho: 18 },
};

/**
 * Obtiene la nomenclatura de un travesaño por su código.
 *
 * @param codigo - Código de travesaño
 * @returns Objeto TraverseNomenclature o undefined si no se encuentra
 */
export function getTraverseNomenclature(codigo?: string): TraverseNomenclature | undefined {
  if (!codigo) return undefined;
  const normalized = codigo.trim().toUpperCase();
  return TRAVERSE_NOMENCLATURE[normalized];
}

/**
 * Obtiene el color de un travesaño. Si no está en el catálogo,
 * devuelve el color del marco proporcionado.
 *
 * @param codigo - Código de travesaño
 * @param frameColor - Color del marco (fallback)
 * @returns Color hex del travesaño
 */
export function getTraverseColor(codigo?: string, frameColor?: string): string {
  const nom = getTraverseNomenclature(codigo);
  return nom ? nom.color : (frameColor || '#ffffff');
}
