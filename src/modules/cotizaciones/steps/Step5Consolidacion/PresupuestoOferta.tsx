import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Pencil, Check } from 'lucide-react';
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
import { Button } from '../../../../components/ui/Button';
import { IconButton } from '../../../../components/ui/IconButton';
import { Select } from '../../../../components/ui/Select';
import { InputCompacto, Textarea } from '../../../../components/ui/Campos';
import { ActivadorEdicion } from '../../../../components/ui/ActivadorEdicion';
import { mostrarToast } from '../../../../lib/toast';
import { useConfirmar } from '../../../../components/ui/Confirmar';

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
      <ActivadorEdicion disabled={congelado} onClick={() => setEditando(true)} etiqueta="Editar el nombre">
        <h4 className="text-sm font-black text-slate-900">{ventana.modelo}</h4>
      </ActivadorEdicion>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <InputCompacto
        aria-label="Nombre de la ventana"
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && mutation.mutate()}
        maxLength={220}
        className="text-sm! font-black min-w-0"
      />
      <IconButton icono={Check} tono="marca" etiqueta="Guardar nombre" onClick={() => mutation.mutate()} cargando={mutation.isPending} />
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
      <Button variant="link" size="sm" className="text-[11px]! font-semibold!" onClick={() => setEditando(true)}>
        + Agregar observación
      </Button>
    );
  }

  if (!editando) {
    return (
      <div className="w-full">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Observación</span>
        <ActivadorEdicion disabled={congelado} onClick={() => setEditando(true)} etiqueta="Editar la observación" className="w-full">
          <p className="text-xs text-slate-700">{ventana.comentarioPresupuesto}</p>
        </ActivadorEdicion>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Textarea aria-label="Observación" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} rows={2} maxLength={2000} />
      <Button size="sm" onClick={() => mutation.mutate()} isLoading={mutation.isPending} leftIcon={<Check className="w-3 h-3" />}>
        Guardar
      </Button>
    </div>
  );
};

export const PresupuestoOferta: React.FC<PresupuestoOfertaProps> = ({ proyecto, activeVersion, dolar, uf, euro }) => {
  const { confirmar } = useConfirmar();
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
      mostrarToast('No se pudo generar el PDF.', { detalle: String(error?.message || error) });
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
        <Button onClick={exportarPDF} isLoading={exportando} leftIcon={<FileDown className="w-4 h-4" />}>
          Exportar PDF
        </Button>
      </div>

      {plantillasDisponibles.length > 1 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 shrink-0">Plantilla de textos</span>
          <div className="flex-1">
            <Select
              aria-label="Plantilla de textos"
              value={plantillaActual}
              disabled={congelado || plantillaMutation.isPending}
              onChange={async (e) => {
                const id = e.target.value;
                const ok = await confirmar({ titulo: '¿Cambiar la plantilla?', mensaje: 'Se reemplazan el texto de presentación y las condiciones por los de esta plantilla.', confirmar: 'Reemplazar' });
                if (ok) plantillaMutation.mutate(id);
              }}
              options={plantillasDisponibles.map((p) => ({ value: p.id, label: `${p.nombre}${p.tipoProyecto ? ` (${p.tipoProyecto.nombre})` : ' (general)'}` }))}
            />
          </div>
        </div>
      )}

      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Texto de presentación</h4>
          {!congelado && !editandoTexto && (
            <Button variant="ghost" size="sm" leftIcon={<Pencil className="w-3 h-3" />} onClick={() => setEditandoTexto(true)}>
              Editar
            </Button>
          )}
        </div>
        {editandoTexto ? (
          <div className="space-y-2">
            <Textarea aria-label="Texto de presentación" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} />
            <Button size="sm" onClick={() => guardarTextoMutation.mutate()} isLoading={guardarTextoMutation.isPending}>
              Guardar
            </Button>
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
            <Button variant="ghost" size="sm" leftIcon={<Pencil className="w-3 h-3" />} onClick={() => setEditandoCondiciones(true)}>
              Editar
            </Button>
          )}
        </div>
        {editandoCondiciones ? (
          <div className="space-y-2">
            <Textarea aria-label="Condiciones comerciales" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} rows={8} className="font-mono" helperText="Una condición por línea." />
            <Button size="sm" onClick={() => guardarCondicionesMutation.mutate()} isLoading={guardarCondicionesMutation.isPending}>
              Guardar
            </Button>
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
