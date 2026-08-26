import * as core from './src/modules/cotizaciones/components/drawing/legacyGeometryCore.js';
for (const [code, item] of Object.entries(core.apertureCatalog)) {
  if (item.label && item.label.toLowerCase().includes('fijo')) {
    if (item.label.toLowerCase().includes('derecha')) console.log(code, item.label);
  }
}
