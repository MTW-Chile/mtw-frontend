import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Check, Loader2, Plus, Trash2, FileDown, Lock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '../../../../lib/utils';
import { useMonedas } from '../../../../lib/monedas';
import { updateFijacionConfig, updateEstadoAprobacion } from '../../../../api/client';
import type { Proyecto, ProyectoVersion, FijacionExtra } from '../../../../types';
import {
  computeMaterialesConsolidados,
  montoConAjuste,
  computeCantidadVidrios,
  computeCantidadCuadros,
} from '../../lib/materialesConsolidados';

interface Step4FijacionesProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  dolar: string;
  uf: string;
  euro: string;
}

// Mismo agrupado que la Analitica de Materiales (Step3Materiales): Juntas
// se funde dentro de Accesorios (normalizarFamilia en
// materialesConsolidados.ts), asi que "PVC y juntas" es solo un nombre --
// no lleva materiales de Juntas, esos van en Accesorios como en todo el
// resto de la app. Se agrupa por la familia YA NORMALIZADA (m.familia), la
// misma que usa aprobacionesPorFamilia para el descuento/recargo.
const CATEGORIAS_FIJACION: { etiqueta: string; familia: string }[] = [
  { etiqueta: 'PVC', familia: 'PERFILERIA' },
  { etiqueta: 'Refuerzos', familia: 'REFUERZOS' },
  { etiqueta: 'Herrajes', familia: 'HERRAJES' },
  { etiqueta: 'Accesorios', familia: 'ACCESORIOS' },
  { etiqueta: 'Vidrios y Superficies', familia: 'VIDRIOS' },
];

const clpLabel = (valor: number) => `$ ${formatNumber(valor, 0)}`;
const ufLabel = (valor: number, tasaUf: number) =>
  tasaUf > 0 ? `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(valor / tasaUf)} UF` : '—';
const pctLabel = (monto: number, venta: number) =>
  venta > 0 ? `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format((monto * 100) / venta)}% venta` : '—';

const numeroInput = (value: unknown) => Math.max(0, Number(value) || 0);

