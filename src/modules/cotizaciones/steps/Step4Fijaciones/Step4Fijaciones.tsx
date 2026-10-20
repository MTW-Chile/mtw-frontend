import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Check, Plus, Trash2, FileDown, Lock, ShieldCheck, ArrowLeft, Tags } from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import { getConceptosFijacion, getPartidas, updateFijacionConfig, updateEstadoAprobacion } from '../../../../api/client';
import type { ConceptoFijacionCodigo, Partida, Proyecto, ProyectoVersion, FijacionExtra, FijacionBorrador } from '../../../../types';
import { Button } from '../../../../components/ui/Button';
import { useAnalitica, useAnaliticaSimulada } from '../../lib/useAnalitica';
import { computeCantidadCuadros } from '../../lib/cuadros';
import { MTW_NAVY, MTW_GRIS, MTW_BORDE, pdfTableStyle, drawPdfHeader } from '../../lib/pdfTheme';
import { usePermisos } from '../../../../lib/permisos';
import { useParametrosGenerales } from '../../../../lib/parametrosGenerales';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../../components/ui/Tabla';
import { Badge } from '../../../../components/ui/Badge';
import { Aviso } from '../../../../components/ui/Aviso';
import { IconButton } from '../../../../components/ui/IconButton';
import { Seccion } from '../../../../components/ui/Seccion';
import { InputCompacto, NumeroInput, SelectCompacto } from '../../../../components/ui/Campos';
import { Cargando, EstadoVacio } from '../../../../components/ui/Estados';
import { SubTabs } from '../../../../components/ui/PageHeader';
import { useMigas } from '../../../../lib/migas';

interface Step4FijacionesProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  dolar: string;
  uf: string;
  euro: string;
  // Aprobación gerencial: vive acá (antes estaba en el Paso 5). Solo la
  // puede dar quien tiene el permiso 'gerencial' (o es admin).
  onCambiarEstadoAprobacion?: (estado: 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA') => void;
  isCambiandoEstadoAprobacion?: boolean;
  // Version de un adicional: sin el flujo de aprobacion de la cotizacion (el
  // adicional tiene el suyo); queda de solo lectura fuera de borrador.
  modoAdicional?: boolean;
}

type DraftFijacion = Omit<FijacionBorrador, 'extras'>;

type PestanaHoja = 'hoja' | 'asignacion';

type CampoNumerico = Exclude<keyof DraftFijacion, 'asignaciones'>;

const DRAFT_VACIO: Record<CampoNumerico, number> = {
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
  draft: { ...resto, asignaciones: { ...(resto.asignaciones ?? {}) } },
  extras: extras.map((e) => ({ glosa: e.glosa ?? '', monto: Number(e.monto) || 0, partidaCodigo: e.partidaCodigo ?? null })),
});

const mismasAsignaciones = (a: FijacionBorrador['asignaciones'] = {}, b: FijacionBorrador['asignaciones'] = {}) => {
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<ConceptoFijacionCodigo>;
  return [...claves].every((k) => (a[k] ?? null) === (b[k] ?? null));
};

const mismaFijacion = (a: FijacionBorrador, b: FijacionBorrador) =>
  (Object.keys(DRAFT_VACIO) as CampoNumerico[]).every((k) => Number(a[k]) === Number(b[k])) &&
  mismasAsignaciones(a.asignaciones, b.asignaciones) &&
  a.extras.length === b.extras.length &&
  a.extras.every(
    (e, i) =>
      (e.glosa ?? '') === (b.extras[i].glosa ?? '') &&
      Number(e.monto) === Number(b.extras[i].monto) &&
      (e.partidaCodigo ?? null) === (b.extras[i].partidaCodigo ?? null)
  );

/**
 * Partida a la que se carga un concepto o un extra. "Sin asignar" se marca en
 * ámbar: el costo cuenta igual, pero no queda en una partida real del Control
 * de Presupuesto.
 */
const SelectorPartida: React.FC<{
  partidas: Partida[];
  valor: string;
  disabled: boolean;
  onChange: (codigo: string) => void;
  etiqueta: string;
}> = ({ partidas, valor, disabled, onChange, etiqueta }) => {
  const sinAsignar = partidas.find((p) => p.codigo === valor)?.porDefecto ?? false;
  return (
    <SelectCompacto
      aria-label={etiqueta}
      title={sinAsignar ? 'Sin partida asignada: elige a cuál se carga' : etiqueta}
      value={valor}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      tono={sinAsignar ? 'advertencia' : undefined}
      className="max-w-[180px]"
    >
      {partidas
        .filter((p) => p.activa || p.codigo === valor)
        .map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.porDefecto ? `⚠ ${p.nombre}` : p.nombre}
          </option>
        ))}
    </SelectCompacto>
  );
};

