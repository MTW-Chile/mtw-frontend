import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDown, Loader2, Pencil, Check } from 'lucide-react';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { formatNumber } from '../../../../lib/utils';
import { useMonedas } from '../../../../lib/monedas';
import { updatePresupuestoConfig, updateVentanaPresupuesto, renderPdf } from '../../../../api/client';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { buildWindow } from '../../components/drawing/windowGeometryBuilder';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';
import {
  computeMaterialesConsolidados,
  computeCostoTotalYVenta,
} from '../../lib/materialesConsolidados';
import { computePreciosVenta } from '../../lib/presupuesto';
import { loadImageDataUrl } from '../../lib/pdfTheme';

// Paleta en hex para el HTML del PDF -- mismos colores que pdfTheme.ts
// (MTW_NAVY/MTW_GRIS/MTW_BORDE/MTW_ROJO/MTW_HEAD_BG), pero como CSS: este PDF
// no se dibuja con primitivas de jsPDF (rect/text a mano) ni se rasteriza en
// el navegador del cliente (html2canvas) -- se arma como HTML/CSS real y el
// relay lo imprime a PDF con Chromium (ver src/pdfRenderer.ts en
// mtw-relay-api), así el resultado es literalmente lo que un navegador
// compone, sin depender del dispositivo del cliente para rasterizarlo.
// Paleta medida a pixel del documento de referencia real (Presupuesto Casa La
// Aurora, PDF del sistema anterior): borde/franja de cabecera #bacce5, filas
// zebra #f2f7fc/#ffffff alternadas, texto navy #121929, texto de etiqueta
// #52637a -- no son colores aproximados a ojo, se sacaron de la imagen del
// PDF original con un script de muestreo de pixeles.
const HEX = { navy: '#121929', gris: '#52637a', borde: '#bacce5', rojo: '#e34a26', headBg: '#bacce5', zebra: '#f2f7fc' };

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

interface PresupuestoOfertaProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  dolar: string;
  uf: string;
  euro: string;
}

const DEFAULT_CONDICIONES = `Se considera provisión e instalación de ventanas de PVC y termopaneles según especificación del proyecto.
Validez de la oferta 30 días.
Valores expresados en Unidades de Fomento (UF) más IVA.
Se considera anticipo del 10% del valor del contrato.
No se considera ningún elemento de terminación como junquillos, tubulares, remates de estuco y otros que no estén debidamente indicados en el Presupuesto.
Este presupuesto contiene las ventanas detalladas en el plano enviado por el cliente y que es parte integrante del proyecto; cualquier modificación de este deberá cotizarse nuevamente incorporando los cambios o adicionales al proyecto.`;

const DEFAULT_TEXTO = 'De acuerdo a sus requerimientos y solicitud de cotización, presentamos propuesta de Ventanas MTW con las líneas adecuadas para su proyecto.';

const ufLabel = (valorCLP: number, tasaUf: number) =>
  tasaUf > 0 ? `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valorCLP / tasaUf)} UF` : '—';

// buildWindow() no declara el namespace SVG -- no hace falta para insertarlo
// en el DOM (WindowRendererSvg lo hace vía innerHTML, donde el parser HTML5
// ya asume xmlns en un <svg> inline), pero un <img src="data:image/svg+xml">
// SÍ exige un documento standalone valido: sin xmlns el navegador descarta
// la imagen en silencio (onerror), dejando la tarjeta del PDF sin dibujo.
const ensureSvgNamespace = (svg: string) =>
  svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');

