import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Loader2, Pencil, Check } from 'lucide-react';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { formatNumber } from '../../../../lib/utils';
import {
  updatePresupuestoConfig,
  updateVentanaPresupuesto,
  renderPdf,
  getPlantillaDeProyecto,
  getPlantillasOferta,
  getConfiguracionEmpresa,
} from '../../../../api/client';
import { useParametrosGenerales } from '../../../../lib/parametrosGenerales';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { buildProtexDoorSvg } from '../../components/drawing/protexDoorSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';
import { useAnalitica } from '../../lib/useAnalitica';
import { loadImageDataUrl } from '../../lib/pdfTheme';
import { ufLabel, rasterizarDibujos, buildDocumentoHtml, buildHeaderFooterTemplates } from './presupuestoPdf';

interface PresupuestoOfertaProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  dolar: string;
  uf: string;
  euro: string;
}

// BORRADOR es el valor historico de la columna antes del flujo de estado
// comercial; se trata igual que EN_COTIZACION (ver relay-api).
const normalizarEstado = (estado: string) => (estado === 'BORRADOR' ? 'EN_COTIZACION' : estado);

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
        {!congelado && <Pencil className="w-3 h-3 text-slate-300 group-hover/edit:text-brand-600 shrink-0" />}
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
        className="text-sm font-black text-slate-900 border-b border-brand-600 outline-none bg-transparent min-w-0"
      />
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="shrink-0 w-5 h-5 rounded bg-brand-600 text-white flex items-center justify-center"
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
      <button type="button" onClick={() => setEditando(true)} className="text-[11px] text-slate-400 hover:text-brand-600">
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
          {!congelado && <Pencil className="w-3 h-3 text-slate-300 group-hover/edit:text-brand-600 shrink-0 mt-0.5" />}
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
        className="w-full text-xs border border-slate-200 rounded-lg p-1.5 outline-none focus:border-brand-600"
      />
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="px-2 py-1 rounded-md bg-brand-600 text-white text-[11px] font-bold flex items-center gap-1"
      >
        {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Guardar
      </button>
    </div>
  );
};

