import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Check, Plus, Trash2, FileDown, Lock, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import { updateFijacionConfig, updateEstadoAprobacion } from '../../../../api/client';
import type { Proyecto, ProyectoVersion, FijacionExtra, FijacionBorrador } from '../../../../types';
import { Button } from '../../../../components/ui/Button';
import { useAnalitica, useAnaliticaSimulada } from '../../lib/useAnalitica';
import { computeCantidadCuadros } from '../../lib/cuadros';
import { MTW_NAVY, MTW_GRIS, MTW_BORDE, pdfTableStyle, drawPdfHeader } from '../../lib/pdfTheme';
import { usePermisos } from '../../../../lib/permisos';

interface Step4FijacionesProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  dolar: string;
  uf: string;
  euro: string;
  // Aprobación gerencial: vive acá (antes estaba en el Paso 5). Solo la
  // puede dar quien tiene el permiso 'gerencial' (o es admin).
  onCambiarEstadoAprobacion: (estado: 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA') => void;
  isCambiandoEstadoAprobacion: boolean;
}

type DraftFijacion = Omit<FijacionBorrador, 'extras'>;

const DRAFT_VACIO: DraftFijacion = {
  manoObraFabricacion: 0,
  filmProtectorCristales: 0,
  materialInstalacion: 0,
  cantidadViajes: 0,
  valorViaje: 0,
  valorInstalacionM2: 0,
  valorInstalacionProtexM2: 0,
  margenVentaPct: 0,
};

const separar = ({ extras, ...resto }: FijacionBorrador): { draft: DraftFijacion; extras: FijacionExtra[] } => ({
  draft: resto,
  extras: extras.map((e) => ({ glosa: e.glosa ?? '', monto: Number(e.monto) || 0 })),
});

const mismaFijacion = (a: FijacionBorrador, b: FijacionBorrador) =>
  (Object.keys(DRAFT_VACIO) as (keyof DraftFijacion)[]).every((k) => Number(a[k]) === Number(b[k])) &&
  a.extras.length === b.extras.length &&
  a.extras.every((e, i) => (e.glosa ?? '') === (b.extras[i].glosa ?? '') && Number(e.monto) === Number(b.extras[i].monto));

const clpLabel = (valor: number) => `$ ${formatNumber(valor, 0)}`;
const ufLabel = (valor: number, tasaUf: number) =>
  tasaUf > 0 ? `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(valor / tasaUf)} UF` : '—';
const pctLabel = (monto: number, venta: number) =>
  venta > 0 ? `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format((monto * 100) / venta)}% venta` : '—';

const numeroInput = (value: unknown) => Math.max(0, Number(value) || 0);

// BORRADOR es el valor historico de la columna antes del flujo de estado
// comercial; se trata igual que EN_COTIZACION (ver relay-api).
const normalizarEstado = (estado: string) => (estado === 'BORRADOR' ? 'EN_COTIZACION' : estado);