const svgToPngDataUrl = (svgRaw: string, width: number, height: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const svg = ensureSvgNamespace(svgRaw);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Sin contexto de canvas')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  });

// buildWindow() dibuja siempre dentro de un lienzo fijo (240×178) pensado
// para el visor en pantalla, donde ese espacio de sobra alrededor del dibujo
// no se nota -- pero en la tarjeta del PDF, angosta y con la ventana ya
// agrandada, ese margen fijo (hasta 30-40% del lienzo en ventanas muy
// horizontales o verticales, confirmado renderizando el SVG real de
// ventanas de Casa La Aurora) se veía como un vacío en blanco debajo del
// dibujo, no como "la ventana ocupando la tarjeta". Se recorta el viewBox
// al bounding box real de lo dibujado (marco, hojas, cotas) antes de
// rasterizar -- solo para esta exportación, no toca el visor en pantalla.
const cropSvgToContent = (svg: string): { svg: string; aspect: number } => {
  const points: [number, number][] = [];
  const push = (x: unknown, y: unknown) => {
    const nx = Number(x), ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) points.push([nx, ny]);
  };
  const attr = (tagAttrs: string, name: string): number | undefined => {
    const m = new RegExp(`\\s${name}="(-?[\\d.]+)"`).exec(tagAttrs);
    return m ? parseFloat(m[1]) : undefined;
  };

  for (const m of svg.matchAll(/<rect\b([^>]*)\/?>/g)) {
    const x = attr(m[1], 'x'), y = attr(m[1], 'y'), w = attr(m[1], 'width'), h = attr(m[1], 'height');
    if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
      push(x, y);
      push(x + w, y + h);
    }
  }
  for (const m of svg.matchAll(/<text\b([^>]*)>/g)) {
    push(attr(m[1], 'x'), attr(m[1], 'y'));
  }
  for (const m of svg.matchAll(/<line\b([^>]*)\/?>/g)) {
    push(attr(m[1], 'x1'), attr(m[1], 'y1'));
    push(attr(m[1], 'x2'), attr(m[1], 'y2'));
  }
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    const tokens = m[1].match(/[MLmlHhVv]|-?[\d.]+/g) || [];
    let cmd: string | null = null, cx = 0, cy = 0, i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; continue; }
      if (cmd === 'M' || cmd === 'L') { cx = parseFloat(tokens[i]); cy = parseFloat(tokens[i + 1]); push(cx, cy); i += 2; }
      else if (cmd === 'H') { cx = parseFloat(tokens[i]); push(cx, cy); i += 1; }
      else if (cmd === 'V') { cy = parseFloat(tokens[i]); push(cx, cy); i += 1; }
      else { i++; }
    }
  }

  if (!points.length) return { svg, aspect: 240 / 178 };
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const PAD = 6;
  const minX = Math.min(...xs) - PAD, minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - Math.min(...xs) + PAD * 2;
  const h = Math.max(...ys) - Math.min(...ys) + PAD * 2;
  return {
    svg: svg.replace(/viewBox="[^"]*"/, `viewBox="${minX} ${minY} ${w} ${h}"`),
    aspect: w / h,
  };
};

