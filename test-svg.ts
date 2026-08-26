import { toLegacyLine } from './src/modules/cotizaciones/components/drawing/ventanaAdapter.js';
import { build } from './src/modules/cotizaciones/components/drawing/legacyGeometrySvg.js';

const v = {
  anchoMm: 1200,
  altoMm: 1500,
  dibujoTipoApertura: 21,
  acabadoCodigo: 'rojo',
  geometrias: [
    { perteneceHueco: 1, ordenGeometria: 1, tipoElemento: 10000, anchoMm: 1200, altoMm: 1500, tipoApertura: 21, numero_ventana: 1 },
    { perteneceHueco: 1, ordenGeometria: 2, tipoElemento: 3, anchoMm: 1200, altoMm: 1500, tipoApertura: 21, numero_ventana: 1 }
  ]
};
const l = toLegacyLine(v);
console.log('Legacy Line:', JSON.stringify(l, null, 2));
console.log('SVG Length:', build(l, 'line').length);
