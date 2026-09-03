import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDown, Loader2, Pencil, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { formatNumber } from '../../../../lib/utils';
import { useMonedas } from '../../../../lib/monedas';
import { updatePresupuestoConfig, updateVentanaPresupuesto } from '../../../../api/client';
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
import { MTW_NAVY, MTW_GRIS, MTW_BORDE, pdfTableStyle, drawPdfHeader } from '../../lib/pdfTheme';

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

const svgToPngDataUrl = (svg: string, width: number, height: number): Promise<string> =>
  new Promise((resolve, reject) => {
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

const NombreEditable: React.FC<{ ventana: Ventana; onGuardado: (v: Partial<Ventana>) => void; congelado: boolean }> = ({
  ventana,
  onGuardado,
  congelado,
}) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(ventana.descripcionCorta || ventana.modelo);
  const mutation = useMutation({
    mutationFn: () => updateVentanaPresupuesto(ventana.id, { descripcionCorta: valor.trim() || null }),
    onSuccess: (res) => {
      onGuardado({ descripcionCorta: res.ventana.descripcionCorta });
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
        <h4 className="text-sm font-black text-slate-900">{ventana.descripcionCorta || ventana.modelo}</h4>
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
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margen = 36;

      const encabezado = [
        proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`,
        `Fecha: ${new Date().toLocaleDateString('es-CL')}`,
      ].join(' | ');
      await drawPdfHeader(doc, 'Oferta Cliente', encabezado, pageWidth);

      let y = 78;
      doc.setDrawColor(...MTW_BORDE);
      doc.setLineWidth(0.75);
      doc.line(margen, y, pageWidth - margen, y);
      y += 20;

      doc.setTextColor(...MTW_NAVY);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(proyecto.obra, margen, y);
      y += 14;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MTW_GRIS);
      const clienteNombre = proyecto.cliente?.nombre || proyecto.clienteNombreRaw;
      if (clienteNombre) doc.text(clienteNombre, margen, y);
      y += 18;

      if (texto.trim()) {
        doc.setFontSize(9);
        doc.setTextColor(...MTW_NAVY);
        const lineas = doc.splitTextToSize(texto.trim(), pageWidth - margen * 2);
        doc.text(lineas, margen, y);
        y += lineas.length * 12 + 10;
      }

      for (const v of ventanas) {
        const cardHeight = 150;
        if (y + cardHeight > pageHeight - 40) {
          doc.addPage();
          y = margen;
        }

        doc.setDrawColor(...MTW_BORDE);
        doc.setLineWidth(0.75);
        doc.roundedRect(margen, y, pageWidth - margen * 2, cardHeight, 4, 4);

        doc.setFillColor(...pdfTableStyle.headStyles.fillColor);
        doc.rect(margen, y, pageWidth - margen * 2, 20, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MTW_NAVY);
        doc.text(v.descripcionCorta || v.modelo, margen + 8, y + 14);

        const line = toWindowLine(v);
        if (line) {
          try {
            const svg = buildWindow(line, 'offer').svg;
            const png = await svgToPngDataUrl(svg, 480, 356);
            doc.addImage(png, 'PNG', margen + 8, y + 26, 130, 96);
          } catch {
            // Dibujo opcional -- si falla, la tarjeta sigue sin imagen.
          }
        }

        const metaX = margen + 150;
        const metaWidth = pageWidth - margen - metaX - 150;
        const isFrameless = Boolean(line?.dibujoSinMarco);
        const apertura = line ? core.apertureLabel(line) : '';
        const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
        const vidrio = Array.from(
          new Set((v.materiales || []).filter((m) => !m.excluido && m.material?.familia === 'VIDRIOS').map((m) => m.material?.descripcion || ''))
        ).filter(Boolean).join(' + ');

        let metaY = y + 34;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        const campo = (label: string, value: string) => {
          if (!value) return;
          doc.setTextColor(...MTW_GRIS);
          doc.text(label, metaX, metaY);
          doc.setTextColor(...MTW_NAVY);
          doc.setFont('helvetica', 'bold');
          const lineas = doc.splitTextToSize(value, metaWidth - 70);
          doc.text(lineas, metaX + 70, metaY);
          doc.setFont('helvetica', 'normal');
          metaY += Math.max(12, lineas.length * 10);
        };
        campo('Dimensiones', `${formatNumber(v.anchoMm, 0)} × ${formatNumber(v.altoMm, 0)} mm`);
        campo('Apertura', apertura);
        if (!isFrameless) campo('Acabado', finishLabel);
        campo('Vidrios', vidrio);
        campo('Observación', v.comentarioPresupuesto || '');

        const precio = preciosVenta.get(v.id);
        const valoresX = pageWidth - margen - 140;
        doc.setDrawColor(...MTW_BORDE);
        doc.rect(valoresX, y + 26, 132, 96);
        doc.setFillColor(...pdfTableStyle.headStyles.fillColor);
        doc.rect(valoresX, y + 26, 132, 16, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MTW_NAVY);
        doc.text('Valores comerciales', valoresX + 6, y + 37);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const filaValor = (label: string, value: string, yy: number) => {
          doc.setTextColor(...MTW_GRIS);
          doc.text(label, valoresX + 6, yy);
          doc.setTextColor(...MTW_NAVY);
          doc.setFont('helvetica', 'bold');
          doc.text(value, valoresX + 126, yy, { align: 'right' });
          doc.setFont('helvetica', 'normal');
        };
        filaValor('Precio unitario', ufLabel(precio?.precioUnitarioCLP || 0, tasaUf), y + 52);
        filaValor('Cantidad', `${v.unidades} ud(es)`, y + 66);
        filaValor('Total neto', ufLabel(precio?.precioVentaCLP || 0, tasaUf), y + 80);

        y += cardHeight + 12;
      }

      if (y + 70 > pageHeight - 40) {
        doc.addPage();
        y = margen;
      }
      doc.setFillColor(...MTW_NAVY);
      doc.roundedRect(margen, y, pageWidth - margen * 2, 66, 6, 6, 'F');
      const bannerFila = (label: string, value: string, yy: number, size = 10) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(label, margen + 14, yy);
        doc.setFontSize(size);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(value, pageWidth - margen - 14, yy, { align: 'right' });
      };
      bannerFila('Subtotal de venta · NETO', ufLabel(venta, tasaUf), y + 22);
      bannerFila(`IVA (${ivaPct}%)`, ufLabel(iva, tasaUf), y + 40);
      bannerFila('Total con IVA', ufLabel(totalConIva, tasaUf), y + 58, 13);
      y += 66 + 24;

      if (condiciones.trim()) {
        doc.addPage();
        await drawPdfHeader(doc, 'Condiciones Comerciales', encabezado, pageWidth);
        let yc = 90;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MTW_NAVY);
        condiciones.trim().split('\n').filter(Boolean).forEach((linea) => {
          const lineas = doc.splitTextToSize(`· ${linea.trim()}`, pageWidth - margen * 2);
          if (yc + lineas.length * 12 > pageHeight - 40) {
            doc.addPage();
            yc = margen;
          }
          doc.text(lineas, margen, yc);
          yc += lineas.length * 12 + 6;
        });
      }

      doc.save(`presupuesto-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`);
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