const NombreEditable: React.FC<{ ventana: Ventana; onGuardado: (v: Partial<Ventana>) => void; congelado: boolean }> = ({
  ventana,
  onGuardado,
  congelado,
}) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(ventana.modelo);
  const mutation = useMutation({
    mutationFn: () => updateVentanaPresupuesto(ventana.id, { modelo: valor.trim() || ventana.modelo }),
    onSuccess: (res) => {
      onGuardado({ modelo: res.ventana.modelo });
      setEditando(false);
    },
  });

  if (!editando) {
    return (
      <button
        type="button"
        disabled={congelado}
        onClick={() => setEditando(true)}
        className="flex items-center gap-1.5 text-left group/edit disabled:cursor-default"
      >
        <h4 className="text-sm font-black text-slate-900">{ventana.modelo}</h4>
        {!congelado && <Pencil className="w-3 h-3 text-slate-300 group-hover/edit:text-[#E34A26] shrink-0" />}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        maxLength={220}
        className="text-sm font-black text-slate-900 border-b border-[#E34A26] outline-none bg-transparent min-w-0"
      />
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="shrink-0 w-5 h-5 rounded bg-[#E34A26] text-white flex items-center justify-center"
      >
        {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
    </div>
  );
};

const ObservacionEditable: React.FC<{ ventana: Ventana; onGuardado: (v: Partial<Ventana>) => void; congelado: boolean }> = ({
  ventana,
  onGuardado,
  congelado,
}) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(ventana.comentarioPresupuesto || '');
  const mutation = useMutation({
    mutationFn: () => updateVentanaPresupuesto(ventana.id, { comentarioPresupuesto: valor.trim() || null }),
    onSuccess: (res) => {
      onGuardado({ comentarioPresupuesto: res.ventana.comentarioPresupuesto });
      setEditando(false);
    },
  });

  if (!editando && !ventana.comentarioPresupuesto) {
    return congelado ? null : (
      <button type="button" onClick={() => setEditando(true)} className="text-[11px] text-slate-400 hover:text-[#E34A26]">
        + Agregar observación
      </button>
    );
  }

  if (!editando) {
    return (
      <button type="button" disabled={congelado} onClick={() => setEditando(true)} className="text-left group/edit w-full">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Observación</span>
        <p className="text-xs text-slate-700 flex items-start gap-1">
          {ventana.comentarioPresupuesto}
          {!congelado && <Pencil className="w-3 h-3 text-slate-300 group-hover/edit:text-[#E34A26] shrink-0 mt-0.5" />}
        </p>
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <textarea
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        rows={2}
        maxLength={2000}
        className="w-full text-xs border border-slate-200 rounded-lg p-1.5 outline-none focus:border-[#E34A26]"
      />
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="px-2 py-1 rounded-md bg-[#E34A26] text-white text-[11px] font-bold flex items-center gap-1"
      >
        {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Guardar
      </button>
    </div>
  );
};

export const PresupuestoOferta: React.FC<PresupuestoOfertaProps> = ({ proyecto, activeVersion, dolar, uf, euro }) => {
  const queryClient = useQueryClient();
  const monedas = useMonedas();
  const tasaDolar = Number(dolar) || 950;
  const tasaUf = Number(uf) || 38500;
  const tasaEuro = Number(euro) || 1030;
  const congelado = Boolean(activeVersion?.esCongelado);
  const versionId = activeVersion?.id;

  const [ventanasLocal, setVentanasLocal] = useState<Record<string, Partial<Ventana>>>({});
  const ventanas = useMemo(
    () => (activeVersion?.ventanas || []).map((v) => ({ ...v, ...ventanasLocal[v.id] })),
    [activeVersion?.ventanas, ventanasLocal]
  );

  const materialesConsolidados = useMemo(
    () => computeMaterialesConsolidados(activeVersion, tasaDolar, tasaEuro, tasaUf, monedas),
    [activeVersion, tasaDolar, tasaEuro, tasaUf, monedas]
  );
  const aprobacionesPorFamilia = useMemo(
    () => new Map((activeVersion?.familiaAprobaciones || []).map((f) => [f.familia, f])),
    [activeVersion?.familiaAprobaciones]
  );
  const { venta } = useMemo(
    () => computeCostoTotalYVenta(activeVersion, materialesConsolidados, aprobacionesPorFamilia),
    [activeVersion, materialesConsolidados, aprobacionesPorFamilia]
  );
  const preciosVenta = useMemo(
    () => computePreciosVenta(ventanas, activeVersion?.sumaTotalLineas, venta),
    [ventanas, activeVersion?.sumaTotalLineas, venta]
  );
  const ivaPct = 19;
  const iva = venta * (ivaPct / 100);
  const totalConIva = venta + iva;

  const config = activeVersion?.presupuestoConfig;
  const [texto, setTexto] = useState(config?.textoPresentacion ?? DEFAULT_TEXTO);
  const [condiciones, setCondiciones] = useState(config?.condicionesComerciales ?? DEFAULT_CONDICIONES);
  const [editandoTexto, setEditandoTexto] = useState(false);
  const [editandoCondiciones, setEditandoCondiciones] = useState(false);

  const guardarTextoMutation = useMutation({
    mutationFn: () => updatePresupuestoConfig(versionId!, { textoPresentacion: texto }),
    onSuccess: () => {
      setEditandoTexto(false);
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });
  const guardarCondicionesMutation = useMutation({
    mutationFn: () => updatePresupuestoConfig(versionId!, { condicionesComerciales: condiciones }),
    onSuccess: () => {
      setEditandoCondiciones(false);
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });

  const [exportando, setExportando] = useState(false);

  const exportarPDF = async () => {
    setExportando(true);
    try {
      const codigoLabel = `Presupuesto - ${proyecto.codigoInterno || proyecto.numeroPresupuesto}`;
      const fechaLabel = new Date().toLocaleDateString('es-CL');
      const clienteNombre = proyecto.cliente?.nombre || proyecto.clienteNombreRaw;

      let logoDataUrl: string | null = null;
      let logoMuchtekDataUrl: string | null = null;
      try {
        logoDataUrl = await loadImageDataUrl('/mtw-logo.png');
      } catch {
        // El logo es decorativo -- si falla la carga, el PDF sigue sin él.
      }
      try {
        logoMuchtekDataUrl = await loadImageDataUrl('/muchtek-logo.png');
      } catch {
        // Igual de decorativo -- Muchtek Tecnoperfiles Group, proveedor del perfil.
      }
      const logoImg = logoDataUrl ? `<img src="${logoDataUrl}" style="width:92px;height:42px;display:block;margin-bottom:12px;" />` : '';
      // En el documento de referencia el logo de Muchtek (Tecnoperfiles Group,
      // el proveedor del perfil) va arriba a la derecha, a la misma altura
      // que el logo de MTW -- solo en la primera página.
      const logosHeaderHtml = logoMuchtekDataUrl
        ? `<table style="width:100%;margin-bottom:12px;"><tr>
            <td style="vertical-align:top;">${logoImg}</td>
            <td style="vertical-align:top;text-align:right;"><img src="${logoMuchtekDataUrl}" style="width:120px;height:auto;display:inline-block;" /></td>
          </tr></table>`
        : logoImg;

      // Dibujo de cada ventana, rasterizado una sola vez antes de armar el
      // HTML (el armado de HTML es síncrono; svgToPngDataUrl no lo es).
      const pngPorVentana = new Map<string, string | null>();
      await Promise.all(
        ventanas.map(async (v) => {
          const line = toWindowLine(v);
          if (!line) { pngPorVentana.set(v.id, null); return; }
          try {
            const svg = buildWindow(line, 'offer').svg;
            const { svg: svgRecortado, aspect } = cropSvgToContent(svg);
            const alturaRaster = 480;
            pngPorVentana.set(v.id, await svgToPngDataUrl(svgRecortado, Math.round(alturaRaster * aspect), alturaRaster));
          } catch {
            pngPorVentana.set(v.id, null);
          }
        })
      );

      // Cada tarjeta es HTML/CSS real (tabla con bordes), no coordenadas
      // calculadas a mano -- este HTML se manda tal cual al relay, que lo
      // imprime a PDF con Chromium real (page.pdf()), igual al documento de
      // referencia (Vista Monseñor, Casa La Aurora), no una aproximación.
      const cardHtml = (v: Ventana): string => {
        const line = toWindowLine(v);
        const isFrameless = Boolean(line?.dibujoSinMarco);
        // Una ventana sin paños con apertura declarada (p.ej. sin marco, solo
        // vidrio fijo) no debe dejar "Apertura:" en blanco -- no se abre, y
        // eso hay que decirlo, no omitirlo. apertureLabel() ya cae a
        // "Ventana fija" en casi todos los casos ambiguos, pero esta es la
        // red de seguridad final para que la fila nunca salga vacía.
        const apertura = (line ? core.apertureLabel(line) : '') || 'Ventana fija';
        // "Serie de perfiles" en el documento de referencia trae el acabado
        // pegado con un guion ("Línea Efficient - Black Matt"), no como fila
        // aparte -- mismo formato que generate_project_budget.js del sistema
        // anterior: `${serie_perfiles} - ${finish.description||finish.label}`.
        const serieBase = core.profileSeries({ modelo: v.descripcionCorta || v.modelo });
        const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
        const serieP = [serieBase !== 'Línea no especificada' ? serieBase : null, finishLabel]
          .filter(Boolean)
          .join(' - ');
        const vidrio = Array.from(
          new Set((v.materiales || []).filter((m) => !m.excluido && m.material?.familia === 'VIDRIOS').map((m) => m.material?.descripcion || ''))
        ).filter(Boolean).join(' + ');
        const herraje = Array.from(
          new Set((v.materiales || []).filter((m) => !m.excluido && m.material?.familia === 'HERRAJES').map((m) => m.material?.proveedor?.nombre || m.material?.descripcion || ''))
        ).filter(Boolean).join(' + ');
        // Mismo orden que el Presupuesto de referencia: Dimensiones, Serie de
        // perfiles con el acabado incluido (omitido en líneas SOLO DVH, que
        // no tienen perfil ni acabado), Apertura, Herrajes, Vidrios.
        const metaFilas: [string, string][] = [
          ['Dimensiones', `${formatNumber(v.anchoMm, 0)} × ${formatNumber(v.altoMm, 0)} mm`],
          ...(!isFrameless ? [['Serie de perfiles', serieP] as [string, string]] : []),
          ['Apertura', apertura],
          ...(herraje ? [['Herrajes', herraje] as [string, string]] : []),
          ...(vidrio ? [['Vidrios', vidrio] as [string, string]] : []),
        ];
        // Tabla de metadatos a todo el ancho de la tarjeta, sin grilla -- el
        // documento de referencia distingue las filas con una banda de color
        // alternada (zebra), no con líneas divisorias entre celdas.
        const metaRowsHtml = metaFilas.map(([label, value], i) => `
          <tr style="background:${i % 2 === 0 ? HEX.zebra : '#ffffff'};">
            <td style="padding:4px 10px;color:${HEX.gris};width:150px;font-size:9px;">${escapeHtml(label)}:</td>
            <td style="padding:4px 10px;color:${HEX.navy};font-weight:bold;font-size:9px;">${escapeHtml(value)}</td>
          </tr>`).join('');
        const observacionRowHtml = v.comentarioPresupuesto ? `
          <tr style="background:${metaFilas.length % 2 === 0 ? HEX.zebra : '#ffffff'};">
            <td style="padding:4px 10px;color:${HEX.gris};width:150px;font-size:9px;vertical-align:top;">Observación:</td>
            <td style="padding:4px 10px;color:${HEX.navy};font-weight:bold;font-size:9px;">${escapeHtml(v.comentarioPresupuesto)}</td>
          </tr>` : '';

        const precio = preciosVenta.get(v.id);
        const png = pngPorVentana.get(v.id);

        return `
        <div style="border:1px solid ${HEX.borde};margin-bottom:7px;page-break-inside:avoid;">
          <div style="background:${HEX.headBg};padding:6px 12px;font-size:12px;font-weight:bold;color:${HEX.navy};">${escapeHtml(v.modelo)} -</div>
          <table style="width:100%;border-collapse:collapse;">${metaRowsHtml}</table>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <tr>
              <td style="width:56%;padding:8px 10px 8px 12px;vertical-align:top;">
                ${png ? `<img src="${png}" style="max-width:230px;max-height:165px;width:auto;height:auto;display:block;" />` : ''}
              </td>
              <td style="width:44%;vertical-align:top;padding:8px 12px 8px 0;">
                <table style="width:100%;border-collapse:collapse;border:1px solid ${HEX.borde};">
                  <tr><td colspan="2" style="background:${HEX.headBg};font-weight:bold;padding:6px 10px;font-size:9px;color:${HEX.navy};">Valores comerciales</td></tr>
                  <tr><td style="padding:6px 10px;font-size:9px;color:${HEX.gris};">Precio unitario neto</td><td style="padding:6px 10px;font-size:9px;text-align:right;font-weight:bold;color:${HEX.navy};">${escapeHtml(ufLabel(precio?.precioUnitarioCLP || 0, tasaUf))}</td></tr>
                  <tr><td style="padding:6px 10px;font-size:9px;color:${HEX.gris};">Cantidad</td><td style="padding:6px 10px;font-size:9px;text-align:right;font-weight:bold;color:${HEX.navy};">${v.unidades} unidad(es)</td></tr>
                  <tr><td style="padding:6px 10px;font-size:9px;color:${HEX.gris};font-weight:bold;border-top:1px solid ${HEX.borde};">Total neto</td><td style="padding:6px 10px;font-size:9px;text-align:right;font-weight:bold;color:${HEX.navy};border-top:1px solid ${HEX.borde};">${escapeHtml(ufLabel(precio?.precioVentaCLP || 0, tasaUf))}</td></tr>
                </table>
              </td>
            </tr>
          </table>
          ${observacionRowHtml ? `<table style="width:100%;border-collapse:collapse;">${observacionRowHtml}</table>` : ''}
        </div>`;
      };

      // Encabezado completo (primera página): logo, "Oferta Cliente" como
      // título, línea divisoria, "Presupuesto - X / Fecha", "Cliente:",
      // "Obra:", saludo y párrafo de presentación -- igual al documento de
      // referencia.
      const headerCompletoHtml = `
        <div style="height:4px;background:${HEX.rojo};"></div>
        <div style="padding:20px 42px 0 42px;">
          ${logosHeaderHtml}
          <div style="font-size:19px;font-weight:bold;color:${HEX.navy};margin-bottom:10px;">Oferta Cliente</div>
          <div style="border-top:1px solid ${HEX.borde};margin-bottom:16px;"></div>
          <table style="width:100%;margin-bottom:10px;"><tr>
            <td style="font-size:10px;font-weight:bold;color:${HEX.navy};">${escapeHtml(codigoLabel)}</td>
            <td style="font-size:10px;color:${HEX.gris};text-align:right;">Fecha: ${escapeHtml(fechaLabel)}</td>
          </tr></table>
          <div style="font-size:10px;font-weight:bold;color:${HEX.navy};margin-bottom:4px;">Cliente: ${escapeHtml(clienteNombre)}</div>
          <div style="font-size:10px;font-weight:bold;color:${HEX.navy};margin-bottom:16px;">Obra: ${escapeHtml(proyecto.obra)}</div>
          ${texto.trim() ? `
            <div style="font-size:9.5px;color:${HEX.navy};margin-bottom:4px;">Estimado Cliente,</div>
            <div style="font-size:9.5px;color:${HEX.navy};line-height:1.5;margin-bottom:16px;">${escapeHtml(texto.trim())}</div>
          ` : ''}
        </div>`;

      // Encabezado compacto (páginas siguientes): "{Obra} · Presupuesto - X"
      // a la izquierda, fecha a la derecha, misma línea -- igual al
      // documento de referencia.
      const headerCompactoHtml = `
        <div style="height:4px;background:${HEX.rojo};"></div>
        <div style="padding:20px 42px 0 42px;">
          <table style="width:100%;"><tr>
            <td style="font-size:9px;font-weight:bold;color:${HEX.navy};">${escapeHtml(proyecto.obra)} · ${escapeHtml(codigoLabel)}</td>
            <td style="font-size:9px;color:${HEX.gris};text-align:right;">Fecha: ${escapeHtml(fechaLabel)}</td>
          </tr></table>
          <div style="border-top:1px solid ${HEX.borde};margin:10px 0 16px 0;"></div>
        </div>`;

      const resumenHtml = `
        <div style="background:${HEX.navy};border-radius:6px;padding:8px 18px;color:#ffffff;display:flex;justify-content:space-between;margin-top:0;">
          <div><div style="font-size:8px;color:#94a3b8;">Subtotal de venta · NETO</div><div style="font-size:13px;font-weight:bold;">${escapeHtml(ufLabel(venta, tasaUf))}</div></div>
          <div><div style="font-size:8px;color:#94a3b8;">IVA (${ivaPct}%)</div><div style="font-size:13px;font-weight:bold;">${escapeHtml(ufLabel(iva, tasaUf))}</div></div>
          <div><div style="font-size:8px;color:#94a3b8;">Total con IVA</div><div style="font-size:16px;font-weight:bold;">${escapeHtml(ufLabel(totalConIva, tasaUf))}</div></div>
        </div>`;

      // Paginado: ni una cuenta fija ("2 y luego 3") ni una altura estimada
      // a mano -- las dos formas que ya se probaron y las dos fallaron,
      // porque la altura real de una tarjeta depende de cuántas filas de
      // metadatos tiene y de la proporción del dibujo (una ventana angosta
      // y alta no mide lo mismo que una ancha y baja), y varía de proyecto
      // en proyecto. En vez de adivinar, se mide la altura real que el
      // propio navegador le da a cada tarjeta -- montándolas un instante en
      // un contenedor oculto del mismo ancho que va a tener la página
      // impresa -- y se empaqueta con esa medida exacta. page-break-inside:
      // avoid en cada tarjeta sigue de red de seguridad por si el navegador
      // que genera el PDF (Chromium en el relay) mide un pixel distinto al
      // de este navegador: en vez de partir una tarjeta a la mitad, empuja
      // toda la tarjeta a la página siguiente.
      const ANCHO_CONTENIDO_PT = 732; // carta (816px a 96dpi) menos 42px de margen a cada lado
      const medidor = document.createElement('div');
      medidor.style.position = 'absolute';
      medidor.style.left = '-99999px';
      medidor.style.top = '0';
      medidor.style.width = `${ANCHO_CONTENIDO_PT}px`;
      medidor.style.fontFamily = 'Helvetica, Arial, sans-serif';
      document.body.appendChild(medidor);

      // getBoundingClientRect() justo después de innerHTML mide el layout
      // ANTES de que la imagen (el dibujo, un PNG en base64) termine de
      // cargar -- la carga de <img> es asíncrona incluso para un data URI.
      // Sin esperarla, todas las tarjetas miden lo mismo (la altura la pone
      // solo la columna de "Valores comerciales", no el dibujo) y la
      // medición completa pierde el sentido.
      const medirAltura = async (html: string): Promise<number> => {
        medidor.innerHTML = html;
        const imgs = Array.from(medidor.querySelectorAll('img'));
        await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        })));
        return medidor.getBoundingClientRect().height;
      };

      const alturaCard = new Map<string, number>();
      for (const v of ventanas) {
        alturaCard.set(v.id, await medirAltura(cardHtml(v)));
      }
      const alturaHeaderCompleto = await medirAltura(headerCompletoHtml);
      const alturaHeaderCompacto = await medirAltura(headerCompactoHtml);
      const alturaResumen = await medirAltura(resumenHtml);
      document.body.removeChild(medidor);

      const ALTURA_PAGINA_PT = 792; // carta
      const ALTURA_PIE_PT = 12; // padding inferior de cada página de ventanas

      const paginasVentanas: Ventana[][] = [];
      let paginaActual: Ventana[] = [];
      let alturaUsada = alturaHeaderCompleto;
      ventanas.forEach((v, idx) => {
        const altura = alturaCard.get(v.id) || 0;
        const esUltimaVentana = idx === ventanas.length - 1;
        const disponible = ALTURA_PAGINA_PT - ALTURA_PIE_PT - (esUltimaVentana ? alturaResumen : 0);
        if (paginaActual.length > 0 && alturaUsada + altura > disponible) {
          paginasVentanas.push(paginaActual);
          paginaActual = [];
          alturaUsada = alturaHeaderCompacto;
        }
        paginaActual.push(v);
        alturaUsada += altura;
      });
      if (paginaActual.length > 0) paginasVentanas.push(paginaActual);
      if (paginasVentanas.length === 0) paginasVentanas.push([]);

      const paginasHtml = paginasVentanas.map((chunk, i) => {
        const esUltima = i === paginasVentanas.length - 1;
        return `
        <div style="width:100%;font-family:Helvetica,Arial,sans-serif;background:#ffffff;">
          ${i === 0 ? headerCompletoHtml : headerCompactoHtml}
          <div style="padding:0 42px 6px 42px;">
            ${chunk.map(cardHtml).join('')}
            ${esUltima ? resumenHtml : ''}
          </div>
        </div>`;
      });

      if (condiciones.trim()) {
        paginasHtml.push(`
        <div style="width:100%;font-family:Helvetica,Arial,sans-serif;background:#ffffff;">
          <div style="height:4px;background:${HEX.rojo};"></div>
          <div style="padding:20px 42px 0 42px;">
            ${logoImg}
            <div style="font-size:19px;font-weight:bold;color:${HEX.navy};margin-bottom:10px;">Condiciones Comerciales</div>
            <div style="border-top:1px solid ${HEX.borde};margin-bottom:16px;"></div>
            <ul style="font-size:9px;color:${HEX.navy};line-height:1.7;padding-left:16px;margin:0;">
              ${condiciones.trim().split('\n').filter(Boolean).map((l) => `<li style="margin-bottom:4px;">${escapeHtml(l.trim())}</li>`).join('')}
            </ul>
          </div>
        </div>`);
      }

      // Antes: cada página se rasterizaba en el navegador del cliente
      // (html2canvas) mutando un mismo <div> en un loop -- la promesa de
      // doc.html() no siempre resolvía a tiempo (sobre todo en Safari/iOS)
      // antes de que la siguiente vuelta reescribiera ese nodo, y el
      // resultado terminaba con contenido de una página mezclado en otra
      // ("Condiciones Comerciales" saliendo como página 1, con una tarjeta
      // de ventana asomando debajo). Ahora el navegador del cliente solo
      // arma el HTML/CSS (texto, nada que rasterizar); el PDF lo genera el
      // relay con Chromium real via page.pdf() -- paginación por CSS
      // estándar (page-break-after), igual que "Imprimir a PDF" desde
      // cualquier navegador de escritorio. No hay DOM compartido entre
      // páginas ni carrera posible: cada <div class="pagina"> es texto
      // estático dentro de un único documento HTML.
      // width:595px (el ancho en puntos de una hoja A4) es un error de
      // unidades, no un tamaño real: Chromium arma el layout de impresion
      // en pixeles CSS del tamaño de pagina elegido (carta = 816px a
      // 96dpi), asi que un contenedor de 595 CSS-px ocupaba solo ~73% del
      // ancho fisico de la hoja, dejando una franja en blanco a la derecha
      // -- confirmado midiendo el PDF resultante, no a ojo. width:100% lo
      // corrige: la pagina ocupa el ancho real de la hoja carta.
      const documentoHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; }
  .pagina { width: 100%; font-family: Helvetica, Arial, sans-serif; background: #ffffff; page-break-after: always; }
  .pagina:last-child { page-break-after: auto; }
</style>
</head>
<body>
  ${paginasHtml.map((html) => `<div class="pagina">${html}</div>`).join('')}
</body>
</html>`;

      const filename = `presupuesto-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`;
      const blob = await renderPdf(documentoHtml, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      // Antes fallaba en silencio: el usuario se llevaba un PDF en blanco
      // sin ninguna pista de qué pasó. Mejor un error visible que adivinar.
      window.alert(`No se pudo generar el PDF: ${error?.message || error}`);
    } finally {
      setExportando(false);
    }
  };

  if (!activeVersion) return null;

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Oferta Cliente</p>
          <h3 className="text-base font-bold text-slate-900">
            Presupuesto - {proyecto.codigoInterno || proyecto.numeroPresupuesto}
          </h3>
          <p className="text-xs text-slate-500">{proyecto.obra} · {proyecto.cliente?.nombre || proyecto.clienteNombreRaw}</p>
        </div>
        <button
          type="button"
          onClick={exportarPDF}
          disabled={exportando}
          className="px-4 py-2.5 rounded-xl bg-[#E34A26] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#c93f1e] transition-colors disabled:opacity-50"
        >
          {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Exportar PDF
        </button>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Texto de presentación</h4>
          {!congelado && !editandoTexto && (
            <button type="button" onClick={() => setEditandoTexto(true)} className="text-[11px] text-slate-400 hover:text-[#E34A26] flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Editar
            </button>
          )}
        </div>
        {editandoTexto ? (
          <div className="space-y-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-[#E34A26]"
            />
            <button
              type="button"
              onClick={() => guardarTextoMutation.mutate()}
              disabled={guardarTextoMutation.isPending}
              className="px-3 py-1.5 rounded-lg bg-[#E34A26] text-white text-xs font-bold flex items-center gap-1.5"
            >
              {guardarTextoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-600 whitespace-pre-line">{texto}</p>
        )}
      </div>

      <div className="space-y-3">
        {ventanas.map((v) => {
          const precio = preciosVenta.get(v.id);
          const line = toWindowLine(v);
          const isFrameless = Boolean(line?.dibujoSinMarco);
          const apertura = line ? core.apertureLabel(line) : '—';
          const finish = createFinish(line?.acabadoCodigo, line?.acabadoDescripcion, line?.acabadoPatron);
          const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
          const vidrio = Array.from(
            new Set((v.materiales || []).filter((m) => !m.excluido && m.material?.familia === 'VIDRIOS').map((m) => m.material?.descripcion || ''))
          ).filter(Boolean).join(' + ');

          return (
            <article key={v.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <header className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                <NombreEditable
                  ventana={v}
                  congelado={congelado}
                  onGuardado={(patch) => setVentanasLocal((prev) => ({ ...prev, [v.id]: { ...prev[v.id], ...patch } }))}
                />
                <span className="px-2 py-0.5 rounded-full bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 font-bold text-xs font-mono shrink-0">
                  {v.unidades} {v.unidades === 1 ? 'ud' : 'uds'}
                </span>
              </header>
              <div className="p-4 grid grid-cols-1 md:grid-cols-[180px_1fr_180px] gap-4">
                <div className="bg-[#f8fafc] rounded-xl flex items-center justify-center min-h-[140px]">
                  <WindowRendererSvg ventana={v} />
                </div>
                <div className="space-y-1.5 text-xs">
                  <div><span className="text-slate-400">Dimensiones: </span><span className="font-bold text-slate-900">{formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)} mm</span></div>
                  <div><span className="text-slate-400">Apertura: </span><span className="font-bold text-slate-900">{apertura}</span></div>
                  {!isFrameless && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Acabado: </span>
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: finish.frame }} />
                      <span className="font-bold text-slate-900">{finishLabel}</span>
                    </div>
                  )}
                  {vidrio && <div><span className="text-slate-400">Vidrios: </span><span className="font-bold text-slate-900">{vidrio}</span></div>}
                  <div className="pt-1">
                    <ObservacionEditable
                      ventana={v}
                      congelado={congelado}
                      onGuardado={(patch) => setVentanasLocal((prev) => ({ ...prev, [v.id]: { ...prev[v.id], ...patch } }))}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 text-xs h-fit">
                  <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 pb-1 border-b border-slate-100">Valores comerciales</h5>
                  <div className="flex justify-between"><span className="text-slate-500">Precio unitario</span><span className="font-mono font-bold text-slate-900">{ufLabel(precio?.precioUnitarioCLP || 0, tasaUf)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cantidad</span><span className="font-mono font-bold text-slate-900">{v.unidades} ud(es)</span></div>
                  <div className="flex justify-between pt-1 border-t border-slate-100"><span className="text-slate-500">Total neto</span><span className="font-mono font-bold text-[#E34A26]">{ufLabel(precio?.precioVentaCLP || 0, tasaUf)}</span></div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><span className="block text-[11px] text-slate-400">Subtotal de venta · NETO</span><strong className="text-lg font-mono">{ufLabel(venta, tasaUf)}</strong></div>
        <div><span className="block text-[11px] text-slate-400">IVA ({ivaPct}%)</span><strong className="text-lg font-mono">{ufLabel(iva, tasaUf)}</strong></div>
        <div><span className="block text-[11px] text-slate-400">Total con IVA</span><strong className="text-xl font-mono">{ufLabel(totalConIva, tasaUf)}</strong></div>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Condiciones comerciales</h4>
          {!congelado && !editandoCondiciones && (
            <button type="button" onClick={() => setEditandoCondiciones(true)} className="text-[11px] text-slate-400 hover:text-[#E34A26] flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Editar
            </button>
          )}
        </div>
        {editandoCondiciones ? (
          <div className="space-y-2">
            <textarea
              value={condiciones}
              onChange={(e) => setCondiciones(e.target.value)}
              rows={8}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-[#E34A26] font-mono"
            />
            <p className="text-[10px] text-slate-400">Una condición por línea.</p>
            <button
              type="button"
              onClick={() => guardarCondicionesMutation.mutate()}
              disabled={guardarCondicionesMutation.isPending}
              className="px-3 py-1.5 rounded-lg bg-[#E34A26] text-white text-xs font-bold flex items-center gap-1.5"
            >
              {guardarCondicionesMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar
            </button>
          </div>
        ) : (
          <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
            {condiciones.trim().split('\n').filter(Boolean).map((linea, i) => <li key={i}>{linea.trim()}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
};