export const Step4Fijaciones: React.FC<Step4FijacionesProps> = ({
  proyecto,
  activeVersion,
  dolar,
  uf,
  euro,
  onCambiarEstadoAprobacion,
  isCambiandoEstadoAprobacion,
}) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const puedeAprobarGerencia = tiene('presupuestos.aprobar_gerencial');
  const tasaDolar = Number(dolar) || 950;
  const tasaUf = Number(uf) || 38500;
  const tasaEuro = Number(euro) || 1030;
  const tasas = useMemo(() => ({ dolar: tasaDolar, euro: tasaEuro, uf: tasaUf }), [tasaDolar, tasaEuro, tasaUf]);

  const versionId = activeVersion?.id;
  const estadoActual = activeVersion ? normalizarEstado(activeVersion.estadoAprobacion) : 'EN_COTIZACION';
  // Igual que en Step3Materiales: el read-only sigue el estado comercial,
  // no esCongelado -- ese flag ahora se activa al asignar cliente (Paso 1)
  // y solo bloquea el resync con HETMO.
  const congelado = estadoActual !== 'EN_COTIZACION';
  const config = activeVersion?.fijacionConfig;

  // Analitica de mtw-api con la Hoja guardada (o la por defecto si nunca se
  // guardo: la propone el backend, no esta pantalla).
  const analiticaQuery = useAnalitica(proyecto.id, versionId, tasas);
  const base = analiticaQuery.data;

  // Draft local de los campos editables -- arranca de la Hoja con que calculo
  // mtw-api y se resetea cuando cambia la version (o llega la config recien
  // guardada) para no pisar un guardado ajeno con un draft viejo de otra pestaña.
  const [draft, setDraft] = useState<DraftFijacion>(DRAFT_VACIO);
  const [extras, setExtras] = useState<FijacionExtra[]>([]);
  const [draftDe, setDraftDe] = useState<string | null>(null);
  const [mostrarAnalisis, setMostrarAnalisis] = useState(false);
  const claveDraft = `${versionId}|${config?.id ?? ''}`;

  useEffect(() => {
    if (!base || analiticaQuery.isPlaceholderData || draftDe === claveDraft) return;
    const inicial = separar(base.fijacion);
    setDraft(inicial.draft);
    setExtras(inicial.extras);
    setDraftDe(claveDraft);
  }, [base, analiticaQuery.isPlaceholderData, claveDraft, draftDe]);

  const borrador: FijacionBorrador = useMemo(() => ({ ...draft, extras }), [draft, extras]);

  // Hay cambios sin guardar si el draft (o los extras) difieren de la Hoja
  // con que calculo mtw-api. "Guardar" es el único botón que persiste la hoja.
  const hayCambios = !!base && draftDe === claveDraft && !mismaFijacion(borrador, base.fijacion);

  // Mientras se edita, costo y venta los calcula mtw-api con el borrador (sin guardarlo).
  const simulada = useAnaliticaSimulada(proyecto.id, versionId, tasas, hayCambios ? borrador : null);
  const vista = (hayCambios ? simulada.data : undefined) ?? base;

  const guardarMutation = useMutation({
    mutationFn: () => {
      if (!versionId) return Promise.resolve(null);
      return updateFijacionConfig(versionId, borrador);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });

  const partidas = base?.partidas ?? [];
  const todasLasPartidasAprobadas = partidas.length > 0 && partidas.every((p) => p.aprobada);
  const puedeCongelar = !congelado && todasLasPartidasAprobadas;

  // Congelar el presupuesto: guarda la Hoja de Fijacion (si hay cambios sin
  // guardar) y recien ahi pide el cambio de estado -- el backend rechaza el
  // congelamiento si la config nunca se guardo (ver /estado-aprobacion).
  const congelarMutation = useMutation({
    mutationFn: async () => {
      if (!versionId) return null;
      await updateFijacionConfig(versionId, borrador);
      return updateEstadoAprobacion(versionId, 'ESPERANDO_APROBACION_COMERCIAL');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });

  // Totales por partida (con su descuento y recargo), en el orden configurado.
  const totalesPorCategoria = (vista?.partidas ?? []).map((p) => ({ etiqueta: p.nombre, monto: p.total }));
  const t = vista?.totales;
  const materialesTotal = t?.materialesTotal ?? 0;
  const cantidadVentanas = vista?.indicadores.ventanas ?? 0;
  const m2Ventanas = t?.m2Ventanas ?? 0;
  const cantidadCuadros = useMemo(() => computeCantidadCuadros(activeVersion), [activeVersion]);
  const cantidadVidrios = vista?.indicadores.panos ?? 0;
  const m2Vidrios = t?.m2Vidrios ?? 0;
  const costoManoObra = t?.costoManoObra ?? 0;
  const costoFilm = t?.costoFilm ?? 0;
  const costoMaterialInstalacion = t?.costoMaterialInstalacion ?? 0;
  const costosComplementarios = t?.costosComplementarios ?? 0;
  const costoFlete = t?.costoFlete ?? 0;
  const costoInstalacion = t?.costoInstalacion ?? 0;
  const costoTotal = t?.costoTotal ?? 0;
  const margen = t?.margen ?? 0;
  const venta = t?.venta ?? 0;
  // Valor por m2 es el Valor de Venta (con margen), no el costo, dividido
  // por m2 de VENTANA (marco+vidrio) -- confirmado a mano con datos reales
  // (12.611,93 UF / 3.817,39 m2 = 3,30 UF/m2).
  const valorM2 = m2Ventanas > 0 ? venta / m2Ventanas : 0;

  const actualizarExtra = (index: number, patch: Partial<FijacionExtra>) => {
    setExtras((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };
  const agregarExtra = () => setExtras((prev) => [...prev, { glosa: '', monto: 0 }]);
  const eliminarExtra = (index: number) => setExtras((prev) => prev.filter((_, i) => i !== index));

  const exportarPDF = async () => {
    // Ver el mismo comentario en Step3Materiales.tsx: jsPDF + autotable se
    // cargan recién al exportar, no con el resto del Paso 4.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margen2 = 36;
    const contentWidth = pageWidth - margen2 * 2;
    const tableStyle = { ...pdfTableStyle, columnStyles: { 1: { halign: 'right' as const, fontStyle: 'bold' as const } } };

    const encabezado = [
      proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`,
      activeVersion ? `HETMO v${activeVersion.versionNumero}` : '',
    ].filter(Boolean).join(' | ');
    await drawPdfHeader(doc, 'Hoja de Fijación', encabezado, pageWidth);

    let y = 78;
    doc.setDrawColor(...MTW_BORDE);
    doc.setLineWidth(0.75);
    doc.line(margen2, y, pageWidth - margen2, y);
    y += 20;

    doc.setTextColor(...MTW_NAVY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(proyecto.obra, margen2, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MTW_GRIS);
    const clienteNombre = proyecto.cliente?.nombre || proyecto.clienteNombreRaw;
    if (clienteNombre) doc.text(clienteNombre, margen2, y);
    y += 22;

    // Columna izquierda: Materiales y métricas.
    const colGap = 16;
    const colWidth = (contentWidth - colGap) / 2;
    const rightX = margen2 + colWidth + colGap;
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      margin: { left: margen2, right: pageWidth - margen2 - colWidth },
      head: [['Materiales y métricas', '']],
      body: [
        ...totalesPorCategoria.map((c) => [
          mostrarAnalisis ? `${c.etiqueta} (${pctLabel(c.monto, venta)})` : c.etiqueta,
          clpLabel(c.monto),
        ]),
        ['Cantidad de ventanas', String(cantidadVentanas)],
        ['m² de ventanas', `${formatNumber(m2Ventanas, 2)} m²`],
        ['Cantidad de cuadros', String(cantidadCuadros)],
        ['Cantidad de vidrios', String(cantidadVidrios)],
        ['m² de vidrios', `${formatNumber(m2Vidrios, 2)} m²`],
      ],
    });
    const leftBottom = (doc as any).lastAutoTable.finalY;

    // Columna derecha: Costos complementarios, Flete e Instalación apiladas.
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      margin: { left: rightX, right: margen2 },
      head: [['Costos complementarios', '']],
      body: [
        [`Mano de obra fabricación · $${formatNumber(draft.manoObraFabricacion, 0)}/m² vent.`, clpLabel(costoManoObra)],
        [`Film protector cristales · $${formatNumber(draft.filmProtectorCristales, 0)}/m² vidrio`, clpLabel(costoFilm)],
        [`Material de instalación · $${formatNumber(draft.materialInstalacion, 0)}/m² vent.`, clpLabel(costoMaterialInstalacion)],
        ...extras.map((e) => [e.glosa, clpLabel(e.monto)]),
        ['Costo', clpLabel(costosComplementarios)],
      ],
    });
    let yRight = (doc as any).lastAutoTable.finalY + 12;
    autoTable(doc, {
      ...tableStyle,
      startY: yRight,
      margin: { left: rightX, right: margen2 },
      head: [['Flete', '']],
      body: [
        ['Cantidad de viajes', String(draft.cantidadViajes)],
        ['Valor viaje', clpLabel(draft.valorViaje)],
        ['Costo flete', clpLabel(costoFlete)],
      ],
    });
    yRight = (doc as any).lastAutoTable.finalY + 12;
    autoTable(doc, {
      ...tableStyle,
      startY: yRight,
      margin: { left: rightX, right: margen2 },
      head: [['Instalación', '']],
      body: [
        ['Valor por m²', clpLabel(draft.valorInstalacionM2)],
        ['Costo instalación', clpLabel(costoInstalacion)],
      ],
    });
    const rightBottom = (doc as any).lastAutoTable.finalY;

    let y2 = Math.max(leftBottom, rightBottom) + 16;
    autoTable(doc, {
      ...tableStyle,
      startY: y2,
      margin: { left: margen2, right: margen2 },
      styles: { ...tableStyle.styles, fontSize: 9, cellPadding: 6 },
      head: [['Resumen de costos', '']],
      body: [
        [mostrarAnalisis ? `Materiales (${pctLabel(materialesTotal, venta)})` : 'Materiales', clpLabel(materialesTotal)],
        [
          mostrarAnalisis ? `Costos complementarios (${pctLabel(costosComplementarios, venta)})` : 'Costos complementarios',
          clpLabel(costosComplementarios),
        ],
        [mostrarAnalisis ? `Flete (${pctLabel(costoFlete, venta)})` : 'Flete', clpLabel(costoFlete)],
        [mostrarAnalisis ? `Instalación (${pctLabel(costoInstalacion, venta)})` : 'Instalación', clpLabel(costoInstalacion)],
        ['Costo total NETO', clpLabel(costoTotal)],
      ],
      didParseCell: (data: any) => {
        if (data.row.index === 4) data.cell.styles.fontStyle = 'bold';
      },
    });

    y2 = (doc as any).lastAutoTable.finalY + 16;

    // Recuadro final EN NEGATIVO -- solo borde, sin relleno de color (a
    // pedido explicito: es un documento que se imprime, un fondo solido no
    // gasta tinta gratis). 4 columnas: Costo total / Margen de venta /
    // Valor por m² / Valor de venta -- Margen y Valor por m² van con el
    // mismo tamaño de fuente y quedan al centro del recuadro, mismo peso
    // visual para las dos métricas.
    const bannerHeight = 74;
    doc.setDrawColor(...MTW_NAVY);
    doc.setLineWidth(0.75);
    doc.roundedRect(margen2, y2, contentWidth, bannerHeight, 6, 6, 'S');
    const bannerColWidth = contentWidth / 4;
    const bannerLabel = (text: string, colIndex: number, yPos: number) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MTW_GRIS);
      doc.text(text, margen2 + bannerColWidth * colIndex + 14, yPos, { maxWidth: bannerColWidth - 20 });
    };
    const bannerValue = (text: string, colIndex: number, yPos: number, size = 12) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MTW_NAVY);
      doc.text(text, margen2 + bannerColWidth * colIndex + 14, yPos);
    };
    // "Costo total del proyecto · NETO" no entraba en una columna de 4
    // (medido con jsPDF.getTextWidth: 112.5pt vs 110.8pt de ancho
    // disponible) -- el wrap a una 2da linea pisaba "sin margen de venta"
    // justo debajo. Acortado a "Costo total NETO" (62.5pt, entra comodo).
    bannerLabel('Costo total NETO', 0, y2 + 20);
    bannerLabel('sin margen de venta', 0, y2 + 30);
    bannerValue(ufLabel(costoTotal, tasaUf), 0, y2 + 50, 13);
    bannerValue(clpLabel(costoTotal), 0, y2 + 63, 9.5);

    // Mismo tamaño (13pt, via bannerValue) que costoTotal/venta -- antes
    // 22pt y despues 16pt se seguian sintiendo desproporcionados al lado
    // del resto de los montos del recuadro.
    bannerLabel('Margen de venta', 1, y2 + 20);
    bannerValue(`${formatNumber(margen, 0)}%`, 1, y2 + 50, 13);

    bannerLabel('Valor por m²', 2, y2 + 20);
    bannerValue(ufLabel(valorM2, tasaUf), 2, y2 + 50, 13);

    bannerLabel('Valor de venta · NETO', 3, y2 + 20);
    bannerValue(ufLabel(venta, tasaUf), 3, y2 + 50, 13);
    bannerValue(clpLabel(venta), 3, y2 + 63, 9.5);

    y2 += bannerHeight + 16;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MTW_GRIS);
    doc.text(`Valor UF usado para presupuesto: $ ${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tasaUf)} por UF`, margen2, y2);

    doc.save(`hoja-fijacion-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`);
  };

  if (!activeVersion) {
    return (
      <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/10 border border-brand-600/30 flex items-center justify-center text-brand-600 mx-auto">
          <Calculator className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Paso 4: Hoja de Fijación</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">Seleccioná una versión para calcular la hoja de fijación.</p>
      </div>
    );
  }

  if (!base) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-xs text-slate-500 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Calculando la hoja de fijación…
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:border-brand-600 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand-600/10 text-brand-600 border border-brand-600/20 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hoja de Fijación</h3>
            <p className="text-[11px] text-slate-500">{proyecto.obra}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {congelado ? (
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5 mr-1">
              <Lock className="w-3.5 h-3.5" />
              {estadoActual === 'ESPERANDO_APROBACION_COMERCIAL'
                ? 'Esperando Aprobación Gerencial'
                : 'Presupuesto congelado -- solo lectura'}
            </span>
          ) : (
            hayCambios && <span className="text-[11px] font-semibold text-amber-600 mr-1">Cambios sin guardar</span>
          )}
          <Button variant="outline" size="sm" onClick={() => setMostrarAnalisis((v) => !v)}>
            {mostrarAnalisis ? 'Ocultar % venta' : 'Analizar precio'}
          </Button>
          <Button variant="secondary" size="sm" onClick={exportarPDF} leftIcon={<FileDown className="w-3.5 h-3.5" />}>
            Exportar PDF
          </Button>
          {!congelado && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => guardarMutation.mutate()}
              disabled={!hayCambios}
              isLoading={guardarMutation.isPending}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Guardar
            </Button>
          )}
          {!congelado && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => congelarMutation.mutate()}
              disabled={!puedeCongelar}
              isLoading={congelarMutation.isPending}
              title={
                todasLasPartidasAprobadas
                  ? 'Guarda la Hoja de Fijación y la envía a aprobación gerencial'
                  : 'Faltan partidas por aprobar en la Analítica de Materiales (Paso 3)'
              }
              leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
            >
              Solicitar Aprobación Gerencial
            </Button>
          )}
          {estadoActual === 'ESPERANDO_APROBACION_COMERCIAL' && (
            <>
              {puedeAprobarGerencia && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onCambiarEstadoAprobacion('APROBADO_GERENCIA')}
                  isLoading={isCambiandoEstadoAprobacion}
                  leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                >
                  Aprobar (Gerencia)
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCambiarEstadoAprobacion('EN_COTIZACION')}
                disabled={isCambiandoEstadoAprobacion}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Volver a Cotización
              </Button>
            </>
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
                <button onClick={agregarExtra} className="text-[11px] font-semibold text-brand-600 hover:underline flex items-center gap-1">
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
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white disabled:bg-slate-100"
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
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 flex-1">
                <span className="block">Valor por m² (Puerta Protex)</span>
                <span className="block text-[10px] text-slate-400">CLP por m² de línea manual Protex</span>
              </span>
              <input
                type="number"
                min={0}
                disabled={congelado}
                value={draft.valorInstalacionProtexM2 || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, valorInstalacionProtexM2: numeroInput(e.target.value) }))}
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
      </div>

      {/* Costo total / Margen + Valor por m² (centro) / Venta -- Valor por
          m² es una metrica clave para el negocio, se le da el mismo peso
          visual que el margen y se pone al lado para que ambas columnas
          formen el centro del recuadro. */}
      <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
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
              onChange={(e) => setDraft((prev) => ({ ...prev, margenVentaPct: Math.min(99, numeroInput(e.target.value)) }))}
              className="w-16 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-brand-600 disabled:opacity-60"
            />
            <span className="text-sm font-bold">%</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Valor por m²</div>
          <div className="text-lg font-bold font-mono text-white">{ufLabel(valorM2, tasaUf)}</div>
          <div className="text-xs font-mono text-slate-300">/m² de ventana</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Valor de venta · NETO</div>
          <div className="text-lg font-bold font-mono text-[#ff8a63]">{ufLabel(venta, tasaUf)}</div>
          <div className="text-xs font-mono text-slate-300">{clpLabel(venta)}</div>
        </div>
        <div className="col-span-2 md:col-span-4 text-[10px] text-slate-400 text-right">
          Valor UF usado para presupuesto: $ {new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tasaUf)} por UF
        </div>
      </div>
    </div>
  );
};
