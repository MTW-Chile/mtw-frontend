import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Search,
  FileSpreadsheet,
  FileDown,
  CheckCircle2,
  Check,
  ChevronDown,
  ShieldCheck,
  Lock,
  Loader2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '../../../../lib/utils';
import { useMonedas, resolverMoneda, formatMonto } from '../../../../lib/monedas';
import { saveMaterialAjuste, setFamiliaAprobacion, setFamiliaDescuento, setFamiliaRecargo, updateEstadoAprobacion } from '../../../../api/client';
import type { Proyecto, ProyectoVersion } from '../../../../types';
import { DivisasForm } from '../Step1DatosCliente/DivisasForm';
import {
  computeMaterialesConsolidados,
  montoConAjuste,
  type MaterialConsolidado,
} from '../../lib/materialesConsolidados';

interface Step3MaterialesProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  // Divisas
  dolar: string;
  setDolar: (val: string) => void;
  uf: string;
  setUf: (val: string) => void;
  euro: string;
  setEuro: (val: string) => void;
  saveSuccess: boolean;
  onSaveDivisas: () => void;
  isSavingDivisas: boolean;
}

// BORRADOR es el valor historico de la columna antes del flujo de estado
// comercial; se trata igual que EN_COTIZACION (ver relay-api).
const normalizarEstado = (estado: string) => (estado === 'BORRADOR' ? 'EN_COTIZACION' : estado);

// UF se muestra con hasta 2 decimales (sin forzar ceros de relleno) -- CLP
// siempre redondeado a entero, formatNumber(x, 0) ya lo hace bien.
const formatUF = (valor: number) =>
  new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(valor);

// Orden de categorias pedido explicitamente, no alfabetico. Cualquier
// familia que no este en la lista (ej. "Otros") va al final, alfabetica.
const ORDEN_FAMILIAS = ['PERFILERIA', 'ACCESORIOS', 'REFUERZOS', 'HERRAJES', 'VIDRIOS'];
const ordenFamilia = (familia: string) => {
  const idx = ORDEN_FAMILIAS.indexOf(familia);
  return idx === -1 ? ORDEN_FAMILIAS.length : idx;
};

