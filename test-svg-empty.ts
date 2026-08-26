import { toLegacyLine } from './src/modules/cotizaciones/components/drawing/ventanaAdapter.js';
import { build } from './src/modules/cotizaciones/components/drawing/legacyGeometrySvg.js';

const v = {
  anchoMm: 975,
  altoMm: 1350,
  dibujoTipoApertura: 0,
  acabadoCodigo: null,
  acabadoDescripcion: 'Blanco',
  geometrias: []
};
const l = toLegacyLine(v);
console.log('Legacy Line:', JSON.stringify(l, null, 2));
console.log('SVG:', build(l, 'line'));
