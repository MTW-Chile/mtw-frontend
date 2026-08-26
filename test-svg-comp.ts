import { toLegacyLine } from './src/modules/cotizaciones/components/drawing/ventanaAdapter.js';
import { build } from './src/modules/cotizaciones/components/drawing/legacyGeometrySvg.js';

const v = {
  anchoMm: 5700,
  altoMm: 2400,
  dibujoTipoApertura: 0,
  acabadoCodigo: null,
  acabadoDescripcion: 'Blanco',
  geometrias: [
    { tipoElemento: 10000, perteneceHueco: 0, posicion: 1, anchoMm: 1100, altoMm: 2400, ordenGeometria: 1 },
    { tipoElemento: 10000, perteneceHueco: 0, posicion: 2, anchoMm: 1100, altoMm: 2400, ordenGeometria: 2 },
    { tipoElemento: 10000, perteneceHueco: 0, posicion: 3, anchoMm: 1400, altoMm: 2400, ordenGeometria: 3 },
    { tipoElemento: 10000, perteneceHueco: 0, posicion: 4, anchoMm: 1100, altoMm: 2400, ordenGeometria: 4 },
    { tipoElemento: 10000, perteneceHueco: 0, posicion: 5, anchoMm: 1100, altoMm: 2400, ordenGeometria: 5 },
    { tipoElemento: 3, perteneceHueco: 0, posicion: 3, anchoMm: 1400, altoMm: 2400, tipoApertura: 21 }
  ]
};
const l = toLegacyLine(v);
console.log('Legacy Line:', JSON.stringify(l, null, 2));
const svg = build(l, 'line');
console.log('SVG:', svg);
