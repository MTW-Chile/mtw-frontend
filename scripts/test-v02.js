const raw = [
  { tipoElemento: 10000, perteneceHueco: 0, posicion: 1, anchoMm: 1100, ordenGeometria: 1 },
  { tipoElemento: 10000, perteneceHueco: 0, posicion: 2, anchoMm: 1100, ordenGeometria: 2 },
  { tipoElemento: 10000, perteneceHueco: 0, posicion: 3, anchoMm: 1400, ordenGeometria: 3 },
  { tipoElemento: 10000, perteneceHueco: 0, posicion: 4, anchoMm: 1100, ordenGeometria: 4 },
  { tipoElemento: 10000, perteneceHueco: 0, posicion: 5, anchoMm: 1100, ordenGeometria: 5 },
  // Duplicate 10000 for the door?
  { tipoElemento: 10000, perteneceHueco: 0, posicion: 3, anchoMm: 1400, ordenGeometria: 6 },
  
  // The door aperture
  { tipoElemento: 3, perteneceHueco: 0, posicion: 3, anchoMm: 1400, tipoApertura: 21 }
];

const huecosMap = new Map();
let fallbackId = 1;

raw
  .filter(g => Number(g.tipoElemento) === 10000 && (Number(g.anchoMm) || 0) > 0)
  .sort((a, b) => (a.ordenGeometria ?? 0) - (b.ordenGeometria ?? 0))
  .forEach(g => {
      const id = Number(g.perteneceHueco) || Number(g.posicion) || fallbackId++;
      const key = String(id);
      if (!huecosMap.has(key)) {
        huecosMap.set(key, g);
      }
  });

const panelGeos = Array.from(huecosMap.values());
console.log('Panels:', panelGeos.length); // Should be 5

const openingGeos = raw.filter(g => Number(g.tipoElemento) === 3);

panelGeos.forEach((p, idx) => {
    const w = Number(p.anchoMm);
    const matchingOpening = openingGeos.find(o => {
        const oHueco = Number(o.perteneceHueco) || 0;
        const pHueco = Number(p.perteneceHueco) || 0;
        if (oHueco > 0 && pHueco > 0 && oHueco === pHueco) return true;

        const oPos = Number(o.posicion) || 0;
        const pPos = Number(p.posicion) || 0;
        if (oPos > 0 && pPos > 0 && oPos === pPos) return true;

        if (oHueco === 0 && oPos === 0 && o.anchoMm != null && Math.abs(Number(o.anchoMm) - w) < 5) return true;

        return false;
    });
    console.log(`Panel ${idx + 1} (${w}mm): matched ->`, matchingOpening ? matchingOpening.tipoApertura : 'None');
});