export const Step4Fijaciones: React.FC<Step4FijacionesProps> = ({ proyecto, activeVersion, dolar, uf, euro }) => {
  const queryClient = useQueryClient();
  const monedas = useMonedas();
  const tasaDolar = Number(dolar) || 950;
  const tasaUf = Number(uf) || 38500;
  const tasaEuro = Number(euro) || 1030;

  const versionId = activeVersion?.id;
  const congelado = Boolean(activeVersion?.esCongelado);
  const config = activeVersion?.fijacionConfig;

  // activeVersion.totalVentanas es la cantidad de LINEAS (lineas.length en
  // el sync), no de ventanas fisicas -- una linea con unidades=3 cuenta 1
  // ahi. La Hoja de Fijacion necesita el conteo real, sumando unidades.
  const cantidadVentanas = (activeVersion?.ventanas || []).reduce((acc, v) => acc + (v.unidades || 1), 0);

  // Defaults SOLO para cuando todavia no hay config guardada -- calzan con
  // la hoja de fijacion anterior (tasas de servicio) y con la cantidad de
  // viajes por defecto (ceil(ventanas / 14), lo que entra en un flete).
  const defaultDraft = () => ({
    manoObraFabricacion: config?.manoObraFabricacion ?? 8000,
    filmProtectorCristales: config?.filmProtectorCristales ?? 1000,
    materialInstalacion: config?.materialInstalacion ?? 3100,
    cantidadViajes: config?.cantidadViajes ?? Math.ceil(cantidadVentanas / 14),
    valorViaje: config?.valorViaje ?? 80000,
    valorInstalacionM2: config?.valorInstalacionM2 ?? 1700,
    margenVentaPct: config?.margenVentaPct ?? 0,
  });

  // Draft local de los campos editables -- se resetea cuando cambia de
  // version (o llega la config recien guardada) para no pisar un guardado
  // ajeno con un draft viejo de otra pestaña.
  const [draft, setDraft] = useState(defaultDraft);
  const [extras, setExtras] = useState<FijacionExtra[]>(config?.extras ?? []);
  const [mostrarAnalisis, setMostrarAnalisis] = useState(false);

  useEffect(() => {
    setDraft(defaultDraft());
    setExtras(config?.extras ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, config?.id]);

  const guardarMutation = useMutation({
    mutationFn: () => {
      if (!versionId) return Promise.resolve(null);
      return updateFijacionConfig(versionId, { ...draft, extras });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });

  const familiasAprobadas = (activeVersion?.familiaAprobaciones || []).filter((f) => f.aprobada).length;
  const familiasTotales = new Set((activeVersion?.familiaAprobaciones || []).map((f) => f.familia)).size;
  const todasLasFamiliasAprobadas = familiasTotales > 0 && familiasAprobadas === familiasTotales;
  const puedeCongelar = !congelado && todasLasFamiliasAprobadas;

  // Congelar el presupuesto: guarda la Hoja de Fijacion (si hay cambios sin
  // guardar) y recien ahi pide el cambio de estado -- el backend rechaza el
  // congelamiento si la config nunca se guardo (ver /estado-aprobacion).
  const congelarMutation = useMutation({
    mutationFn: async () => {
      if (!versionId) return null;
      await updateFijacionConfig(versionId, { ...draft, extras });
      return updateEstadoAprobacion(versionId, 'ESPERANDO_APROBACION_COMERCIAL');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });

  // Materiales consolidados de la Analitica -- misma fuente de verdad que
  // Step3Materiales, con descuento/recargo por familia ya aplicado.
  const materialesConsolidados = useMemo(
    () => computeMaterialesConsolidados(activeVersion, tasaDolar, tasaEuro, tasaUf, monedas),
    [activeVersion, tasaDolar, tasaEuro, tasaUf, monedas]
  );
  const aprobacionesPorFamilia = useMemo(
    () => new Map((activeVersion?.familiaAprobaciones || []).map((f) => [f.familia, f])),
    [activeVersion?.familiaAprobaciones]
  );

  const totalesPorCategoria = useMemo(
    () =>
      CATEGORIAS_FIJACION.map(({ etiqueta, familia }) => {
        const monto = materialesConsolidados
          .filter((m) => !m.excluido && m.familia === familia)
          .reduce((acc, m) => acc + montoConAjuste(m, aprobacionesPorFamilia), 0);
        return { etiqueta, monto };
      }),
    [materialesConsolidados, aprobacionesPorFamilia]
  );
  const materialesTotal = totalesPorCategoria.reduce((acc, c) => acc + c.monto, 0);

  const m2Ventanas = activeVersion?.totalM2Ventanas || 0;
  const cantidadCuadros = useMemo(() => computeCantidadCuadros(activeVersion), [activeVersion]);
  const cantidadVidrios = useMemo(() => computeCantidadVidrios(activeVersion), [activeVersion]);
  const m2Vidrios = materialesConsolidados
    .filter((m) => !m.excluido && m.familia === 'VIDRIOS')
    .reduce((acc, m) => acc + m.cantidadTotal, 0);

  // Costos complementarios: tasas CLP/m2 (no montos planos) -- mano de obra
  // y material de instalacion por m2 de VENTANAS, film protector por m2 de
  // VIDRIOS. Confirmado contra la hoja de fijacion anterior (defaults
  // 8000/1000/3100 respectivamente).
  const costoManoObra = numeroInput(draft.manoObraFabricacion) * m2Ventanas;
  const costoFilm = numeroInput(draft.filmProtectorCristales) * m2Vidrios;
  const costoMaterialInstalacion = numeroInput(draft.materialInstalacion) * m2Ventanas;
  const extrasTotal = extras.reduce((acc, e) => acc + numeroInput(e.monto), 0);
  const costosComplementarios = costoManoObra + costoFilm + costoMaterialInstalacion + extrasTotal;
  const costoFlete = numeroInput(draft.cantidadViajes) * numeroInput(draft.valorViaje);
  const costoInstalacion = numeroInput(draft.valorInstalacionM2) * m2Ventanas;
  const costoTotal = materialesTotal + costosComplementarios + costoFlete + costoInstalacion;
  const valorM2 = m2Ventanas > 0 ? costoTotal / m2Ventanas : 0;
  const margen = Math.min(99, Math.max(0, numeroInput(draft.margenVentaPct)));
  const venta = margen < 100 ? costoTotal / (1 - margen / 100) : costoTotal;

  const actualizarExtra = (index: number, patch: Partial<FijacionExtra>) => {
    setExtras((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };
  const agregarExtra = () => setExtras((prev) => [...prev, { glosa: '', monto: 0 }]);
  const eliminarExtra = (index: number) => setExtras((prev) => prev.filter((_, i) => i !== index));

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margen2 = 36;
    let y = margen2;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Hoja de Fijación', margen2, y);
    y += 20;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const encabezado = [
      proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`,
      activeVersion ? `Revisión ${activeVersion.versionNumero}` : '',
      `Exportado ${new Date().toLocaleDateString('es-CL')}`,
    ].filter(Boolean).join('  ·  ');
    doc.text(encabezado, margen2, y);
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.text(proyecto.obra, margen2, y);
    y += 18;

    autoTable(doc, {
      startY: y,
      margin: { left: margen2, right: margen2 },
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [['Materiales y métricas', '']],
      body: [
        ...totalesPorCategoria.map((c) => [`${c.etiqueta} (${pctLabel(c.monto, venta)})`, clpLabel(c.monto)]),
        ['Cantidad de ventanas', String(cantidadVentanas)],
        ['m² de ventanas', `${formatNumber(m2Ventanas, 2)} m²`],
        ['Cantidad de cuadros', String(cantidadCuadros)],
        ['Cantidad de vidrios', String(cantidadVidrios)],
        ['m² de vidrios', `${formatNumber(m2Vidrios, 2)} m²`],
      ],
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    let y2 = (doc as any).lastAutoTable.finalY + 16;
    autoTable(doc, {
      startY: y2,
      margin: { left: margen2, right: margen2 },
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [['Costos complementarios', '']],
      body: [
        [`Mano de obra fabricación · $${formatNumber(draft.manoObraFabricacion, 0)}/m² vent. (${pctLabel(costoManoObra, venta)})`, clpLabel(costoManoObra)],
        [`Film protector cristales · $${formatNumber(draft.filmProtectorCristales, 0)}/m² vidrio (${pctLabel(costoFilm, venta)})`, clpLabel(costoFilm)],
        [`Material de instalación · $${formatNumber(draft.materialInstalacion, 0)}/m² vent. (${pctLabel(costoMaterialInstalacion, venta)})`, clpLabel(costoMaterialInstalacion)],
        ...extras.map((e) => [e.glosa, clpLabel(e.monto)]),
        ['Costo', clpLabel(costosComplementarios)],
      ],
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    y2 = (doc as any).lastAutoTable.finalY + 16;
    autoTable(doc, {
      startY: y2,
      margin: { left: margen2, right: margen2 },
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [30, 41, 59] },
      body: [
        ['Cantidad de viajes', String(draft.cantidadViajes)],
        ['Valor viaje', clpLabel(draft.valorViaje)],
        ['Costo flete', clpLabel(costoFlete)],
        ['Valor instalación por m²', clpLabel(draft.valorInstalacionM2)],
        ['Costo instalación', clpLabel(costoInstalacion)],
      ],
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    y2 = (doc as any).lastAutoTable.finalY + 16;
    autoTable(doc, {
      startY: y2,
      margin: { left: margen2, right: margen2 },
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [['Resumen de costos', '']],
      body: [
        [`Materiales (${pctLabel(materialesTotal, venta)})`, clpLabel(materialesTotal)],
        [`Costos complementarios (${pctLabel(costosComplementarios, venta)})`, clpLabel(costosComplementarios)],
        [`Flete (${pctLabel(costoFlete, venta)})`, clpLabel(costoFlete)],
        [`Instalación (${pctLabel(costoInstalacion, venta)})`, clpLabel(costoInstalacion)],
        ['Costo total NETO', clpLabel(costoTotal)],
      ],
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.row.index === 4) data.cell.styles.fontStyle = 'bold';
      },
    });

    y2 = (doc as any).lastAutoTable.finalY + 16;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Valor por m²: ${ufLabel(valorM2, tasaUf)} | ${clpLabel(valorM2)}`, margen2, y2);
    y2 += 20;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Costo total del proyecto · NETO (sin margen)', margen2, y2);
    doc.text(`${ufLabel(costoTotal, tasaUf)} | ${clpLabel(costoTotal)}`, margen2, y2 + 14);
    y2 += 34;
    doc.text(`Margen de venta: ${formatNumber(margen, 1)}%`, margen2, y2);
    y2 += 18;
    doc.text('Valor de venta · NETO', margen2, y2);
    doc.text(`${ufLabel(venta, tasaUf)} | ${clpLabel(venta)}`, margen2, y2 + 14);
    y2 += 30;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Valor UF utilizado en el cálculo: $ ${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tasaUf)} por UF`, margen2, y2);

    doc.save(`hoja-fijacion-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`);
  };

  if (!activeVersion) {
    return (
      <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
        <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
          <Calculator className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Paso 4: Hoja de Fijación</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">Seleccioná una versión para calcular la hoja de fijación.</p>
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:border-[#E34A26] focus:bg-white disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hoja de Fijación</h3>
            <p className="text-[11px] text-slate-500">{proyecto.obra}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {congelado && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Presupuesto congelado -- solo lectura
            </span>
          )}
          <button
            onClick={() => setMostrarAnalisis((v) => !v)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            {mostrarAnalisis ? 'Ocultar % venta' : 'Analizar precio'}
          </button>
          <button
            onClick={exportarPDF}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" /> Exportar PDF
          </button>
          {!congelado && (
            <button
              onClick={() => guardarMutation.mutate()}
              disabled={guardarMutation.isPending}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {guardarMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Guardar
            </button>
          )}
          {!congelado && (
            <button
              onClick={() => congelarMutation.mutate()}
              disabled={!puedeCongelar || congelarMutation.isPending}
              title={
                todasLasFamiliasAprobadas
                  ? 'Guarda la Hoja de Fijación y congela el presupuesto'
                  : 'Faltan familias por aprobar en la Analítica de Materiales (Paso 3)'
              }
              className="px-3.5 py-2 rounded-xl bg-[#E34A26] hover:bg-[#c93f1f] text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {congelarMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Congelar Presupuesto
            </button>
          )}
        </div>
      </div>

      {congelarMutation.isError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {(congelarMutation.error as any)?.response?.data?.error || 'No se pudo congelar el presupuesto.'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Materiales y métricas (de la Analítica, solo lectura) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Materiales y métricas</h4>
          {totalesPorCategoria.map((c) => (
            <div key={c.etiqueta} className="flex items-center justify-between py-1.5 border-b border-slate-50 text-xs">
              <span className="text-slate-600">
                {c.etiqueta}
                {mostrarAnalisis && <span className="text-slate-400 ml-1.5">({pctLabel(c.monto, venta)})</span>}
              </span>
              <span className="font-mono font-bold text-slate-900">{clpLabel(c.monto)}</span>
            </div>
          ))}
          {[
            ['Cantidad de ventanas', String(cantidadVentanas)],
            ['m² de ventanas', `${formatNumber(m2Ventanas, 2)} m²`],
            ['Cantidad de cuadros', String(cantidadCuadros)],
            ['Cantidad de vidrios', String(cantidadVidrios)],
            ['m² de vidrios', `${formatNumber(m2Vidrios, 2)} m²`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 text-xs">
              <span className="text-slate-600">{label}</span>
              <span className="font-mono font-bold text-slate-900">{value}</span>
            </div>
          ))}
        </div>

        {/* Costos complementarios + Flete + Instalación (editable) */}
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Costos complementarios</h4>
              {!congelado && (
                <button onClick={agregarExtra} className="text-[11px] font-semibold text-[#E34A26] hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar Extra
                </button>
              )}
            </div>
            {[
              ['manoObraFabricacion', 'Mano de obra fabricación', 'CLP por m² de ventana', costoManoObra],
              ['filmProtectorCristales', 'Film protector cristales', 'CLP por m² de vidrio', costoFilm],
              ['materialInstalacion', 'Material de instalación', 'CLP por m² de ventana', costoMaterialInstalacion],
            ].map(([key, label, hint, costo]) => (
              <div key={key as string} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600 flex-1">
                  <span className="block">{label}</span>
                  <span className="block text-[10px] text-slate-400">
                    {hint}
                    {mostrarAnalisis && <span className="ml-1.5">· {clpLabel(costo as number)} ({pctLabel(costo as number, venta)})</span>}
                  </span>
                </span>
                <input
                  type="number"
                  min={0}
                  disabled={congelado}
                  value={(draft as any)[key as string] || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [key as string]: numeroInput(e.target.value) }))}
                  className={`${inputClass} max-w-[140px]`}
                />
              </div>
            ))}
            {extras.map((extra, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                <input
                  type="text"
                  disabled={congelado}
                  placeholder="Glosa del extra"
                  value={extra.glosa}
                  onChange={(e) => actualizarExtra(idx, { glosa: e.target.value })}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#E34A26] focus:bg-white disabled:bg-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  disabled={congelado}
                  value={extra.monto || ''}
                  onChange={(e) => actualizarExtra(idx, { monto: numeroInput(e.target.value) })}
                  className={`${inputClass} max-w-[120px]`}
                />
                {!congelado && (
                  <button onClick={() => eliminarExtra(idx)} className="text-slate-400 hover:text-rose-600 transition-colors" aria-label={`Eliminar ${extra.glosa}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold">
              <span>Costo</span>
              <span className="font-mono">{clpLabel(costosComplementarios)}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Flete</h4>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 flex-1">Cantidad de viajes</span>
              <input
                type="number"
                min={0}
                disabled={congelado}
                value={draft.cantidadViajes || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, cantidadViajes: Math.trunc(numeroInput(e.target.value)) }))}
                className={`${inputClass} max-w-[100px]`}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 flex-1">Valor viaje</span>
              <input
                type="number"
                min={0}
                disabled={congelado}
                value={draft.valorViaje || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, valorViaje: numeroInput(e.target.value) }))}
                className={`${inputClass} max-w-[140px]`}
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold">
              <span>Costo flete{mostrarAnalisis && <span className="text-slate-400 font-normal ml-1.5">({pctLabel(costoFlete, venta)})</span>}</span>
              <span className="font-mono">{clpLabel(costoFlete)}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Instalación</h4>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 flex-1">
                <span className="block">Valor por m²</span>
                <span className="block text-[10px] text-slate-400">CLP por m² de ventana</span>
              </span>
              <input
                type="number"
                min={0}
                disabled={congelado}
                value={draft.valorInstalacionM2 || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, valorInstalacionM2: numeroInput(e.target.value) }))}
                className={`${inputClass} max-w-[140px]`}
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold">
              <span>Costo instalación{mostrarAnalisis && <span className="text-slate-400 font-normal ml-1.5">({pctLabel(costoInstalacion, venta)})</span>}</span>
              <span className="font-mono">{clpLabel(costoInstalacion)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen de costos */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Resumen de costos</h4>
        {[
          ['Materiales', materialesTotal],
          ['Costos complementarios', costosComplementarios],
          ['Flete', costoFlete],
          ['Instalación', costoInstalacion],
        ].map(([label, monto]) => (
          <div key={label as string} className="flex items-center justify-between py-1.5 border-b border-slate-50 text-xs">
            <span className="text-slate-600">
              {label}
              {mostrarAnalisis && <span className="text-slate-400 ml-1.5">({pctLabel(monto as number, venta)})</span>}
            </span>
            <span className="font-mono font-bold text-slate-900">{clpLabel(monto as number)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 text-sm font-bold text-slate-900">
          <span>Costo total NETO</span>
          <span className="font-mono">{clpLabel(costoTotal)}</span>
        </div>
        <div className="text-[11px] text-slate-500 text-right">
          Valor por m²: {ufLabel(valorM2, tasaUf)} | {clpLabel(valorM2)}
        </div>
      </div>

      {/* Costo total / Margen / Venta */}
      <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Costo total del proyecto · NETO
          </div>
          <div className="text-lg font-bold font-mono">{ufLabel(costoTotal, tasaUf)}</div>
          <div className="text-xs font-mono text-slate-300">{clpLabel(costoTotal)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Margen de venta</div>
          <div className="flex items-center justify-center gap-1.5">
            <input
              type="number"
              min={0}
              max={99}
              disabled={congelado}
              value={draft.margenVentaPct || ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, margenVentaPct: numeroInput(e.target.value) }))}
              className="w-16 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-[#E34A26] disabled:opacity-60"
            />
            <span className="text-sm font-bold">%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Valor de venta · NETO</div>
          <div className="text-lg font-bold font-mono text-[#ff8a63]">{ufLabel(venta, tasaUf)}</div>
          <div className="text-xs font-mono text-slate-300">{clpLabel(venta)}</div>
        </div>
        <div className="md:col-span-3 text-[10px] text-slate-400 text-right">
          Valor UF utilizado en el cálculo: $ {new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tasaUf)} por UF
        </div>
      </div>
    </div>
  );
};
