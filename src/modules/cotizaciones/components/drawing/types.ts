/**
 * Modelo de datos interno para el sistema de renderizado de ventanas.
 * Define interfaces tipadas que reemplazan los `any` y `@ts-nocheck` actuales.
 *
 * Este modelo separa la geometría (cálculo de posiciones, tipos, aperturas)
 * del renderizado (SVG/JSX), permitiendo que ambos evolucionen independientemente.
 */

// ─── Catálogo de aperturas ───────────────────────────────────────────────────

export interface ApertureDefinition {
  family: ApertureFamily;
  label: string;
  symbol: ApertureSymbol;
  hand?: 'left' | 'right';
  hinge?: 'left' | 'right' | 'bottom' | 'top';
  tiltHinge?: 'bottom';
  axis?: 'vertical';
  face?: 'interior' | 'exterior';
  layout?: string[];
  rails?: string[];
  leafCount?: number;
  obLeaf?: number;
  confidence: string;
}

export type ApertureFamily =
  | 'fixed'
  | 'hinged'
  | 'tilt-turn'
  | 'tilt'
  | 'projecting'
  | 'pivot'
  | 'sliding'
  | 'parallel'
  | 'lift-slide'
  | 'adene-sliding'
  | 'door'
  | 'unknown';

export type ApertureSymbol =
  | 'fixed'
  | 'hinged'
  | 'tilt-turn'
  | 'tilt'
  | 'projecting'
  | 'pivot-horizontal'
  | 'pivot-vertical'
  | 'sliding'
  | 'parallel'
  | 'unknown';

// ─── Componentes de geometría HETMO ──────────────────────────────────────────

/** Una fila de geometría HETMO (tipo_elemento 3: apertura/hoja) */
export interface HetmoOpeningRow {
  orden: number;
  posicion: number;
  apertura: number;
  ancho: number;
  alto: number;
  geometria: string;
  movilLado: number;
  movilAncho: number;
  alturaManilla: number;
}

/** Una fila de geometría HETMO (tipo_elemento 40001: hoja exacta) */
export interface HetmoExactLeaf {
  numeroVentana: number;
  numeroHoja: number;
  ordenHoja: number;
  ancho: number;
  alto: number;
  carril: number;
  carrilFuente: string;
}

/** Una fila de geometría HETMO (tipo_elemento 40000: vidrio) */
export interface HetmoGlassRow {
  codigoComponente: string;
  numeroVentana: number;
  perteneceHueco: number;
  ancho: number;
  alto: number;
  barrotillosHorizontales: number;
  barrotillosVerticales: number;
}

/** Una fila de geometría HETMO (tipo_elemento 10000: paño compuesto) */
export interface HetmoPanelRow {
  numeroVentana: number;
  orden: number;
  ancho: number;
  alto: number;
  apertura: number;
  aperturaCount: number;
  movilLado: number;
  movilAncho: number;
  alturaManilla: number;
  raw: Record<string, unknown>[];
}

/** Una fila de geometría HETMO (tipo_elemento 10001: modificador de forma) */
export interface HetmoShapeModifier {
  formaCodigo: number;
  modificadorX: number;
  modificadorY: number;
}

/** Una fila de geometría HETMO (tipo_elemento 6: corte vertical) */
export interface HetmoVerticalCut {
  cota: number;
}

/** Una fila de geometría HETMO (tipo_elemento 1: base/outline) */
export interface HetmoBaseRow {
  ancho: number;
  alto: number;
  radioCurvatura: number;
  anguloCurvatura: number;
}

// ─── Hojas (leaves) ──────────────────────────────────────────────────────────

export type LeafKind =
  | 'single'
  | 'fijo'
  | 'oculta'
  | 'int:left'
  | 'int:right'
  | 'int:both'
  | 'ext:left'
  | 'ext:right'
  | 'double-hinged:left'
  | 'double-hinged:right'
  | 'double-tilt-turn:left'
  | 'double-tilt-turn:right';

export interface Leaf {
  kind: LeafKind;
  width: number;
  altura?: number;
  apertura: number;
  component?: HetmoOpeningRow | HetmoPanelRow;
  exacta?: boolean;
  carril?: number;
  carrilFuente?: string;
  oculta?: boolean;
}

export interface RailInfo {
  number: number;
  source: string;
}

// ─── Hardware (herrajes) ─────────────────────────────────────────────────────

export type HardwareRole = 'handle' | 'striker' | 'none';

export interface HardwareSpec {
  role: HardwareRole;
  style?: 'straight' | 'angled';
  side?: 'left' | 'right' | 'center';
  position?: 'top' | 'bottom';
  orientation?: 'up';
  reason: string;
  rail?: string;
}

export interface HingeInfo {
  count: number;
  reason: string;
}

// ─── Colores y acabados ──────────────────────────────────────────────────────

export interface ProfileColorSet {
  base: string;
  light: string;
  dark: string;
}

export interface MetalColorSet {
  base: string;
  light: string;
  edge: string;
}