export const PresupuestoOferta: React.FC<PresupuestoOfertaProps> = ({ proyecto, activeVersion, dolar, uf, euro }) => {
  const queryClient = useQueryClient();
  const parametros = useParametrosGenerales();
  const tasaDolar = Number(dolar) || parametros?.tasasRespaldo.dolar || 0;
  const tasaUf = Number(uf) || parametros?.tasasRespaldo.uf || 0;
  const tasaEuro = Number(euro) || parametros?.tasasRespaldo.euro || 0;
  // Igual que en Step3Materiales/Step4Fijaciones: el read-only sigue el
  // estado comercial, no esCongelado -- ese flag ahora se activa al asignar
  // cliente (Paso 1) y solo bloquea el resync con HETMO.
  const estadoActual = activeVersion ? normalizarEstado(activeVersion.estadoAprobacion) : 'EN_COTIZACION';
  const congelado = estadoActual !== 'EN_COTIZACION';
  const versionId = activeVersion?.id;

  const [ventanasLocal, setVentanasLocal] = useState<Record<string, Partial<Ventana>>>({});
  const ventanas = useMemo(
    () => (activeVersion?.ventanas || []).map((v) => ({ ...v, ...ventanasLocal[v.id] })),
    [activeVersion?.ventanas, ventanasLocal]
  );

  // Venta y precio por línea los calcula mtw-api (el mismo prorrateo con que
  // se congelan al aceptar la cotización).
  const { data: analitica } = useAnalitica(proyecto.id, versionId, { dolar: tasaDolar, euro: tasaEuro, uf: tasaUf });
  const venta = analitica?.totales.venta ?? 0;
  const preciosVenta = useMemo(
    () => new Map((analitica?.preciosVenta ?? []).map(({ ventanaId, ...p }) => [ventanaId, p])),
    [analitica]
  );
  // Vidrios de cada linea: los materiales que se miden por area (segun su tipo de producto).
  const materialesPorArea = useMemo(
    () => new Set((analitica?.materiales ?? []).filter((m) => m.medicion === 'AREA').map((m) => m.materialId)),
    [analitica]
  );
  // IVA de Configuración > Comercial.
  const ivaPct = parametros?.ivaPct ?? 0;
  const iva = venta * (ivaPct / 100);
  const totalConIva = venta + iva;

  // Textos: los guardados en la version o, si no hay, los de la plantilla
  // por defecto de su tipo de proyecto (Configuración > Comercial).
  const config = activeVersion?.presupuestoConfig;
  const [texto, setTexto] = useState(config?.textoPresentacion ?? '');
  const [condiciones, setCondiciones] = useState(config?.condicionesComerciales ?? '');
  const [editandoTexto, setEditandoTexto] = useState(false);
  const [editandoCondiciones, setEditandoCondiciones] = useState(false);

  const { data: plantillaPorDefecto } = useQuery({
    queryKey: ['plantillaProyecto', proyecto.id, 'COTIZACION', proyecto.tipoProyectoId],
    queryFn: () => getPlantillaDeProyecto(proyecto.id, 'COTIZACION'),
  });
  const { data: plantillas = [] } = useQuery({ queryKey: ['plantillasOferta', 'COTIZACION'], queryFn: () => getPlantillasOferta('COTIZACION') });
  const plantillasDisponibles = plantillas.filter((p) => p.activa && (!p.tipoProyectoId || p.tipoProyectoId === proyecto.tipoProyectoId));
  useEffect(() => {
    if (!plantillaPorDefecto) return;
    if (!config?.textoPresentacion) setTexto((t) => t || plantillaPorDefecto.textoPresentacion);
    if (!config?.condicionesComerciales) setCondiciones((c) => c || plantillaPorDefecto.condicionesComerciales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaPorDefecto?.id]);

  // Elegir otra plantilla copia sus textos a esta version (se pueden seguir editando).
  const plantillaMutation = useMutation({
    mutationFn: (plantillaOfertaId: string) => updatePresupuestoConfig(versionId!, { plantillaOfertaId }),
    onSuccess: (res) => {
      setTexto(res.presupuestoConfig.textoPresentacion ?? '');
      setCondiciones(res.presupuestoConfig.condicionesComerciales ?? '');
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });
  const plantillaActual = config?.plantillaOfertaId ?? plantillaPorDefecto?.id ?? '';

  // Redes sociales del pie del PDF (Configuración > Presupuesto).
  const { data: configuracionEmpresaData } = useQuery({ queryKey: ['configuracionEmpresa'], queryFn: () => getConfiguracionEmpresa() });
  const configuracionEmpresa = configuracionEmpresaData?.configuracionEmpresa;

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

      // El armado del documento (tarjetas, encabezado, paginado) vive en
      // presupuestoPdf.ts -- sin imports de React, se puede invocar igual
      // desde un script standalone para generar y revisar el PDF antes de
      // pushear un cambio. Duplicar esta lógica en un script de prueba
      // aparte fue justamente lo que dejó pasar varios bugs de paginación
      // sin detectar a tiempo.
      const pngPorVentana = await rasterizarDibujos(ventanas);
      const documentoHtml = buildDocumentoHtml({
        proyecto, ventanas, texto, condiciones, venta, iva, totalConIva, ivaPct, tasaUf,
        logoDataUrl, logoMuchtekDataUrl, preciosVenta, pngPorVentana,
      });
      const { headerTemplate, footerTemplate } = buildHeaderFooterTemplates({
        proyecto,
        logoDataUrl,
        footerWebUrl: configuracionEmpresa?.footerWebUrl,
        footerWebLabel: configuracionEmpresa?.footerWebLabel,
        footerInstagramUrl: configuracionEmpresa?.footerInstagramUrl,
        footerInstagramHandle: configuracionEmpresa?.footerInstagramHandle,
      });

      const filename = `presupuesto-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`;
      const blob = await renderPdf(documentoHtml, filename, { headerTemplate, footerTemplate });
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
          className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Exportar PDF
        </button>
      </div>

      {plantillasDisponibles.length > 1 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label htmlFor="plantilla-oferta" className="text-xs font-bold uppercase tracking-wider text-slate-800 shrink-0">
            Plantilla de textos
          </label>
          <select
            id="plantilla-oferta"
            value={plantillaActual}
            disabled={congelado || plantillaMutation.isPending}
            onChange={(e) => {
              if (window.confirm('¿Reemplazar el texto de presentación y las condiciones por los de esta plantilla?')) plantillaMutation.mutate(e.target.value);
            }}
            className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-brand-600"
          >
            {plantillasDisponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.tipoProyecto ? ` (${p.tipoProyecto.nombre})` : ' (general)'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Texto de presentación</h4>
          {!congelado && !editandoTexto && (
            <button type="button" onClick={() => setEditandoTexto(true)} className="text-[11px] text-slate-400 hover:text-brand-600 flex items-center gap-1">
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
              className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-brand-600"
            />
            <button
              type="button"
              onClick={() => guardarTextoMutation.mutate()}
              disabled={guardarTextoMutation.isPending}
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5"
            >
              {guardarTextoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-600 whitespace-pre-line">{texto}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ventanas.map((v) => {
          const precio = preciosVenta.get(v.id);
          const line = toWindowLine(v);
          const isFrameless = Boolean(line?.dibujoSinMarco);
          // Una puerta Protex no pasa por el motor de aperturas de HETMO
          // (ver mismo caso en VentanaCard.tsx) -- "Ventana fija" seria
          // enganoso, es una puerta abatible con herrajes.
          const apertura = v.tipoLineaManual === 'PROTEX' ? 'Puerta Protex' : line ? core.apertureLabel(line) : '—';
          const finish = createFinish(line?.acabadoCodigo, line?.acabadoDescripcion, line?.acabadoPatron);
          const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
          const vidrio = Array.from(
            new Set((v.materiales || []).filter((m) => !m.excluido && materialesPorArea.has(m.materialId)).map((m) => m.material?.descripcion || ''))
          ).filter(Boolean).join(' + ');

          return (
            <article key={v.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Encabezado: nombre editable, unidades y total neto */}
              <header className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <NombreEditable
                    ventana={v}
                    congelado={congelado}
                    onGuardado={(patch) => setVentanasLocal((prev) => ({ ...prev, [v.id]: { ...prev[v.id], ...patch } }))}
                  />
                  <span className="px-2 py-0.5 rounded-full bg-brand-600/10 text-brand-600 border border-brand-600/20 font-bold text-[11px] shrink-0">
                    {v.unidades} {v.unidades === 1 ? 'ud' : 'uds'}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total neto</span>
                  <span className="font-mono font-bold text-sm text-brand-600">{ufLabel(precio?.precioVentaCLP || 0, tasaUf)}</span>
                </div>
              </header>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 flex-1">
                {/* Dibujo con sus medidas */}
                <div className="space-y-2">
                  <div className="w-full h-40 rounded-xl bg-[#f8fafc] border border-slate-100 flex items-center justify-center overflow-hidden p-2">
                    {v.tipoLineaManual === 'PROTEX' ? (
                      <div
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{
                          __html: buildProtexDoorSvg(v.numeroCuadrosHojas === 2 ? 2 : 1, v.anchoMm, v.altoMm),
                        }}
                      />
                    ) : (
                      <WindowRendererSvg ventana={v} className="w-full h-full" />
                    )}
                  </div>
                  <p className="text-center text-xs font-bold text-slate-900 tabular-nums">
                    {formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)} mm
                  </p>
                </div>

                {/* Datos técnicos */}
                <dl className="text-xs space-y-2 min-w-0">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Apertura</dt>
                    <dd className="text-slate-900 font-medium">{apertura}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Acabado</dt>
                    <dd className="flex items-center gap-1.5 text-slate-900 font-medium">
                      {isFrameless ? (
                        '—'
                      ) : (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: finish.frame }} />
                          {finishLabel}
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Vidrio</dt>
                    <dd className="text-slate-900 font-medium break-words">{vidrio || '—'}</dd>
                  </div>
                  <div className="pt-1">
                    <ObservacionEditable
                      ventana={v}
                      congelado={congelado}
                      onGuardado={(patch) => setVentanasLocal((prev) => ({ ...prev, [v.id]: { ...prev[v.id], ...patch } }))}
                    />
                  </div>
                </dl>
              </div>

              {/* Valores comerciales de la línea */}
              <footer className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Precio unitario</span>
                  <span className="font-mono font-bold text-slate-900">{ufLabel(precio?.precioUnitarioCLP || 0, tasaUf)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Cantidad</span>
                  <span className="font-mono font-bold text-slate-900">{v.unidades} ud{v.unidades === 1 ? '' : 'es'}</span>
                </div>
              </footer>
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
            <button type="button" onClick={() => setEditandoCondiciones(true)} className="text-[11px] text-slate-400 hover:text-brand-600 flex items-center gap-1">
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
              className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-brand-600 font-mono"
            />
            <p className="text-[10px] text-slate-400">Una condición por línea.</p>
            <button
              type="button"
              onClick={() => guardarCondicionesMutation.mutate()}
              disabled={guardarCondicionesMutation.isPending}
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5"
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