// Input numerico inline: mantiene texto local mientras se edita y solo
// dispara el guardado al perder foco o con Enter -- si guardara en cada
// tecla, cada digito escrito seria un PATCH distinto contra la API.
const PrecioEditable: React.FC<{
  valor: number;
  disabled: boolean;
  onGuardar: (valor: number) => void;
}> = ({ valor, disabled, onGuardar }) => {
  const [texto, setTexto] = useState(String(valor));

  useEffect(() => {
    setTexto(String(valor));
  }, [valor]);

  const confirmar = () => {
    const parsed = Number(texto.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed !== valor) {
      onGuardar(parsed);
    } else {
      setTexto(String(valor));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={texto}
      disabled={disabled}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="w-20 px-1.5 py-1 rounded-md border border-slate-200 bg-white text-right font-mono text-xs text-slate-800 focus:outline-none focus:border-[#E34A26] disabled:bg-slate-50 disabled:text-slate-400 disabled:border-transparent"
    />
  );
};

export const Step3Materiales: React.FC<Step3MaterialesProps> = ({
  proyecto,
  activeVersion,
  dolar,
  setDolar,
  uf,
  setUf,
  euro,
  setEuro,
  saveSuccess,
  onSaveDivisas,
  isSavingDivisas,
}) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [familiaColapsada, setFamiliaColapsada] = useState<Record<string, boolean>>({});

  const monedas = useMonedas();
  const tasaDolar = Number(dolar) || 950;
  const tasaUf = Number(uf) || 38500;
  const tasaEuro = Number(euro) || 1030;

  const versionId = activeVersion?.id;
  const estadoActual = activeVersion ? normalizarEstado(activeVersion.estadoAprobacion) : 'EN_COTIZACION';
  const congelado = Boolean(activeVersion?.esCongelado);
  // El "deshacer" global solo es valido desde ESPERANDO_APROBACION_COMERCIAL
  // (ver TRANSICIONES_PERMITIDAS en el relay-api) -- en APROBADO_GERENCIA o
  // ACEPTADO_CLIENTE el retroceso se maneja desde el Paso 5, no desde aca.
  const puedeDeshacerAca = estadoActual === 'ESPERANDO_APROBACION_COMERCIAL';

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['proyectos'] });
  };

  // Ajustes por material: exclusion, precio y familia personalizados. Se
  // guardan directo contra la API al tocarlos -- nada de estado "flotante"
  // que se pierda al recargar.
  const ajusteMutation = useMutation({
    mutationFn: (payload: {
      materialId: string;
      excluido: boolean;
      familia: string;
      precioPersonalizado?: number;
      monedaPersonalizada?: string;
    }) => {
      if (!versionId) return Promise.resolve(null);
      return saveMaterialAjuste(versionId, {
        materialId: payload.materialId,
        excluido: payload.excluido,
        familiaPersonalizada: payload.familia,
        precioPersonalizado: payload.precioPersonalizado,
        monedaPersonalizada: payload.monedaPersonalizada,
      });
    },
    onSuccess: invalidar,
  });

  // Reenvia siempre excluido/familia actuales junto con el cambio puntual --
  // el endpoint sobreescribe esos campos con lo que reciba, asi que mandar
  // solo el campo que cambio resetearia los demas (ej. excluido volveria a
  // false). precioPersonalizado/monedaPersonalizada se omiten cuando no se
  // esta editando precio, para no "congelar" el precio de HETMO como
  // override cada vez que solo se toca la exclusion.
  const guardarAjuste = (
    m: MaterialConsolidado,
    cambios: { excluido?: boolean; precioOrigen?: number; monedaOrigen?: string }
  ) => {
    ajusteMutation.mutate({
      materialId: m.materialId,
      excluido: cambios.excluido ?? m.excluido,
      familia: m.familia,
      precioPersonalizado: cambios.precioOrigen,
      monedaPersonalizada: cambios.precioOrigen !== undefined ? cambios.monedaOrigen ?? m.monedaOrigen : undefined,
    });
  };

  const familiaAprobacionMutation = useMutation({
    mutationFn: (payload: { familia: string; aprobada: boolean }) => {
      if (!versionId) return Promise.resolve(null);
      return setFamiliaAprobacion(versionId, payload.familia, payload.aprobada);
    },
    onSuccess: invalidar,
  });

  const familiaDescuentoMutation = useMutation({
    mutationFn: (payload: { familia: string; descuentoPct: number }) => {
      if (!versionId) return Promise.resolve(null);
      return setFamiliaDescuento(versionId, payload.familia, payload.descuentoPct);
    },
    onSuccess: invalidar,
  });

  const familiaRecargoMutation = useMutation({
    mutationFn: (payload: { familia: string; recargoPct: number }) => {
      if (!versionId) return Promise.resolve(null);
      return setFamiliaRecargo(versionId, payload.familia, payload.recargoPct);
    },
    onSuccess: invalidar,
  });

  const estadoAprobacionMutation = useMutation({
    mutationFn: (estado: 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL') => {
      if (!versionId) return Promise.resolve(null);
      return updateEstadoAprobacion(versionId, estado);
    },
    onSuccess: invalidar,
  });

  // Boton global: no es un segundo control que se habilita recien cuando
  // cada categoria ya se aprobo a mano una por una -- el es quien aprueba
  // (o abre) todas las categorias de una sola vez. Aprueba las que falten y
  // recien ahi dispara el congelamiento, todo en un solo click.
  const aprobarTodoMutation = useMutation({
    mutationFn: async () => {
      if (!versionId) return null;
      const pendientes = gruposPorFamilia.filter(([familia]) => !aprobacionesPorFamilia.get(familia)?.aprobada);
      await Promise.all(pendientes.map(([familia]) => setFamiliaAprobacion(versionId, familia, true)));
      return updateEstadoAprobacion(versionId, 'ESPERANDO_APROBACION_COMERCIAL');
    },
    onSuccess: invalidar,
  });

  // Consolidar todos los materiales de las ventanas de esta versión, con los
  // ajustes ya guardados (exclusion / familia personalizada) aplicados.
  // Logica compartida con Step4Fijaciones -- ver materialesConsolidados.ts.
  const materialesConsolidados: MaterialConsolidado[] = useMemo(
    () => computeMaterialesConsolidados(activeVersion, tasaDolar, tasaEuro, tasaUf, monedas),
    [activeVersion, tasaDolar, tasaEuro, tasaUf, monedas]
  );

  // Filtrado por buscador
  const filteredMateriales = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return materialesConsolidados;
    return materialesConsolidados.filter((m) => {
      const matchSku = m.skuInterno.toLowerCase().includes(term);
      const matchDesc = m.descripcion.toLowerCase().includes(term);
      const matchProv = m.proveedorNombre.toLowerCase().includes(term);
      return matchSku || matchDesc || matchProv;
    });
  }, [materialesConsolidados, searchTerm]);

  // Agrupado por familia -- cada una es su propia seccion con aprobacion
  // independiente, como en la Analitica de Materiales del sistema anterior.
  const gruposPorFamilia = useMemo(() => {
    const map = new Map<string, MaterialConsolidado[]>();
    filteredMateriales.forEach((m) => {
      const list = map.get(m.familia) || [];
      list.push(m);
      map.set(m.familia, list);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const diff = ordenFamilia(a[0]) - ordenFamilia(b[0]);
      return diff !== 0 ? diff : a[0].localeCompare(b[0]);
    });
  }, [filteredMateriales]);

  const aprobacionesPorFamilia = useMemo(
    () => new Map((activeVersion?.familiaAprobaciones || []).map((f) => [f.familia, f])),
    [activeVersion?.familiaAprobaciones]
  );

  const todasLasFamiliasAprobadas =
    gruposPorFamilia.length > 0 && gruposPorFamilia.every(([familia]) => aprobacionesPorFamilia.get(familia)?.aprobada);
  const familiasPendientes = gruposPorFamilia.filter(([familia]) => !aprobacionesPorFamilia.get(familia)?.aprobada);

  // Totales -- el descuento y el recargo de cada familia se aplican sobre
  // el total CLP de sus materiales incluidos (nunca sobre el precio de
  // cada material individual). Se combinan como dos ajustes porcentuales
  // independientes: primero se descuenta, despues se recarga.
  const costoTotalCLP = filteredMateriales
    .filter((m) => !m.excluido)
    .reduce((acc, m) => acc + montoConAjuste(m, aprobacionesPorFamilia), 0);

  const costoTotalUF = tasaUf > 0 ? costoTotalCLP / tasaUf : 0;
  const cantidadExcluidos = materialesConsolidados.filter((m) => m.excluido).length;

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margen = 32;
    let y = margen;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Analítica de Materiales — ${proyecto.obra}`, margen, y);
    y += 18;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const encabezado = [
      proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`,
      activeVersion ? `Revisión ${activeVersion.versionNumero}` : '',
      `Exportado ${new Date().toLocaleDateString('es-CL')}`,
    ].filter(Boolean).join('  ·  ');
    doc.text(encabezado, margen, y);
    y += 16;

    gruposPorFamilia.forEach(([familia, materiales]) => {
      const aprobacion = aprobacionesPorFamilia.get(familia);
      const descuento = Number(aprobacion?.descuentoPct) || 0;
      const recargo = Number(aprobacion?.recargoPct) || 0;
      const factorFamilia = (1 - descuento / 100) * (1 + recargo / 100);
      const totalFamilia = materiales
        .filter((m) => !m.excluido)
        .reduce((acc, m) => acc + m.precioCLP * m.cantidadTotal, 0) * factorFamilia;

      if (y > 520) {
        doc.addPage();
        y = margen;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const ajustes = [descuento > 0 ? `descuento ${descuento}%` : null, recargo > 0 ? `recargo ${recargo}%` : null]
        .filter(Boolean)
        .join(', ');
      const tituloFamilia = ajustes ? `${familia}  (${ajustes})` : familia;
      doc.text(tituloFamilia, margen, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: margen, right: margen },
        styles: { fontSize: 7.5, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59] },
        head: [['SKU', 'Descripción', 'Proveedor', 'Precio Unit. Origen', 'Precio Unit. CLP', 'Cantidad', 'Unidad', 'Total CLP', 'Estado']],
        body: materiales.map((m) => [
          m.skuInterno,
          m.descripcion,
          m.proveedorNombre,
          formatMonto(m.precioOrigen, resolverMoneda(m.monedaOrigen, monedas)),
          `$ ${formatNumber(m.precioCLP, 2)}`,
          formatNumber(m.cantidadTotal, familia === 'VIDRIOS' ? 2 : 0),
          familia === 'VIDRIOS' ? 'M²' : m.familiaCruda === 'JUNTAS' ? 'M' : m.unidadMedida,
          `$ ${formatNumber(m.precioCLP * m.cantidadTotal * factorFamilia, 0)}`,
          m.excluido ? 'Excluido' : 'Incluido',
        ]),
        didParseCell: (data) => {
          const fila = materiales[data.row.index];
          if (fila?.excluido && data.section === 'body') {
            data.cell.styles.textColor = [148, 163, 184];
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Subtotal ${familia}: $ ${formatNumber(totalFamilia, 0)}`, margen, y);
      y += 18;
    });

    if (y > 520) {
      doc.addPage();
      y = margen;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL MATERIALES: $ ${formatNumber(costoTotalCLP, 0)}  (${formatUF(costoTotalUF)} UF)`, margen, y);

    doc.save(`analitica-materiales-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. SECCIÓN: EDITOR DE DIVISAS DE LA OBRA */}
      <div className="space-y-2">
        <DivisasForm
          dolar={dolar}
          setDolar={setDolar}
          uf={uf}
          setUf={setUf}
          euro={euro}
          setEuro={setEuro}
        />
        <div className="flex items-center justify-between px-2">
          {saveSuccess ? (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Tipos de cambio guardados en la versión
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">
              Ajusta las tasas para recalcular el costo en pesos chilenos y cotizar en UF.
            </span>
          )}

          <button
            onClick={onSaveDivisas}
            disabled={isSavingDivisas}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSavingDivisas ? 'Guardando...' : 'Guardar Divisas'}</span>
          </button>
        </div>
      </div>

      {/* 2. BANNER GLOBAL DE APROBACIÓN DE LA ANALÍTICA */}
      {versionId && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              {congelado ? <Lock className="w-4 h-4 text-slate-500" /> : <Boxes className="w-4 h-4 text-slate-400" />}
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Aprobación de la Analítica de Materiales
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              {gruposPorFamilia.length - familiasPendientes.length} de {gruposPorFamilia.length} familias aprobadas
            </span>
          </div>

          {estadoActual === 'EN_COTIZACION' ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => aprobarTodoMutation.mutate()}
                disabled={gruposPorFamilia.length === 0 || aprobarTodoMutation.isPending}
                className="px-3.5 py-2 rounded-xl bg-[#E34A26] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#c93f1f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  todasLasFamiliasAprobadas
                    ? 'Todas las familias ya están aprobadas -- este click solo congela el presupuesto'
                    : 'Aprueba todas las categorías que falten y congela el presupuesto, en un solo paso'
                }
              >
                {aprobarTodoMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                {todasLasFamiliasAprobadas ? 'Congelar Presupuesto' : 'Aprobar Analítica Completa'}
              </button>
              {!todasLasFamiliasAprobadas && (
                <span className="text-[11px] text-slate-500">
                  Pendientes: {familiasPendientes.map(([familia]) => familia).join(', ')} (se aprueban solas al usar el botón)
                </span>
              )}
              {todasLasFamiliasAprobadas && (
                <span className="text-[11px] text-slate-500">
                  Todas las familias ya están aprobadas -- falta este último paso para congelar el presupuesto
                </span>
              )}
            </div>
          ) : puedeDeshacerAca ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-300">
                Esperando Aprobación Comercial -- presupuesto congelado
              </span>
              <button
                onClick={() => estadoAprobacionMutation.mutate('EN_COTIZACION')}
                disabled={estadoAprobacionMutation.isPending}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {estadoAprobacionMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Deshacer Aprobación (vuelve a habilitar edición)
              </button>
            </div>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-300 inline-block">
              Analítica aprobada -- presupuesto avanzado, deshacer desde el Paso 5
            </span>
          )}
        </div>
      )}

      {/* 3. SECCIÓN: ANALÍTICA Y DESGLOSE DE MATERIALES */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Analítica de Materiales y Costo Origen
              </h3>
              <p className="text-xs text-slate-500">
                {materialesConsolidados.length} materiales consolidados en fábrica
                {cantidadExcluidos > 0 && ` · ${cantidadExcluidos} excluidos`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={exportarPDF}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              title="Exportar materiales a PDF"
            >
              <FileDown className="w-4 h-4 text-[#E34A26]" />
              <span>Exportar PDF</span>
            </button>

            <button
              onClick={() => alert('Generando planilla de materiales en XLSX (Excel)...')}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              title="Exportar materiales a Excel XLSX"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar XLSX</span>
            </button>
          </div>
        </div>

        {/* Resumen de Costos de Materiales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
              Insumos Visibles / Activos
            </span>
            <strong className="text-lg font-mono text-slate-900 font-bold">
              {filteredMateriales.filter((m) => !m.excluido).length} artículos
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
              Costo Materiales (CLP)
            </span>
            <strong className="text-lg font-mono text-slate-900 font-bold whitespace-nowrap">
              $ {formatNumber(costoTotalCLP, 0)}
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
              Costo Materiales (UF)
            </span>
            <strong className="text-lg font-mono text-emerald-600 font-bold whitespace-nowrap">
              {formatUF(costoTotalUF)} UF
            </strong>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar SKU o descripción..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#E34A26] focus:bg-white"
          />
        </div>

        {/* Grupos por Familia */}
        <div className="space-y-3">
          {gruposPorFamilia.map(([familia, materiales]) => {
            const aprobacion = aprobacionesPorFamilia.get(familia);
            const aprobada = Boolean(aprobacion?.aprobada);
            // Edicion bloqueada si la familia ya esta aprobada, o si toda la
            // version esta congelada (aprobacion global mas adelante en el
            // flujo, o presupuesto ya emitido).
            const edicionBloqueada = aprobada || congelado;
            const colapsada = familiaColapsada[familia] ?? false;
            const descuentoActual = Number(aprobacion?.descuentoPct) || 0;
            const recargoActual = Number(aprobacion?.recargoPct) || 0;
            const factorFamilia = (1 - descuentoActual / 100) * (1 + recargoActual / 100);
            const totalFamiliaBruto = materiales.filter((m) => !m.excluido).reduce((acc, m) => acc + m.precioCLP * m.cantidadTotal, 0);
            const totalFamiliaCLP = totalFamiliaBruto * factorFamilia;
            // Vidrios se cotiza y muestra por m2, pero Material.unidadMedida
            // suele venir "UN" desde HETMO -- la cantidad ya esta bien en m2,
            // solo el rotulo de unidad estaba mal.
            const unidadDisplay = familia === 'VIDRIOS' ? 'M²' : undefined;

            return (
              <div key={familia} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <button
                    onClick={() => setFamiliaColapsada((prev) => ({ ...prev, [familia]: !colapsada }))}
                    className="flex items-center gap-2 min-w-0 text-left"
                  >
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${colapsada ? '-rotate-90' : ''}`}
                    />
                    <span className="font-bold text-sm text-slate-900 whitespace-nowrap">{familia}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                      {materiales.length} ítems · $ {formatNumber(totalFamiliaCLP, 0)}
                      {descuentoActual > 0 && ` (-${descuentoActual}%)`}
                      {recargoActual > 0 && ` (+${recargoActual}%)`}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1" title="Descuento comercial de la categoría (aplicado al total, no a los precios individuales)">
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">Desc.</span>
                      <PrecioEditable
                        valor={descuentoActual}
                        disabled={edicionBloqueada}
                        onGuardar={(nuevo) =>
                          familiaDescuentoMutation.mutate({ familia, descuentoPct: Math.min(100, Math.max(0, nuevo)) })
                        }
                      />
                      <span className="text-[10px] text-slate-500">%</span>
                    </div>
                    <div className="flex items-center gap-1" title="Recargo comercial de la categoría (aplicado al total, no a los precios individuales)">
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">Rec.</span>
                      <PrecioEditable
                        valor={recargoActual}
                        disabled={edicionBloqueada}
                        onGuardar={(nuevo) =>
                          familiaRecargoMutation.mutate({ familia, recargoPct: Math.min(100, Math.max(0, nuevo)) })
                        }
                      />
                      <span className="text-[10px] text-slate-500">%</span>
                    </div>
                    {aprobada && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-semibold flex items-center gap-1 whitespace-nowrap">
                        <ShieldCheck className="w-3 h-3" /> Aprobada
                      </span>
                    )}
                    {estadoActual === 'EN_COTIZACION' && (
                      <button
                        onClick={() => familiaAprobacionMutation.mutate({ familia, aprobada: !aprobada })}
                        disabled={familiaAprobacionMutation.isPending}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 whitespace-nowrap ${
                          aprobada
                            ? 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {aprobada ? 'Deshacer' : 'Aprobar categoría'}
                      </button>
                    )}
                  </div>
                </div>

                {!colapsada && (
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-[11px] uppercase tracking-wider sticky top-0 text-slate-600">
                        <tr>
                          <th className="px-3.5 py-2.5 font-semibold">SKU</th>
                          <th className="px-3.5 py-2.5 font-semibold">Descripción del Material</th>
                          <th className="px-3.5 py-2.5 font-semibold">Proveedor</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Precio Unitario Origen</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Precio Unitario CLP</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Cantidad</th>
                          <th className="px-3.5 py-2.5 font-semibold text-center">Unidad</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Total CLP</th>
                          <th className="px-3.5 py-2.5 font-semibold text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {materiales.map((m) => (
                          <tr
                            key={m.id}
                            className={`hover:bg-slate-50 transition-colors ${m.excluido ? 'opacity-40 bg-slate-50' : ''}`}
                          >
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-900">{m.skuInterno}</td>
                            <td className="px-3.5 py-2 font-medium text-slate-800">{m.descripcion}</td>
                            <td className="px-3.5 py-2 text-slate-500">{m.proveedorNombre}</td>
                            <td className="px-3.5 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {resolverMoneda(m.monedaOrigen, monedas).simbolo}
                                </span>
                                <PrecioEditable
                                  valor={m.precioOrigen}
                                  disabled={edicionBloqueada}
                                  onGuardar={(nuevo) => guardarAjuste(m, { precioOrigen: nuevo, monedaOrigen: m.monedaOrigen })}
                                />
                              </div>
                            </td>
                            <td className="px-3.5 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 font-mono text-[10px]">$</span>
                                <PrecioEditable
                                  valor={m.precioCLP}
                                  disabled={edicionBloqueada}
                                  onGuardar={(nuevo) => guardarAjuste(m, { precioOrigen: nuevo, monedaOrigen: 'CLP' })}
                                />
                              </div>
                            </td>
                            <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatNumber(m.cantidadTotal, familia === 'VIDRIOS' ? 2 : 0)}
                            </td>
                            <td className="px-3.5 py-2 text-center text-slate-500 font-mono">
                              {unidadDisplay ?? (m.familiaCruda === 'JUNTAS' ? 'M' : m.unidadMedida)}
                            </td>
                            <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              $ {formatNumber(m.precioCLP * m.cantidadTotal * factorFamilia, 0)}
                            </td>
                            <td className="px-3.5 py-2 text-center">
                              <button
                                onClick={() => guardarAjuste(m, { excluido: !m.excluido })}
                                disabled={edicionBloqueada || ajusteMutation.isPending}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                  m.excluido
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                                }`}
                                title={
                                  edicionBloqueada
                                    ? 'Categoría aprobada o presupuesto congelado -- no se puede modificar'
                                    : m.excluido
                                    ? 'Click para incluir'
                                    : 'Click para excluir'
                                }
                              >
                                {m.excluido ? 'Excluido' : 'Incluido'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {gruposPorFamilia.length === 0 && (
            <p className="text-center text-xs text-slate-500 py-8">
              No hay materiales que coincidan con la búsqueda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