export interface FinishColors {
  frame: string;
}

// ─── Material ────────────────────────────────────────────────────────────────

export interface LineMaterial {
  descripcionArticulo?: string;
  descripcion?: string;
  cantidad?: number;
  uds?: number;
  acabado?: string;
}

// ─── Línea de ventana (formato interno normalizado) ──────────────────────────

/**
 * Representación normalizada de una línea de ventana, lista para renderizar.
 * Es el resultado del adaptador (ventanaAdapter.ts) y la entrada del renderer.
 */
export interface WindowLine {
  /** Identificador HETMO de la línea */
  lineaHetmo?: number;
  /** Modelo comercial */
  modelo?: string;
  /** Ancho total en mm */
  ancho: number;
  /** Alto total en mm */
  alto: number;
  /** Código de apertura principal */
  tipoApertura?: number;
  /** Código de acabado HETMO */
  acabadoCodigo?: string;
  /** Descripción del acabado */
  acabadoDescripcion?: string;
  /** Patrón del acabado */
  acabadoPatron?: string;
  /** Serie de perfiles */
  seriePerfiles?: string;
  /** Unidades de la línea */
  uds?: number;
  /** Cantidad de vidrios por unidad */
  cantidadVidriosPorUnidad?: number;
  /** Códigos de vidrio declarados explícitamente */
  dibujoVidrios?: string[];
  /** Código de vidrio único (fallback) */
  dibujoVidrio?: string;
  /** Código de vidrio desde HETMO */
  vidrioCodigo?: string;
  /** Si se debe dibujar sin marco */
  dibujoSinMarco?: boolean;
  /** Código de apertura para dibujo */
  dibujoTipoApertura?: number;
  /** Ancho para dibujo (puede diferir del real) */
  dibujoAncho?: number;
  /** Alto para dibujo (puede diferir del real) */
  dibujoAlto?: number;
  /** Geometría HETMO cruda (array de filas) */
  geometria?: Record<string, unknown>[];
  /** Materiales de la línea */
  materiales?: LineMaterial[];
  /** Número de cuadros/hojas declarado */
  numeroCuadrosHojas?: number;
  /** Altura de manilla personalizada */
  alturaManilla?: number;
}

// ─── Paño compuesto ──────────────────────────────────────────────────────────

export interface CompositePanel {
  number: number;
  order: number;
  width: number;
  height: number;
  apertura: number;
  aperturaCount: number;
  movilLado: number;
  movilAncho: number;
  alturaManilla: number;
  raw: Record<string, unknown>[];
}

export interface CompositeTile {
  panel: CompositePanel;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompositeLayout {
  panels: CompositePanel[];
  tiles: CompositeTile[];
  width: number;
  height: number;
  direction: 'horizontal' | 'vertical';
  verticalCuts: number[];
}

// ─── Travesaños y particiones de vidrio ──────────────────────────────────────

export interface TraverseLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GlassSplit {
  axis: 'horizontal' | 'vertical';
  at: number;
}

export interface MuntinLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axis: 'horizontal' | 'vertical';
}

// ─── Formas especiales (outline) ─────────────────────────────────────────────

export interface CircleOutline {
  kind: 'circle';
  width: number;
  height: number;
}

export interface PolygonOutline {
  kind: 'polygon';
  points: [number, number][];
  width: number;
  height: number;
}

export type SpecialOutline = CircleOutline | PolygonOutline;

// ─── Segmentos de símbolo de apertura ────────────────────────────────────────

export interface OpeningSymbolSegment {
  role: string;
  face?: string;
  dashed: boolean;
  points: [number, number][];
}

// ─── Resultado del renderizado ───────────────────────────────────────────────

export interface RenderResult {
  svg: string;
  apertureCodes: number[];
  apertureLabel: string;
  guideCount: number;
  finishColor: string;
  glassOnly: boolean;
}

// ─── Nomenclatura de vidrios, barrotillos y travesaños ──────────────────────

/**
 * Nomenclatura de un vidrio: código HETMO → descripción y color.
 */
export interface GlassNomenclature {
  codigo: string;
  descripcion: string;
  color: string;
  esDoble?: boolean;
  esTriple?: boolean;
  esLaminado?: boolean;
  esTemplado?: boolean;
  esBajoEmisivo?: boolean;
  esIncoloro?: boolean;
}

/**
 * Nomenclatura de un barrotillo (muntin): código → descripción y color.
 */
export interface MuntinNomenclature {
  codigo: string;
  descripcion: string;
  color: string;
  ancho?: number;
}

/**
 * Nomenclatura de un travesaño (traverse): código → descripción y color.
 */
export interface TraverseNomenclature {
  codigo: string;
  descripcion: string;
  color: string;
  ancho?: number;
}

// ─── Constantes visuales ─────────────────────────────────────────────────────

export interface VisualPalette {
  glass: string;
  glassEdge: string;
  opening: string;
  dimension: string;
  glassText: string;
}
