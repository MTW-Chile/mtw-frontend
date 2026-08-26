import { toLegacyLine } from './src/modules/cotizaciones/components/drawing/ventanaAdapter.js';
import { build } from './src/modules/cotizaciones/components/drawing/legacyGeometrySvg.js';

const v = {
  anchoMm: 5700,
  altoMm: 2400,
  dibujoTipoApertura: 29,
  acabadoCodigo: null,
  acabadoDescripcion: 'Blanco',
  geometrias: []
};
const l = toLegacyLine(v);
console.log(build(l, 'line').includes('filter'));