const clpLabel = (valor: number) => `$ ${formatNumber(valor, 0)}`;
const ufLabel = (valor: number, tasaUf: number) =>
  tasaUf > 0 ? `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(valor / tasaUf)} UF` : '—';
const pctLabel = (monto: number, venta: number) =>
  venta > 0 ? `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format((monto * 100) / venta)}% venta` : '—';

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
  isCambiandoEstadoAprobacion = false,
  modoAdicional = false,
}) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const puedeAprobarGerencia = tiene('presupuestos.aprobar_gerencial');
  // Sin tasa en pantalla: las de respaldo de Configuración > Comercial.
  const parametros = useParametrosGenerales();
  const tasaDolar = Number(dolar) || parametros?.tasasRespaldo.dolar || 0;
  const tasaUf = Number(uf) || parametros?.tasasRespaldo.uf || 0;
  const tasaEuro = Number(euro) || parametros?.tasasRespaldo.euro || 0;
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
  const [draft, setDraft] = useState<DraftFijacion>({ ...DRAFT_VACIO, asignaciones: {} });
  const [extras, setExtras] = useState<FijacionExtra[]>([]);
  const [draftDe, setDraftDe] = useState<string | null>(null);
  const [mostrarAnalisis, setMostrarAnalisis] = useState(false);
  // Hoja de Fijación (vista ordenada como el PDF, la que revisa gerencia) o
  // Asignación de costos (a qué partida se carga cada costo).
  const [pestana, setPestana] = useState<PestanaHoja>('hoja');
  useMigas(2, [pestana === 'asignacion' && { label: 'Asignación de costos' }]);
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

  // Partida de cada concepto y extra (configurable aquí; la por defecto de cada
  // concepto se define en Configuración > Catálogo > Hoja de Fijación).
  const { data: catalogoPartidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const { data: conceptos = [] } = useQuery({ queryKey: ['conceptosFijacion'], queryFn: getConceptosFijacion });
  const codigoSinAsignar = catalogoPartidas.find((p) => p.porDefecto)?.codigo ?? 'SIN_ASIGNAR';
  const partidaPorDefectoDe = (c: ConceptoFijacionCodigo) => conceptos.find((x) => x.codigo === c)?.partidaPorDefecto?.codigo ?? codigoSinAsignar;
  const partidaDeConcepto = (c: ConceptoFijacionCodigo) => draft.asignaciones?.[c] ?? partidaPorDefectoDe(c);
  const asignarConcepto = (c: ConceptoFijacionCodigo, codigo: string) =>
    setDraft((prev) => {
      const asignaciones = { ...(prev.asignaciones ?? {}) };
      if (codigo === partidaPorDefectoDe(c)) delete asignaciones[c];
      else asignaciones[c] = codigo;
      return { ...prev, asignaciones };
    });
  const selectorConcepto = (c: ConceptoFijacionCodigo) => (
    <SelectorPartida
      partidas={catalogoPartidas}
      valor={partidaDeConcepto(c)}
      disabled={congelado}
      onChange={(codigo) => asignarConcepto(c, codigo)}
      etiqueta="Partida a la que se carga"
    />
  );
  const extrasSinPartida = extras.filter((e) => !e.partidaCodigo || e.partidaCodigo === codigoSinAsignar).length;

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
  // Mismo criterio que el Paso 3 y que el API (partidasDeVersion): se
  // aprueban las partidas con materiales. Una partida que solo recibe costos
  // de esta hoja (Instalación, Flete, Sin asignar) no se aprueba en ningún lado.
  const partidasConMateriales = partidas.filter((p) => p.tieneMateriales);
  const todasLasPartidasAprobadas = partidasConMateriales.length > 0 && partidasConMateriales.every((p) => p.aprobada);
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
  // Materiales por partida (con descuento y holgura), en el orden configurado.
  const totalesPorCategoria = (vista?.partidas ?? [])
    .filter((p) => p.tieneMateriales)
    .map((p) => ({ etiqueta: p.nombre, monto: p.materiales + p.holgura }));
  // Presupuesto por partida: materiales, holgura y costos de esta Hoja.
  const presupuestoPorPartida = (vista?.partidas ?? []).filter((p) => p.total !== 0);
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
  const agregarExtra = () => setExtras((prev) => [...prev, { glosa: '', monto: 0, partidaCodigo: null }]);
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
    return <EstadoVacio icono={Calculator} titulo="Hoja de Fijación" descripcion="Selecciona una versión para calcular la hoja de fijación." />;
  }

  if (!base) return <Cargando texto="Calculando la hoja de fijación…" />;

  const montoConcepto = (c: ConceptoFijacionCodigo) => vista?.lineasFijacion.find((l) => l.concepto === c)?.monto ?? 0;
  const costoHoja = costosComplementarios + costoFlete + costoInstalacion;
  const setNumero = (campo: CampoNumerico, max?: number) => (v: number | null) =>
    setDraft((prev) => ({ ...prev, [campo]: Math.min(max ?? Infinity, Math.max(0, v ?? 0)) }));
  // "(12% venta)" junto a un monto, solo con "Analizar precio".
  const analisis = (monto: number) => (mostrarAnalisis ? <span className="text-slate-400 font-normal ml-1.5">({pctLabel(monto, venta)})</span> : null);
  const haySinAsignar = extrasSinPartida > 0 || presupuestoPorPartida.some((p) => p.codigo === codigoSinAsignar);

  const estadoBadge = congelado ? (
    <Badge size="sm" variant={estadoActual === 'ESPERANDO_APROBACION_COMERCIAL' && !modoAdicional ? 'warning' : 'default'}>
      <Lock className="w-3 h-3" />
      {modoAdicional ? 'Solo lectura: el adicional ya no está en borrador' : estadoActual === 'ESPERANDO_APROBACION_COMERCIAL' ? 'Esperando aprobación gerencial' : 'Presupuesto congelado'}
    </Badge>
  ) : hayCambios ? (
    <Badge size="sm" variant="warning" dot>
      Cambios sin guardar
    </Badge>
  ) : null;

  const tasaUfTexto = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tasaUf);

  // Fila de la hoja: etiqueta (y su ayuda) a la izquierda, valor o campo a la derecha.
  // `alta`: la columna de materiales reparte su alto entre las filas para
  // quedar pareja con la de costos (que tiene campos y totales).
  const fila = (label: React.ReactNode, valor: React.ReactNode, ayuda?: React.ReactNode, key?: string, alta?: boolean) => (
    <div key={key} className={`flex items-center justify-between gap-3 px-5 text-xs ${alta ? 'flex-1 py-2.5' : 'py-1.5'}`}>
      <div className="min-w-0">
        <div className="text-slate-600">{label}</div>
        {ayuda && <div className="text-[10px] text-slate-400">{ayuda}</div>}
      </div>
      <div className="shrink-0 font-mono font-bold text-slate-900 tabular-nums">{valor}</div>
    </div>
  );
  const total = (label: React.ReactNode, monto: number) => (
    <div className="flex items-center justify-between gap-3 px-5 py-2 bg-slate-50/70 text-xs font-bold text-slate-900">
      <span>
        {label}
        {analisis(monto)}
      </span>
      <span className="font-mono tabular-nums">{clpLabel(monto)}</span>
    </div>
  );
  const campo = (c: CampoNumerico, nombre: string, sufijo: string) => (
    <NumeroInput valor={draft[c] as number} onGuardar={setNumero(c)} disabled={congelado} sufijo={sufijo} aria-label={nombre} className="w-28" />
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <Seccion
        icono={Calculator}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Hoja de Fijación {estadoBadge}
          </span>
        }
        descripcion={proyecto.obra}
        acciones={
          <>
            <Button variant="ghost" size="sm" onClick={() => setMostrarAnalisis((v) => !v)}>
              {mostrarAnalisis ? 'Ocultar análisis' : 'Analizar precio'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPDF} leftIcon={<FileDown className="w-3.5 h-3.5" />}>
              Exportar PDF
            </Button>
            {!congelado && (
              <Button variant="outline" size="sm" onClick={() => guardarMutation.mutate()} disabled={!hayCambios} isLoading={guardarMutation.isPending} leftIcon={<Check className="w-3.5 h-3.5" />}>
                Guardar
              </Button>
            )}
            {!congelado && !modoAdicional && (
              <Button
                size="sm"
                onClick={() => congelarMutation.mutate()}
                disabled={!puedeCongelar}
                isLoading={congelarMutation.isPending}
                title={todasLasPartidasAprobadas ? 'Guarda la Hoja de Fijación y la envía a aprobación gerencial' : 'Faltan partidas por aprobar en la Analítica de Materiales (Paso 3)'}
                leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
              >
                Solicitar aprobación gerencial
              </Button>
            )}
            {estadoActual === 'ESPERANDO_APROBACION_COMERCIAL' && !modoAdicional && onCambiarEstadoAprobacion && (
              <>
                <Button variant="outline" size="sm" onClick={() => onCambiarEstadoAprobacion('EN_COTIZACION')} disabled={isCambiandoEstadoAprobacion} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                  Volver a cotización
                </Button>
                {puedeAprobarGerencia && (
                  <Button size="sm" onClick={() => onCambiarEstadoAprobacion('APROBADO_GERENCIA')} isLoading={isCambiandoEstadoAprobacion} leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}>
                    Aprobar (gerencia)
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      {congelarMutation.isError && (
        <Aviso tono="peligro">{(congelarMutation.error as any)?.response?.data?.error || 'No se pudo enviar el presupuesto a aprobación.'}</Aviso>
      )}
      {haySinAsignar && (
        <Aviso
          tono="advertencia"
          titulo="Hay costos en “Sin asignar”"
          accion={
            pestana === 'hoja' && (
              <Button size="sm" variant="outline" leftIcon={<Tags className="w-3.5 h-3.5" />} onClick={() => setPestana('asignacion')}>
                Ir a Asignación de costos
              </Button>
            )
          }
        >
          {extrasSinPartida > 0 && `${extrasSinPartida} ${extrasSinPartida === 1 ? 'extra' : 'extras'} sin partida. `}
          Cuentan para el costo y la venta, pero no quedan en una partida real del Control de Presupuesto. Elige su partida en la pestaña Asignación de costos.
        </Aviso>
      )}

      <SubTabs<PestanaHoja>
        tabs={[
          { id: 'hoja', label: 'Hoja de Fijación' },
          { id: 'asignacion', label: 'Asignación de costos' },
        ]}
        active={pestana}
        onChange={setPestana}
      />

      {pestana === 'hoja' ? (
        <>
          {/* Mismo orden que el PDF: materiales y métricas | costos, resumen y resultado. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <Seccion titulo="Materiales y métricas" sinRelleno className="flex flex-col" cuerpoClassName="flex-1 flex flex-col divide-y divide-slate-100">
              {totalesPorCategoria.map((c) => fila(<>{c.etiqueta}{analisis(c.monto)}</>, clpLabel(c.monto), undefined, `m-${c.etiqueta}`, true))}
              {fila('Cantidad de ventanas', String(cantidadVentanas), undefined, 'ventanas', true)}
              {fila('m² de ventanas', `${formatNumber(m2Ventanas, 2)} m²`, undefined, 'm2v', true)}
              {fila('Cantidad de cuadros', String(cantidadCuadros), undefined, 'cuadros', true)}
              {fila('Cantidad de vidrios', String(cantidadVidrios), undefined, 'vidrios', true)}
              {fila('m² de vidrios', `${formatNumber(m2Vidrios, 2)} m²`, undefined, 'm2vid', true)}
            </Seccion>

            <div className="space-y-4">
              <Seccion
                titulo="Costos complementarios"
                sinRelleno
                acciones={
                  !congelado && (
                    <Button size="sm" variant="link" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={agregarExtra}>
                      Agregar extra
                    </Button>
                  )
                }
              >
                <div className="divide-y divide-slate-100">
                  {fila(<>Mano de obra fabricación{analisis(costoManoObra)}</>, campo('manoObraFabricacion', 'Mano de obra fabricación', '$/m²'), `CLP por m² de ventana · ${clpLabel(costoManoObra)}`)}
                  {fila(<>Film protector cristales{analisis(costoFilm)}</>, campo('filmProtectorCristales', 'Film protector cristales', '$/m²'), `CLP por m² de vidrio · ${clpLabel(costoFilm)}`)}
                  {fila(<>Material de instalación{analisis(costoMaterialInstalacion)}</>, campo('materialInstalacion', 'Material de instalación', '$/m²'), `CLP por m² de ventana · ${clpLabel(costoMaterialInstalacion)}`)}
                  {extras.map((extra, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-5 py-1.5 text-xs">
                      <InputCompacto
                        aria-label="Glosa del extra"
                        disabled={congelado}
                        placeholder="Glosa del extra"
                        value={extra.glosa}
                        onChange={(e) => actualizarExtra(idx, { glosa: e.target.value })}
                        className="flex-1 min-w-0 font-semibold"
                      />
                      <NumeroInput valor={extra.monto} onGuardar={(v) => actualizarExtra(idx, { monto: Math.max(0, v ?? 0) })} disabled={congelado} sufijo="$" aria-label={`Monto de ${extra.glosa || 'el extra'}`} className="w-28" />
                      {!congelado && <IconButton icono={Trash2} tono="peligro" etiqueta={`Quitar ${extra.glosa || 'el extra'}`} onClick={() => eliminarExtra(idx)} />}
                    </div>
                  ))}
                </div>
                {total('Costo', costosComplementarios)}
              </Seccion>

              <Seccion titulo="Flete" sinRelleno>
                <div className="divide-y divide-slate-100">
                  {fila(
                    'Cantidad de viajes',
                    <NumeroInput valor={draft.cantidadViajes} onGuardar={(v) => setNumero('cantidadViajes')(Math.trunc(v ?? 0))} disabled={congelado} sufijo="viajes" aria-label="Cantidad de viajes" className="w-28" />
                  )}
                  {fila('Valor viaje', campo('valorViaje', 'Valor viaje', '$'))}
                </div>
                {total('Costo flete', costoFlete)}
              </Seccion>

              <Seccion titulo="Instalación" sinRelleno>
                <div className="divide-y divide-slate-100">
                  {fila('Valor por m²', campo('valorInstalacionM2', 'Instalación: valor por m²', '$/m²'), 'CLP por m² de ventana')}
                  {fila('Valor por m² (puerta Protex)', campo('valorInstalacionProtexM2', 'Instalación Protex: valor por m²', '$/m²'), `CLP por m² de puerta Protex · ${formatNumber(t?.m2Protex ?? 0, 2)} m²`)}
                </div>
                {total('Costo instalación', costoInstalacion)}
              </Seccion>
            </div>
          </div>

          <Seccion titulo="Resumen de costos" sinRelleno>
            <div className="divide-y divide-slate-100">
              {(
                [
                  ['Materiales', materialesTotal],
                  ['Costos complementarios', costosComplementarios],
                  ['Flete', costoFlete],
                  ['Instalación', costoInstalacion],
                ] as const
              ).map(([label, monto]) => fila(<>{label}{analisis(monto)}</>, clpLabel(monto), undefined, label))}
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50/70 text-sm font-bold text-slate-900">
              <span>Costo total NETO</span>
              <span className="font-mono tabular-nums">{clpLabel(costoTotal)}</span>
            </div>
          </Seccion>

          {/* Resultado: lo que se aprueba con esta hoja. */}
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Resultado etiqueta="Costo total NETO" valor={ufLabel(costoTotal, tasaUf)} detalle={clpLabel(costoTotal)} />
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Margen de venta</div>
                <div className="mt-1.5">
                  <NumeroInput valor={draft.margenVentaPct} onGuardar={setNumero('margenVentaPct', 99)} max={99} disabled={congelado} sufijo="%" aria-label="Margen de venta" className="w-20 text-sm! font-bold" />
                </div>
              </div>
              <Resultado etiqueta="Valor por m²" valor={ufLabel(valorM2, tasaUf)} detalle="por m² de ventana" />
              <Resultado etiqueta="Valor de venta NETO" valor={ufLabel(venta, tasaUf)} detalle={clpLabel(venta)} destacado />
            </div>
            <p className="mt-2 text-[10px] text-slate-400 text-right">UF usada para el presupuesto: $ {tasaUfTexto}</p>
          </div>
        </>
      ) : (
        <>
          <Seccion sinRelleno titulo="Costos de la hoja" descripcion="A qué partida del Control de Presupuesto se carga cada costo. Los valores se editan en la pestaña Hoja de Fijación.">
            <Tabla>
              <Thead>
                <Tr>
                  <Th>Concepto</Th>
                  <Th alinear="derecha">Cantidad</Th>
                  <Th alinear="derecha">Costo</Th>
                  <Th>Partida</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(
                  [
                    ['MANO_OBRA_FABRICACION', 'Mano de obra fabricación', `${formatNumber(m2Ventanas, 2)} m² vent.`],
                    ['FILM_PROTECTOR', 'Film protector cristales', `${formatNumber(m2Vidrios, 2)} m² vidrio`],
                    ['MATERIAL_INSTALACION', 'Material de instalación', `${formatNumber(m2Ventanas, 2)} m² vent.`],
                    ['FLETE', 'Flete', `${draft.cantidadViajes} viajes`],
                    ['INSTALACION', 'Instalación', `${formatNumber(m2Ventanas, 2)} m² vent.`],
                    ['INSTALACION_PROTEX', 'Instalación puerta Protex', `${formatNumber(t?.m2Protex ?? 0, 2)} m²`],
                  ] as const
                ).map(([concepto, nombre, cantidad]) => (
                  <Tr key={concepto}>
                    <Td className="font-semibold text-slate-800">{nombre}</Td>
                    <Td numero className="text-slate-500">{cantidad}</Td>
                    <Td numero fuerte>{clpLabel(montoConcepto(concepto))}</Td>
                    <Td>{selectorConcepto(concepto)}</Td>
                  </Tr>
                ))}
                {extras.map((extra, idx) => (
                  <Tr key={`e-${idx}`}>
                    <Td className="font-semibold text-slate-800">{extra.glosa || <span className="text-slate-400 font-normal">Extra sin glosa</span>}</Td>
                    <Td numero className="text-slate-400">—</Td>
                    <Td numero fuerte>{clpLabel(extra.monto)}</Td>
                    <Td>
                      <SelectorPartida
                        partidas={catalogoPartidas}
                        valor={extra.partidaCodigo || codigoSinAsignar}
                        disabled={congelado}
                        onChange={(codigo) => actualizarExtra(idx, { partidaCodigo: codigo === codigoSinAsignar ? null : codigo })}
                        etiqueta={`Partida de ${extra.glosa || 'este extra'}`}
                      />
                    </Td>
                  </Tr>
                ))}
                <Tr className="bg-slate-50/70 hover:bg-slate-50/70">
                  <Td colSpan={2} className="font-bold text-slate-900">Costo de la hoja</Td>
                  <Td numero fuerte>{clpLabel(costoHoja)}</Td>
                  <Td />
                </Tr>
              </Tbody>
            </Tabla>
          </Seccion>

          <Seccion
            sinRelleno
            titulo="Presupuesto por partida"
            descripcion="Materiales (con descuento y holgura) más los costos de esta hoja según su partida. Es lo que el Control de Presupuesto compara contra las OC."
          >
            <Tabla>
              <Thead>
                <Tr>
                  <Th>Partida</Th>
                  <Th alinear="derecha">Materiales</Th>
                  <Th alinear="derecha">Holgura</Th>
                  <Th alinear="derecha">Hoja de fijación</Th>
                  <Th alinear="derecha">Presupuesto</Th>
                </Tr>
              </Thead>
              <Tbody>
                {presupuestoPorPartida.map((p) => (
                  <Tr key={p.codigo} tono={p.codigo === codigoSinAsignar ? 'advertencia' : undefined}>
                    <Td className="text-slate-700">{p.nombre}</Td>
                    <Td numero mono className="text-slate-600">{p.materiales ? clpLabel(p.materiales) : '—'}</Td>
                    <Td numero mono className="text-slate-600">{p.holgura ? clpLabel(p.holgura) : '—'}</Td>
                    <Td numero mono className="text-slate-600">{p.fijacion ? clpLabel(p.fijacion) : '—'}</Td>
                    <Td numero mono fuerte>{clpLabel(p.total)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Tabla>
          </Seccion>
        </>
      )}
    </div>
  );
};

const Resultado: React.FC<{ etiqueta: string; valor: string; detalle?: string; destacado?: boolean }> = ({ etiqueta, valor, detalle, destacado }) => (
  <div className={`p-3.5 rounded-xl border ${destacado ? 'border-brand-600/30 bg-brand-50/60' : 'border-slate-200 bg-white'}`}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{etiqueta}</div>
    <div className={`mt-1 text-lg font-black tabular-nums ${destacado ? 'text-brand-700' : 'text-slate-900'}`}>{valor}</div>
    {detalle && <div className="text-[11px] font-mono text-slate-500 tabular-nums">{detalle}</div>}
  </div>
);
