/**
 * Barrel export para componentes atómicos de renderizado SVG de ventanas.
 * Etapa 3 de la refactorización del sistema de renderizado.
 *
 * Uso:
 *   import { WindowFrame, WindowGlass, ... } from './drawing';
 */
export { WindowFrame } from './WindowFrame';
export { WindowGlass } from './WindowGlass';
export {
  WindowOpeningSymbol,
  FixedMark,
  SlidingMark,
  HingedMark,
  DoubleHingedMark,
  DoubleTiltTurnMark,
} from './WindowOpeningSymbol';
export { WindowHardware, WindowHinge } from './WindowHardware';
export { WindowMuntins } from './WindowMuntins';
export { WindowTraverses } from './WindowTraverses';
export { WindowGlassSplits } from './WindowGlassSplits';
export { WindowSpecialOutline } from './WindowSpecialOutline';
export { WindowDimensions } from './WindowDimensions';
export {
  WindowLabels,
  ApertureLabel,
  ProfileLabel,
  GlassLabel,
  GlassCodeLabel,
} from './WindowLabels';
export { WindowSlidingGuides } from './WindowSlidingGuides';
export { WindowSlidingHardware } from './WindowSlidingHardware';
export { WindowRendererSvg } from './WindowRendererSvg';
export { buildWindow } from './windowGeometryBuilder';
export { toWindowLine } from './ventanaAdapter';
export {
  getFrameColor,
  createFinish,
  hexRgb,
  mixedColor,
  profileColors,
  metalColors,
  getGlassNomenclature,
  getGlassDescription,
  getGlassColor,
  getMuntinNomenclature,
  getMuntinColor,
  getTraverseNomenclature,
  getTraverseColor,
  GLASS_NOMENCLATURE,
  MUNTIN_NOMENCLATURE,
  TRAVERSE_NOMENCLATURE,
} from './colorSystem';

// Re-exportar tipos comunes desde types.ts para conveniencia
export type {
  WindowLine,
  Leaf,
  LeafKind,
  HardwareSpec,
  HingeInfo,
  ProfileColorSet,
  MetalColorSet,
  VisualPalette,
  FinishColors,
  LineMaterial,
  MuntinLine,
  TraverseLine,
  GlassSplit,
  SpecialOutline,
  CircleOutline,
  PolygonOutline,
  OpeningSymbolSegment,
  ApertureDefinition,
  ApertureFamily,
  ApertureSymbol,
  CompositeLayout,
  CompositePanel,
  CompositeTile,
  RenderResult,
  HetmoOpeningRow,
  HetmoExactLeaf,
  HetmoGlassRow,
  HetmoPanelRow,
  HetmoShapeModifier,
  HetmoVerticalCut,
  HetmoBaseRow,
  RailInfo,
  GlassNomenclature,
  MuntinNomenclature,
  TraverseNomenclature,
} from './types';
