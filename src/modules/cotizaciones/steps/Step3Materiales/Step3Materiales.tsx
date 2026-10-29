import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, Search, FileSpreadsheet, FileDown, CheckCircle2, Check, ShieldCheck, ArrowRightLeft } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { TABLE_WRAPPER_CLASS } from '../../../../lib/designSystem';
import { formatNumber } from '../../../../lib/utils';
import { useMonedas, resolverMoneda, formatMonto } from '../../../../lib/monedas';
import {
  reemplazarMaterialEnVersion,
  saveMaterialAjuste,
  setPartidaAprobacion,
  setPartidaDescuento,
  setPartidaHolgura,
  updateEstadoAprobacion,
} from '../../../../api/client';
import type { MaterialAnalitica, PartidaAnalitica, Proyecto, ProyectoVersion } from '../../../../types';
import { DivisasForm, DivisasResumen } from '../Step1DatosCliente/DivisasForm';
import { ReemplazarMaterialModal } from './ReemplazarMaterialModal';
import { useAnalitica, decimalesCantidad } from '../../lib/useAnalitica';
import { MTW_NAVY, MTW_GRIS, MTW_BORDE, MTW_HEAD_BG, pdfTableStyle, drawPdfHeader } from '../../lib/pdfTheme';
import { usePermisos } from '../../../../lib/permisos';
import { useParametrosGenerales } from '../../../../lib/parametrosGenerales';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../../components/ui/Tabla';
import { NumeroInput } from '../../../../components/ui/Campos';
import { BadgeBoton } from '../../../../components/ui/BadgeBoton';
import { IconButton } from '../../../../components/ui/IconButton';
import { Input } from '../../../../components/ui/Input';
import { BotonColapsar } from '../../../../components/ui/BotonColapsar';

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
  // Recibe el callback que cierra la edición: solo se llama si el guardado tuvo éxito.
  onSaveDivisas: (onGuardado: () => void) => void;
  isSavingDivisas: boolean;
  // Version de un adicional: las divisas las fija el adicional y no hay
  // aprobacion tecnica por partida (el adicional tiene su propio flujo).
  modoAdicional?: boolean;
}

// BORRADOR es el valor historico de la columna antes del flujo de estado
// comercial; se trata igual que EN_COTIZACION (ver relay-api).
const normalizarEstado = (estado: string) => (estado === 'BORRADOR' ? 'EN_COTIZACION' : estado);

// UF se muestra con hasta 2 decimales (sin forzar ceros de relleno) -- CLP
// siempre redondeado a entero, formatNumber(x, 0) ya lo hace bien.
const formatUF = (valor: number) =>
  new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(valor);

// El backend responde { error } en los 4xx; si no, usa el mensaje del propio error.
const mensajeDeError = (err: unknown, fallback: string) => {
  const del = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return del || (err instanceof Error ? err.message : fallback);
};

// Input numerico inline: mantiene texto local mientras se edita y solo
// dispara el guardado al perder foco o con Enter -- si guardara en cada
// tecla, cada digito escrito seria un PATCH distinto contra la API.
const PrecioEditable: React.FC<{
  valor: number;
  disabled: boolean;
  onGuardar: (valor: number) => void;
}> = ({ valor, disabled, onGuardar }) => (
  <NumeroInput valor={valor} disabled={disabled} onGuardar={(v) => v !== null && onGuardar(v)} aria-label="Valor" className="w-24 font-semibold" />
);

// Botón de estado Incluido / Excluido (cada material se puede excluir del total).
const EstadoMaterial: React.FC<{ excluido: boolean; disabled: boolean; onClick: () => void; title: string }> = ({
  excluido,
  disabled,
  onClick,
  title,
}) => (
  <BadgeBoton variant={excluido ? 'warning' : 'success'} onClick={onClick} disabled={disabled} title={title}>
    {excluido ? 'Excluido' : 'Incluido'}
  </BadgeBoton>
);

// Reemplazo de este material en todas las líneas de la versión (ver
// ReemplazarMaterialModal). Solo se muestra si el material está en alguna línea.
const BotonReemplazar: React.FC<{ disabled: boolean; onClick: () => void }> = ({ disabled, onClick }) => (
  <IconButton
    icono={ArrowRightLeft}
    tono="marca"
    onClick={onClick}
    disabled={disabled}
    etiqueta={disabled ? 'Partida aprobada o presupuesto congelado -- no se puede modificar' : 'Reemplazar este material en todas las líneas'}
    className="border border-slate-200 bg-white"
  />
);

