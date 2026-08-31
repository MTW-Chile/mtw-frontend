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
export const FINISH_MAP: Record<string, string> = {
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

  // Marrones / Nogal
  'NO': '#6e4528',     // Nogal
  'NOC': '#7a4e2e',    // Nogal Claro
  'NOO': '#5c3a22',    // Nogal Oscuro
  'NOM': '#6e4528',    // Nogal Medio
  'NON': '#63402a',    // Nogal Natural
  'NOH': '#7a5030',    // Nogal Honey
  'NOL': '#8a5a38',    // Nogal Light
  'NOD': '#4e301e',    // Nogal Dark
  'NOCL': '#8a5a38',   // Nogal Claro (variante)
  // NOV ("Nogal Vintage") se retira: el valor anterior (#7250a0, morado) no
  // calza con ningún nogal real y no hay forma de verificarlo contra el
  // catálogo HETMO. Sin entrada aquí, cae al patrón "nogal" de
  // DESCRIPTION_PATTERNS, que sí resuelve un marrón correcto.

  // Marrones
  'MA': '#6d402c',     // Marrón
  'MAC': '#7d4e36',    // Marrón Claro
  'MAO': '#5a3422',    // Marrón Oscuro
  'MAM': '#6d402c',    // Marrón Medio
  'MAR': '#6d402c',    // Marrón Rojizo
  'MAT': '#6d402c',    // Marrón Tierra
  'MAB': '#4a2a1c',    // Marrón Barro
  'MACL': '#7d4e36',   // Marrón Claro (variante)

  // Bronce
  'BR': '#8b6b4a',     // Bronce
  'BRC': '#9a7a58',    // Bronce Claro
  'BRO': '#7a5a3c',    // Bronce Oscuro
  'BRM': '#8b6b4a',    // Bronce Medio
  'BRN': '#8b6b4a',    // Bronce Natural
  'BRV': '#8b6b4a',    // Bronce Viejo
  'BRL': '#9a7a58',    // Bronce Liso
  'BRB': '#6a4a2e',    // Bronce Oscuro (variante)

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

  // Wengué
  'WE': '#3a2214',     // Wengué
  'WEC': '#4a2e1c',    // Wengué Claro
  'WEO': '#2e180a',    // Wengué Oscuro
  'WEN': '#3a2214',    // Wengué Natural
  'WEM': '#3a2214',    // Wengué Medio
  'WED': '#2e180a',    // Wengué Dark

  // Teca / Teak
  'TE': '#8a6e3e',     // Teca
  'TEC': '#9a7e4e',    // Teca Claro
  'TEO': '#7a5e2e',    // Teca Oscuro
  'TEN': '#8a6e3e',    // Teca Natural
  'TEG': '#8a6e3e',    // Teca Golden
  'TED': '#6a4e1e',    // Teca Dark

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

  // ─── Códigos numéricos confirmados contra C_ACABADOS de HETMO ──────────────
  // HETMO usa códigos numéricos propios del proveedor (Tecnocom Perfiles),
  // no un código con nombre corto como los de arriba. A diferencia de los
  // numéricos que se retiraron antes de este mapa (eran adivinanzas sin
  // forma de verificar), estos vienen de una consulta SQL directa contra
  // C_ACABADOS (CODIGO/DESCRIPCION) en la base de HETMO -- son los que
  // realmente están en uso, ordenados por frecuencia real en Postgres (ver
  // `npm run report:acabados` en mtw-relay-api). El hex de cada uno se
  // toma del color ya validado arriba para el mismo nombre (ej. 7040
  // "Nogal" -> mismo hex que 'NO'); cuando no hay nombre exactamente igual
  // arriba, se usa el más cercano por descripción (ej. "Golden Oak" ->
  // 'ROG' Roble Golden). PALETA_EXTERIOR/INTERIOR de C_ACABADOS resultó no
  // confiable para la mayoría de las filas (queda en blanco por defecto,
  // sin configurar) salvo para un puñado de códigos donde sí trae un valor
  // real; esos dos casos se marcan abajo.
  '5': '#804000',      // Marrón -- PALETA_EXTERIOR real de HETMO (128,64,0)
  '6': '#212225',      // Negro -- mismo hex que 'NE'
  '6997': '#f5f4ef',   // Blanco -- mismo hex que 'BL'
  '7000': '#8b6e42',   // Golden Oak -- mismo hex que 'ROG' (Roble Golden)
  '7020': '#8d8f92',   // Gris Grafito -- mismo hex que 'GRA'
  '7040': '#6e4528',   // Nogal -- mismo hex que 'NO'
  '7075': '#8a5a38',   // Toffe -- mismo hex que 'NOL' (Nogal Light, tono caramelo cercano)
  '7130': '#c0c0c0',   // Gri Alum -- PALETA_EXTERIOR real de HETMO (192,192,192)
  '7279': '#18191b',   // Jet Black -- mismo hex que 'NEB' (Negro Brillante)
  '7310': '#161719',   // Matex Kitami -- mismo hex que 'NEK' (Negro Kitami)
  '7320': '#1a1b1d',   // Black Matt -- mismo hex que 'NEM' (Negro Mate)
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
 * @param materialAcabados - Acabados de los materiales de la línea (fallback
 *   final si la ventana no trae código/descripción/patrón propios)
 * @returns Color hex del marco
 */
export function getFrameColor(
  codigo?: string,
  descripcion?: string,
  patron?: string,
  materialAcabados?: string[]
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

  // Fallback: acabado declarado en los materiales de la línea (perfil,
  // tapajuntas, etc.), cuando la ventana no trae acabado propio.
  for (const acabado of materialAcabados ?? []) {
    if (!acabado) continue;
    const normalized = acabado.trim().toUpperCase();
    if (FINISH_MAP[normalized]) {
      return FINISH_MAP[normalized];
    }
    const materialLabel = acabado.toLocaleLowerCase('es');
    for (const { pattern, color } of DESCRIPTION_PATTERNS) {
      if (pattern.test(materialLabel)) {
        return color;
      }
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
 * @param materialAcabados - Acabados de los materiales de la línea (fallback final)
 * @returns Objeto FinishColors con el color del marco
 */
export function createFinish(
  codigo?: string,
  descripcion?: string,
  patron?: string,
  materialAcabados?: string[]
): FinishColors {
  return {
    frame: getFrameColor(codigo, descripcion, patron, materialAcabados),
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

// ─── Nombres oficiales de acabados HETMO ───────────────────────────────────────

/**
 * Nombres oficiales de acabados de HETMO (tabla C_ACABADOS / Tecnocom Perfiles).
 */
export const FINISH_NAMES: Record<string, string> = {
  // Códigos numéricos confirmados contra C_ACABADOS de HETMO
  '5': 'Marrón',
  '6': 'Negro',
  '6997': 'Blanco',
  '7000': 'Golden Oak',
  '7020': 'Gris Grafito',
  '7040': 'Nogal',
  '7075': 'Toffe',
  '7130': 'Gri Alum',
  '7279': 'Jet Black',
  '7310': 'Matex Kitami',
  '7320': 'Black Matt',

  // Códigos alfabéticos estándar de catálogo
  'BL': 'Blanco',
  'BLA': 'Blanco',
  'BLN': 'Blanco Nieve',
  'BLM': 'Blanco Marfil',
  'BLC': 'Blanco Claro',
  'BLR': 'Blanco Roto',
  'BCO': 'Blanco Puro',
  'BLAN': 'Blanco',
  'BLANCO': 'Blanco',
  'WHITE': 'Blanco',
  'GR': 'Gris',
  'GRA': 'Gris Grafito',
  'GRC': 'Gris Claro',
  'GRO': 'Gris Oscuro',
  'NE': 'Negro',
  'NEM': 'Negro Mate',
  'NEB': 'Negro Brillante',
  'NEK': 'Negro Kitami',
  'NO': 'Nogal',
  'NOC': 'Nogal Claro',
  'NOO': 'Nogal Oscuro',
  'ROG': 'Roble Golden',
  'RO': 'Roble',
  'TE': 'Teka',
  'WE': 'Wengue',
  'MA': 'Madera',
  'BR': 'Bronce',
  'AL': 'Aluminio',
  'DO': 'Dorado',
  'PL': 'Plateado',
};

/**
 * Obtiene la etiqueta amigable del acabado mostrando su nombre oficial y código.
 * Si ya viene una descripción clara en la base de datos, la utiliza.
 */
export function getAcabadoLabel(codigo?: string | null, descripcion?: string | null): string {
  if (descripcion && descripcion.trim() && descripcion.trim().toLowerCase() !== (codigo || '').trim().toLowerCase()) {
    return descripcion.trim();
  }
  const cleanCode = (codigo || '').trim().toUpperCase();
  if (cleanCode && FINISH_NAMES[cleanCode]) {
    return `${FINISH_NAMES[cleanCode]} (${cleanCode})`;
  }
  return codigo || 'Estándar';
}

