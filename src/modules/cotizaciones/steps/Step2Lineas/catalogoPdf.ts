// Armado del PDF de Catálogo Técnico (Paso 2), separado de Step2Lineas.tsx
// por el mismo motivo que presupuestoPdf.ts está separado de
// PresupuestoOferta.tsx: es lógica de documento pura, sin imports de React.
// Reutiliza el rasterizado de dibujos (rasterizarDibujos) y la paleta/escape
// de HTML ya resueltos ahí -- no tiene sentido reimplementar el recorte de
// SVG a su bounding box real por segunda vez.
import type { Proyecto, Ventana } from '../../../../types';
import { escapeHtml, HEX, rasterizarDibujos } from '../Step5Consolidacion/presupuestoPdf';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';
import { formatNumber } from '../../../../lib/utils';

export { rasterizarDibujos };

const CARD_HTML = (v: Ventana, png: string | null): string => {
  const wLine = toWindowLine(v);
  const apLabel = wLine ? core.apertureLabel(wLine) : v.modelo || '—';
  const acabadoLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
  const sup = v.m2Ventana ?? ((v.anchoMm * v.altoMm) / 1_000_000);

  return `
    <div style="break-inside:avoid;page-break-inside:avoid;border:1px solid ${HEX.borde};border-radius:10px;overflow:hidden;background:#ffffff;">
      <div style="background:${HEX.headBg};padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;font-weight:bold;color:${HEX.navy};">${escapeHtml(v.modelo)}</span>
        <span style="font-size:10px;color:${HEX.gris};font-family:monospace;">Línea #${v.lineaHetmo}</span>
      </div>
      <div style="height:160px;display:flex;align-items:center;justify-content:center;background:#f8fafc;">
        ${png ? `<img src="${png}" style="max-width:92%;max-height:92%;" />` : `<span style="font-size:10px;color:${HEX.gris};">Sin dibujo disponible</span>`}
      </div>
      <div style="padding:10px 12px;font-size:10px;color:${HEX.navy};line-height:1.6;">
        <div style="font-weight:bold;">${formatNumber(v.anchoMm, 0)} × ${formatNumber(v.altoMm, 0)} mm · ${formatNumber(sup, 2)} m²</div>
        <div style="color:${HEX.gris};">${escapeHtml(apLabel)}</div>
        <div style="color:${HEX.gris};">Acabado: ${escapeHtml(acabadoLabel)} · ${v.unidades} ${v.unidades === 1 ? 'unidad' : 'unidades'}</div>
      </div>
    </div>`;
};

export function buildCatalogoHtml(
  proyecto: Proyecto,
  ventanas: Ventana[],
  pngPorVentana: Map<string, string | null>
): string {
  const tarjetas = ventanas.map((v) => CARD_HTML(v, pngPorVentana.get(v.id) || null)).join('');

  // Ver el comentario de presupuestoPdf.ts sobre width:100%/@page sin
  // margin: mismo criterio acá, misma razón (Chromium arma el layout en
  // pixeles CSS del tamaño de página elegido, no en puntos).
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; }
  * { box-sizing: border-box; }
  body { margin: 0; }
</style>
</head>
<body>
  <div style="width:100%;font-family:Helvetica,Arial,sans-serif;background:#ffffff;padding:28px 36px;">
    <div style="border-bottom:2px solid ${HEX.rojo};padding-bottom:12px;margin-bottom:18px;">
      <div style="font-size:18px;font-weight:bold;color:${HEX.navy};">Catálogo Técnico de Líneas</div>
      <div style="font-size:11px;color:${HEX.gris};margin-top:2px;">
        ${escapeHtml(proyecto.obra)} · ${escapeHtml(proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`)} · ${ventanas.length} ${ventanas.length === 1 ? 'línea' : 'líneas'}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:14px;">
      ${tarjetas}
    </div>
  </div>
</body>
</html>`;
}