// Dato con etiqueta encima (mismo patrón que la tarjeta de línea).
const Campo: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</div>
    <div className="text-xs text-slate-800">{children}</div>
  </div>
);

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
  modoAdicional = false,
}) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [partidaColapsada, setPartidaColapsada] = useState<Record<string, boolean>>({});

  const monedas = useMonedas();
  // Sin tasa en pantalla: las de respaldo de Configuración > Comercial.
  const parametros = useParametrosGenerales();
  const tasaDolar = Number(dolar) || parametros?.tasasRespaldo.dolar || 0;
  const tasaUf = Number(uf) || parametros?.tasasRespaldo.uf || 0;
  const tasaEuro = Number(euro) || parametros?.tasasRespaldo.euro || 0;

  const versionId = activeVersion?.id;
  const estadoActual = activeVersion ? normalizarEstado(activeVersion.estadoAprobacion) : 'EN_COTIZACION';
  // El read-only de la Analitica sigue el estado comercial (estadoAprobacion),
  // no esCongelado -- ese flag ahora se activa apenas se asigna un cliente
  // (Paso 1) y solo bloquea el resync con HETMO, la cotizacion se sigue
  // editando con normalidad hasta que efectivamente se congela el
  // presupuesto para aprobacion comercial.
  const congelado = estadoActual !== 'EN_COTIZACION';
  // Las divisas arrancan colapsadas si ya tienen valores; si falta alguna, abiertas.
  const [editandoDivisas, setEditandoDivisas] = useState(() => !(dolar && uf && euro));
  const divisasEditables = !congelado && editandoDivisas;
  // El "deshacer" global solo es valido desde ESPERANDO_APROBACION_COMERCIAL
  // (ver TRANSICIONES_PERMITIDAS en el relay-api) -- en APROBADO_GERENCIA o
  // ACEPTADO_CLIENTE el retroceso se maneja desde el Paso 5, no desde aca.
  const puedeDeshacerAca = estadoActual === 'ESPERANDO_APROBACION_COMERCIAL';

  // Sólo invalida el detalle de este proyecto (y con él la Analítica, que
  // cuelga de la misma key): nada de lo que se edita acá
  // (ajustes de material, aprobación/descuento/holgura por partida) se
  // muestra en el listado de proyectos (['proyectos'], CotizacionesPage.tsx
  // -- ahí sólo aparecen codigoInterno, los datos crudos de cliente y el
  // estadoGlosa de HETMO), así que invalidarlo en cada ajuste sólo generaba
  // un refetch de red de hasta 100 proyectos que nadie estaba mirando.
  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
  };

  // Ajustes por material: exclusion y precio personalizado. Se guardan
  // directo contra la API al tocarlos -- nada de estado "flotante" que se
  // pierda al recargar. La API actualiza solo los campos que recibe.
  const ajusteMutation = useMutation({
    mutationFn: (payload: { materialId: string; excluido?: boolean; precioPersonalizado?: number; precioCLP?: number; tasas?: { dolar: number; euro: number; uf: number } }) => {
      if (!versionId) return Promise.resolve(null);
      return saveMaterialAjuste(versionId, payload);
    },
    onSuccess: invalidar,
  });

  // La moneda de origen del material nunca cambia por editar un precio:
  // - precioOrigen va por unidad de precio (ej. metro) en esa moneda; la tabla
  //   muestra el precio por unidad de compra (ej. barra) y divide por factorPrecio.
  // - precioCLP va tal como se ve en la columna CLP (por unidad de compra) y la
  //   API lo convierte a la moneda de origen con las tasas en pantalla.
  const guardarAjuste = (m: MaterialAnalitica, cambios: { excluido?: boolean; precioOrigen?: number; precioCLP?: number }) => {
    ajusteMutation.mutate({
      materialId: m.materialId,
      excluido: cambios.excluido,
      precioPersonalizado: cambios.precioOrigen,
      precioCLP: cambios.precioCLP,
      tasas: cambios.precioCLP !== undefined ? { dolar: tasaDolar, euro: tasaEuro, uf: tasaUf } : undefined,
    });
  };

  const partidaAprobacionMutation = useMutation({
    mutationFn: (payload: { partida: string; aprobada: boolean }) => {
      if (!versionId) return Promise.resolve(null);
      return setPartidaAprobacion(versionId, payload.partida, payload.aprobada);
    },
    onSuccess: invalidar,
  });

  const partidaDescuentoMutation = useMutation({
    mutationFn: (payload: { partida: string; descuentoPct: number }) => {
      if (!versionId) return Promise.resolve(null);
      return setPartidaDescuento(versionId, payload.partida, payload.descuentoPct);
    },
    onSuccess: invalidar,
  });

  const partidaHolguraMutation = useMutation({
    mutationFn: (payload: { partida: string; holguraPct: number }) => {
      if (!versionId) return Promise.resolve(null);
      return setPartidaHolgura(versionId, payload.partida, payload.holguraPct);
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
  // (o abre) todas las categorias de una sola vez. NO congela el
  // presupuesto -- eso se dispara desde la Hoja de Fijacion (Paso 4), una
  // vez que esa tambien esta guardada (el backend rechaza el congelamiento
  // si falta). Antes se congelaba aca mismo, dejando el Paso 4 en solo
  // lectura antes de poder completarlo.
  // La aprobacion tecnica la exige la API; aca solo se ocultan los botones.
  const { tiene } = usePermisos();
  const puedeAprobarTecnico = tiene('presupuestos.aprobar_tecnico');

  const aprobarTodoMutation = useMutation({
    mutationFn: async () => {
      if (!versionId) return null;
      const pendientes = partidasMateriales.filter((p) => !p.aprobada);
      await Promise.all(pendientes.map((p) => setPartidaAprobacion(versionId, p.codigo, true)));
      return null;
    },
    onSuccess: invalidar,
  });

  // Reemplazo de un material en todas las líneas de la versión (ver
  // ReemplazarMaterialModal). Al terminar, refresca el detalle como cualquier
  // otro ajuste de esta pantalla.
  const [reemplazoOrigen, setReemplazoOrigen] = useState<MaterialAnalitica | null>(null);
  const reemplazoMutation = useMutation({
    mutationFn: (payload: { materialIdOriginal: string; materialIdNuevo: string }) => {
      if (!versionId) return Promise.reject(new Error('No hay una versión activa.'));
      return reemplazarMaterialEnVersion(versionId, payload);
    },
    onSuccess: () => {
      invalidar();
      setReemplazoOrigen(null);
    },
  });

  // Analítica calculada en mtw-api (motor único) con las tasas que se ven en
  // pantalla: al editar una divisa se recalcula sin guardarla.
  const { data: analitica, isLoading: cargandoAnalitica } = useAnalitica(proyecto.id, versionId, {
    dolar: tasaDolar,
    euro: tasaEuro,
    uf: tasaUf,
  });
  const materiales = useMemo(() => analitica?.materiales ?? [], [analitica]);
  const partidas = useMemo(() => analitica?.partidas ?? [], [analitica]);

  // Líneas de la versión que contienen cada material (HETMO o agregado a mano).
  // Solo cuenta lo visible: un HETMO ya reemplazado no aparece en la línea.
  const lineasPorMaterial = useMemo(() => {
    const map = new Map<string, number>();
    (activeVersion?.ventanas || []).forEach((v) => {
      new Set((v.materiales || []).map((mv) => mv.materialId)).forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [activeVersion]);

  // Filtrado por buscador (solo filas: los totales son siempre los de toda la versión).
  const filteredMateriales = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return materiales;
    return materiales.filter((m) => {
      const matchSku = m.skuInterno.toLowerCase().includes(term);
      const matchDesc = m.descripcion.toLowerCase().includes(term);
      const matchProv = m.proveedorNombre.toLowerCase().includes(term);
      return matchSku || matchDesc || matchProv;
    });
  }, [materiales, searchTerm]);

  // Agrupado por partida, en el orden configurado en Configuración > Catálogo.
  // Cada partida tiene aprobación, descuento y holgura propios. Solo las
  // partidas con materiales: las que reciben solo costos de la Hoja de
  // Fijación se ven en el Paso 4.
  const gruposPorPartida = useMemo(() => {
    const porCodigo = new Map<string, MaterialAnalitica[]>();
    filteredMateriales.forEach((m) => {
      const list = porCodigo.get(m.partida.codigo) || [];
      list.push(m);
      porCodigo.set(m.partida.codigo, list);
    });
    return partidas
      .filter((p) => porCodigo.has(p.codigo))
      .map((p) => [p, porCodigo.get(p.codigo)!] as [PartidaAnalitica, MaterialAnalitica[]]);
  }, [filteredMateriales, partidas]);

  const partidasMateriales = partidas.filter((p) => p.tieneMateriales);
  const todasLasPartidasAprobadas = partidasMateriales.length > 0 && partidasMateriales.every((p) => p.aprobada);

  // Presupuesto de materiales: precios con descuento, mas la holgura de cada
  // partida (que no toca ningun precio) -- lo calcula mtw-api.
  const costoTotalCLP = analitica?.totales.materialesTotal ?? 0;
  const costoTotalUF = tasaUf > 0 ? costoTotalCLP / tasaUf : 0;
  const cantidadExcluidos = materiales.filter((m) => m.excluido).length;

  const exportarPDF = async () => {
    // jsPDF + autotable pesan ~430KB: se cargan recién al exportar, no con
    // el resto del Paso 3 (que ya es su propio chunk lazy, ver
    // CotizadorWorkspace.tsx), para no traerlos solo por abrir la pantalla.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margen = 32;
    const pageBottom = 555;

    const encabezado = [
      proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`,
      activeVersion ? `HETMO v${activeVersion.versionNumero}` : '',
    ].filter(Boolean).join(' | ');
    await drawPdfHeader(doc, 'Analítica de Materiales', encabezado, pageWidth);

    let y = 78;
    doc.setDrawColor(...MTW_BORDE);
    doc.setLineWidth(0.75);
    doc.line(margen, y, pageWidth - margen, y);
    y += 20;

    doc.setTextColor(...MTW_NAVY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(proyecto.obra, margen, y);
    y += 22;

    gruposPorPartida.forEach(([partida, materiales]) => {
      const familia = partida.nombre;
      const descuento = partida.descuentoPct ?? 0;
      const holgura = partida.holguraPct ?? 0;
      const totalFamilia = partida.materiales + partida.holgura;

      if (y > pageBottom - 40) {
        doc.addPage();
        y = margen;
      }

      // Banda de encabezado de familia -- nombre + cantidad de referencias a
      // la izquierda, subtotal a la derecha, mismo estilo que las cabeceras
      // de sección de la hoja de fijación anterior.
      const ajustes = [descuento > 0 ? `descuento ${descuento}%` : null, holgura > 0 ? `holgura ${holgura}% ($ ${formatNumber(partida.holgura, 0)})` : null]
        .filter(Boolean)
        .join(', ');
      doc.setFillColor(...MTW_HEAD_BG);
      doc.rect(margen, y, pageWidth - margen * 2, 22, 'F');
      doc.setTextColor(...MTW_NAVY);
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.text(familia, margen + 8, y + 15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MTW_GRIS);
      doc.text(`${materiales.length} referencias${ajustes ? `  ·  ${ajustes}` : ''}`, margen + 8 + doc.getTextWidth(familia) + 10, y + 15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MTW_NAVY);
      doc.text(`Subtotal: $ ${formatNumber(totalFamilia, 0)}`, pageWidth - margen - 8, y + 15, { align: 'right' });
      y += 22;

      autoTable(doc, {
        ...pdfTableStyle,
        startY: y,
        margin: { left: margen, right: margen },
        head: [['SKU', 'Descripción', 'Proveedor', 'Precio Unit. Origen', 'Precio Unit. CLP', 'Cantidad', 'Unidad', 'Total CLP', 'Estado']],
        body: materiales.map((m) => [
          m.skuInterno,
          m.descripcion,
          m.proveedorNombre,
          formatMonto(m.precioOrigen, resolverMoneda(m.monedaOrigen, monedas)),
          `$ ${formatNumber(m.precioCLP, 2)}`,
          formatNumber(m.cantidadTotal, decimalesCantidad(m.cantidadTotal)),
          m.unidad.simbolo,
          `$ ${formatNumber(m.precioCompraNeto * m.cantidadTotal, 0)}`,
          m.excluido ? 'Excluido' : 'Incluido',
        ]),
        didParseCell: (data: any) => {
          const fila = materiales[data.row.index];
          if (fila?.excluido && data.section === 'body') {
            data.cell.styles.textColor = [148, 163, 184];
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 22;
    });

    if (y > pageBottom - 60) {
      doc.addPage();
      y = margen;
    }
    doc.setFillColor(...MTW_NAVY);
    doc.roundedRect(margen, y, pageWidth - margen * 2, 44, 6, 6, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('TOTAL MATERIALES', margen + 14, y + 18);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`$ ${formatNumber(costoTotalCLP, 0)}  ·  ${formatUF(costoTotalUF)} UF`, margen + 14, y + 34);

    doc.save(`analitica-materiales-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`);
  };

  // CSV, no XLSX: los paquetes que generan .xlsx real en el navegador (xlsx
  // de SheetJS, exceljs) traen vulnerabilidades conocidas sin parche en npm
  // (alta severidad en xlsx, moderada via su dependencia uuid en exceljs) --
  // no vale la pena esa superficie de ataque para una exportación. Un CSV
  // con BOM UTF-8 abre perfecto en Excel (columnas, tildes, ñ, todo bien) y
  // no depende de ningún paquete nuevo.
  const exportarCSV = () => {
    const escaparCelda = (valor: string | number) => {
      const texto = String(valor);
      return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };
    const encabezados = [
      'Partida', 'SKU', 'Descripción', 'Proveedor', 'Precio Unit. Origen', 'Moneda Origen',
      'Precio Unit. CLP', 'Cantidad', 'Unidad', 'Descuento %', 'Holgura %', 'Total CLP (neto)', 'Estado',
    ];
    const filas: (string | number)[][] = [encabezados];
    gruposPorPartida.forEach(([partida, materiales]) => {
      const descuento = partida.descuentoPct ?? 0;
      const holgura = partida.holguraPct ?? 0;
      materiales.forEach((m) => {
        filas.push([
          partida.nombre,
          m.skuInterno,
          m.descripcion,
          m.proveedorNombre,
          m.precioOrigen,
          resolverMoneda(m.monedaOrigen, monedas).nombre,
          m.precioCLP,
          m.cantidadTotal,
          m.unidad.simbolo,
          descuento,
          holgura,
          m.excluido ? 0 : m.precioCompraNeto * m.cantidadTotal,
          m.excluido ? 'Excluido' : 'Incluido',
        ]);
      });
    });
    gruposPorPartida.forEach(([partida]) => {
      if (partida.holgura > 0) filas.push([partida.nombre, '', `Holgura ${partida.holguraPct}%`, '', '', '', '', '', '', '', partida.holguraPct ?? 0, partida.holgura, '']);
    });
    filas.push(['TOTAL', '', '', '', '', '', '', '', '', '', '', costoTotalCLP, '']);

    const csv = filas.map((fila) => fila.map(escaparCelda).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analitica-materiales-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. PARÁMETROS ECONÓMICOS (en un adicional, las fija el adicional) */}
      {modoAdicional ? null : !divisasEditables ? (
        <DivisasResumen dolar={dolar} uf={uf} euro={euro} congelado={congelado} onEditar={() => setEditandoDivisas(true)} />
      ) : (
      <DivisasForm
        dolar={dolar}
        setDolar={setDolar}
        uf={uf}
        setUf={setUf}
        euro={euro}
        setEuro={setEuro}
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {saveSuccess ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4" /> Tipos de cambio guardados en la versión
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Ajusta las tasas para recalcular el costo en pesos chilenos y cotizar en UF.
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSaveDivisas(() => setEditandoDivisas(false))}
              disabled={isSavingDivisas}
              isLoading={isSavingDivisas}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="sm:ml-auto"
            >
              {isSavingDivisas ? 'Guardando…' : 'Guardar divisas'}
            </Button>
          </div>
        }
      />
      )}

      {/* 3. ANALÍTICA Y DESGLOSE DE MATERIALES */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900">Analítica de materiales</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {cargandoAnalitica ? 'Calculando…' : `${materiales.length} materiales consolidados en fábrica`}
                {cantidadExcluidos > 0 && ` · ${cantidadExcluidos} excluidos`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
            {versionId && !modoAdicional && puedeAprobarTecnico && estadoActual === 'EN_COTIZACION' && !todasLasPartidasAprobadas && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => aprobarTodoMutation.mutate()}
                disabled={partidasMateriales.length === 0 || aprobarTodoMutation.isPending}
                isLoading={aprobarTodoMutation.isPending}
                leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                title="Aprueba todas las partidas que falten"
              >
                Aprobar analítica completa
              </Button>
            )}
            {versionId && !modoAdicional && puedeAprobarTecnico && puedeDeshacerAca && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => estadoAprobacionMutation.mutate('EN_COTIZACION')}
                disabled={estadoAprobacionMutation.isPending}
                isLoading={estadoAprobacionMutation.isPending}
                title="Vuelve a habilitar la edición del presupuesto"
              >
                Deshacer aprobación
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportarPDF} leftIcon={<FileDown className="w-3.5 h-3.5" />} title="Exportar materiales a PDF">
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportarCSV}
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              title="Exportar materiales a CSV (se abre directo en Excel)"
            >
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Resumen: una sola barra con los tres indicadores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl border border-slate-200 bg-slate-50/60 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="px-4 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Insumos visibles / activos</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums">
              {filteredMateriales.filter((m) => !m.excluido).length} <span className="text-xs font-semibold text-slate-500">artículos</span>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Costo materiales (CLP)</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums whitespace-nowrap">$ {formatNumber(costoTotalCLP, 0)}</div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Costo materiales (UF)</div>
            <div className="text-lg font-extrabold text-brand-600 mt-1 tabular-nums whitespace-nowrap">{formatUF(costoTotalUF)} UF</div>
          </div>
        </div>

        {/* Buscador */}
        <div>
          <Input type="search" aria-label="Buscar material" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar SKU o descripción…" leftIcon={<Search className="w-4 h-4" />} />
        </div>

        {/* Partidas */}
        <div className="space-y-3">
          {gruposPorPartida.map(([partida, materiales]) => {
            const codigo = partida.codigo;
            const aprobada = partida.aprobada;
            // Edicion bloqueada si la partida ya esta aprobada, o si toda la
            // version esta congelada (aprobacion global mas adelante en el
            // flujo, o presupuesto ya emitido).
            const edicionBloqueada = aprobada || congelado;
            // Las categorías parten colapsadas: el usuario las despliega si necesita el detalle.
            const colapsada = partidaColapsada[codigo] ?? true;
            const descuentoActual = partida.descuentoPct ?? 0;
            const holguraActual = partida.holguraPct ?? 0;
            const totalFamiliaCLP = partida.materiales + partida.holgura;

            return (
              <div key={codigo} className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                  <BotonColapsar abierto={!colapsada} onClick={() => setPartidaColapsada((prev) => ({ ...prev, [codigo]: !colapsada }))}>
                    <span className="font-bold text-sm text-slate-900">{partida.nombre}</span>
                    <Badge size="sm" variant="default">{materiales.length} {materiales.length === 1 ? 'ítem' : 'ítems'}</Badge>
                    <span className="text-xs text-slate-600 tabular-nums">
                      $ {formatNumber(totalFamiliaCLP, 0)}
                      {descuentoActual > 0 && ` (desc. ${descuentoActual}%)`}
                      {partida.holgura > 0 && ` · incluye holgura ${holguraActual}% ($ ${formatNumber(partida.holgura, 0)})`}
                    </span>
                  </BotonColapsar>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500" title="Descuento negociado con el proveedor: baja el precio de compra de los materiales de la partida (y el de la OC)">
                      Desc.
                      <PrecioEditable
                        valor={descuentoActual}
                        disabled={edicionBloqueada}
                        onGuardar={(nuevo) => partidaDescuentoMutation.mutate({ partida: codigo, descuentoPct: Math.min(100, Math.max(0, nuevo)) })}
                      />
                      %
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500" title="Holgura del presupuesto (ej. quiebre): se suma al presupuesto de la partida y se cobra, sin cambiar ningún precio ni la OC">
                      Holgura
                      <PrecioEditable
                        valor={holguraActual}
                        disabled={edicionBloqueada}
                        onGuardar={(nuevo) => partidaHolguraMutation.mutate({ partida: codigo, holguraPct: Math.min(100, Math.max(0, nuevo)) })}
                      />
                      %
                    </label>
                    {aprobada && (
                      <Badge size="sm" variant="success" className="gap-1">
                        <ShieldCheck className="w-3 h-3" /> Aprobada
                      </Badge>
                    )}
                    {!modoAdicional && puedeAprobarTecnico && estadoActual === 'EN_COTIZACION' && (
                      <Button
                        variant={aprobada ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => partidaAprobacionMutation.mutate({ partida: codigo, aprobada: !aprobada })}
                        disabled={partidaAprobacionMutation.isPending}
                      >
                        {aprobada ? 'Deshacer' : 'Aprobar partida'}
                      </Button>
                    )}
                  </div>
                </div>

                {!colapsada && (
                  // @container: la tabla exige ancho real; en tablet y móvil cada material va en tarjeta.
                  <div className="@container">
                    <div className={`hidden @4xl:block ${TABLE_WRAPPER_CLASS}`}>
                      <Tabla>
                        <Thead>
                          <Tr>
                            <Th className="font-semibold">SKU</Th>
                            <Th className="font-semibold">Material</Th>
                            <Th alinear="derecha" className="font-semibold">Precio origen</Th>
                            <Th alinear="derecha" className="font-semibold">Precio CLP</Th>
                            <Th alinear="derecha" className="font-semibold">Cantidad</Th>
                            <Th alinear="derecha" className="font-semibold">Total CLP</Th>
                            <Th alinear="centro" className="font-semibold">Estado</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {materiales.map((m) => (
                            <Tr
                              key={m.id}
                              title={m.precioModificado ? 'Precio modificado a mano -- distinto al original de HETMO' : undefined}
                              className={`transition-colors hover:bg-slate-50 ${m.excluido ? 'opacity-40' : m.reemplazado ? 'bg-violet-50/60' : m.precioModificado ? 'bg-sky-50/60' : ''}`}
                            >
                              <Td className="align-top font-semibold text-slate-900 whitespace-nowrap">{m.skuInterno}</Td>
                              <Td className="align-top min-w-0">
                                <div className="font-medium text-slate-800">{m.descripcion}</div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-slate-500">{m.proveedorNombre}</span>
                                  {m.precioModificado && <Badge size="sm" variant="info">Precio editado</Badge>}
                                  {m.reemplazado && <Badge size="sm" variant="violet">Reemplazado</Badge>}
                                </div>
                              </Td>
                              <Td alinear="derecha" className="align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-slate-400 text-[10px]">{resolverMoneda(m.monedaOrigen, monedas).simbolo}</span>
                                  <PrecioEditable
                                    valor={m.precioOrigen}
                                    disabled={edicionBloqueada}
                                    onGuardar={(nuevo) => guardarAjuste(m, { precioOrigen: nuevo / m.factorPrecio })}
                                  />
                                </div>
                              </Td>
                              <Td alinear="derecha" className="align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-slate-400 text-[10px]">$</span>
                                  <PrecioEditable
                                    valor={Math.round(m.precioCLP * 100) / 100}
                                    disabled={edicionBloqueada}
                                    onGuardar={(nuevo) => guardarAjuste(m, { precioCLP: nuevo })}
                                  />
                                </div>
                              </Td>
                              <Td numero className="align-top text-slate-800">
                                {formatNumber(m.cantidadTotal, decimalesCantidad(m.cantidadTotal))} <span className="text-slate-400">{m.unidad.simbolo}</span>
                              </Td>
                              <Td numero className="align-top font-bold text-slate-900">
                                $ {formatNumber(m.precioCompraNeto * m.cantidadTotal, 0)}
                              </Td>
                              <Td alinear="centro" className="align-top">
                                <div className="flex items-center justify-center gap-2">
                                  {lineasPorMaterial.get(m.materialId) ? (
                                    <BotonReemplazar
                                      disabled={edicionBloqueada}
                                      onClick={() => {
                                        reemplazoMutation.reset();
                                        setReemplazoOrigen(m);
                                      }}
                                    />
                                  ) : null}
                                  <EstadoMaterial
                                    excluido={m.excluido}
                                    disabled={edicionBloqueada || ajusteMutation.isPending}
                                    onClick={() => guardarAjuste(m, { excluido: !m.excluido })}
                                    title={
                                      edicionBloqueada
                                        ? 'Partida aprobada o presupuesto congelado -- no se puede modificar'
                                        : m.excluido
                                        ? 'Click para incluir'
                                        : 'Click para excluir'
                                    }
                                  />
                                </div>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Tabla>
                    </div>

                    <ul className="@4xl:hidden divide-y divide-slate-100">
                      {materiales.map((m) => (
                        <li
                          key={m.id}
                          className={`p-4 space-y-3 ${m.excluido ? 'opacity-50' : m.reemplazado ? 'bg-violet-50/60' : m.precioModificado ? 'bg-sky-50/60' : ''}`}
                          title={m.precioModificado ? 'Precio modificado a mano -- distinto al original de HETMO' : undefined}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-slate-500 tracking-wide">{m.skuInterno}</div>
                              <div className="text-sm font-semibold text-slate-900 leading-snug">{m.descripcion}</div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[11px] text-slate-500">{m.proveedorNombre}</span>
                                {m.precioModificado && <Badge size="sm" variant="info">Precio editado</Badge>}
                                {m.reemplazado && <Badge size="sm" variant="violet">Reemplazado</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {lineasPorMaterial.get(m.materialId) ? (
                                <BotonReemplazar
                                  disabled={edicionBloqueada}
                                  onClick={() => {
                                    reemplazoMutation.reset();
                                    setReemplazoOrigen(m);
                                  }}
                                />
                              ) : null}
                              <EstadoMaterial
                                excluido={m.excluido}
                                disabled={edicionBloqueada || ajusteMutation.isPending}
                                onClick={() => guardarAjuste(m, { excluido: !m.excluido })}
                                title={edicionBloqueada ? 'Partida aprobada o presupuesto congelado' : m.excluido ? 'Click para incluir' : 'Click para excluir'}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <Campo label="Precio origen">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 text-[10px]">{resolverMoneda(m.monedaOrigen, monedas).simbolo}</span>
                                <PrecioEditable
                                  valor={m.precioOrigen}
                                  disabled={edicionBloqueada}
                                  onGuardar={(nuevo) => guardarAjuste(m, { precioOrigen: nuevo / m.factorPrecio })}
                                />
                              </div>
                            </Campo>
                            <Campo label="Precio CLP">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 text-[10px]">$</span>
                                <PrecioEditable
                                  valor={Math.round(m.precioCLP * 100) / 100}
                                  disabled={edicionBloqueada}
                                  onGuardar={(nuevo) => guardarAjuste(m, { precioCLP: nuevo })}
                                />
                              </div>
                            </Campo>
                            <Campo label="Cantidad">
                              <span className="tabular-nums font-semibold">
                                {formatNumber(m.cantidadTotal, decimalesCantidad(m.cantidadTotal))}
                              </span>{' '}
                              <span className="text-slate-400">{m.unidad.simbolo}</span>
                            </Campo>
                            <Campo label="Total CLP">
                              <span className="tabular-nums font-bold">$ {formatNumber(m.precioCompraNeto * m.cantidadTotal, 0)}</span>
                            </Campo>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
          {gruposPorPartida.length === 0 && !cargandoAnalitica && (
            <p className="text-center text-sm text-slate-500 py-8">No hay materiales que coincidan con la búsqueda.</p>
          )}
        </div>
      </section>

      {reemplazoOrigen && (
        <ReemplazarMaterialModal
          original={reemplazoOrigen}
          lineasAfectadas={lineasPorMaterial.get(reemplazoOrigen.materialId) ?? 0}
          partidasAprobadas={partidas.filter((p) => p.aprobada).map((p) => p.codigo)}
          isPending={reemplazoMutation.isPending}
          error={reemplazoMutation.error ? mensajeDeError(reemplazoMutation.error, 'No se pudo reemplazar el material.') : null}
          onConfirm={(nuevo) => reemplazoMutation.mutate({ materialIdOriginal: reemplazoOrigen.materialId, materialIdNuevo: nuevo.id })}
          onClose={() => setReemplazoOrigen(null)}
        />
      )}
    </div>
  );
};
