const fs = require('fs');
let content = fs.readFileSync('src/modules/cotizaciones/components/drawing/legacyGeometrySvg.ts', 'utf8');
content = content.replace(/const lift = clamp\(weight \* \.38, \.72, 1\.05\);\r?\n\s*/, '');
fs.writeFileSync('src/modules/cotizaciones/components/drawing/legacyGeometrySvg.ts', content);
