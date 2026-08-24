import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  Building2, 
  DollarSign, 
  Layers, 
  Boxes, 
  Ruler, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight,
  User,
  Coins,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Calculator,
  Info
} from 'lucide-react';
import { getProyectoById, updateVersionConfig, triggerManualSync } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import type { Ventana, ProyectoVersion } from '../../types';

interface CotizadorModalProps {
  proyectoId: string | null;
  onClose: () => void;
}

export const CotizadorModal: React.FC<CotizadorModalProps> = ({ proyectoId, onClose }) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [showReimportModal, setShowReimportModal] = useState(false);

  // Form State para Paso 1 (Divisas & Config)
  const [dolar, setDolar] = useState<string>('950');
  const [uf, setUf] = useState<string>('38500');
  const [euro, setEuro] = useState<string>('1030');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: proyecto } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId!),
    enabled: !!proyectoId,
  });

  const activeVersion: ProyectoVersion | undefined = 
    proyecto?.versiones[selectedVersionIdx] || proyecto?.versiones[0];

  // Sincronizar form inputs cuando carga la versiÃ³n
  useEffect(() => {
    if (activeVersion) {
      setDolar(activeVersion.tipoCambioDolar ? String(activeVersion.tipoCambioDolar) : '950');
      setUf(activeVersion.tipoCambioUF ? String(activeVersion.tipoCambioUF) : '38500');
      setEuro(activeVersion.tipoCambioEuro ? String(activeVersion.tipoCambioEuro) : '1030');
    }
  }, [activeVersion]);

  // MutaciÃ³n para guardar configuraciÃ³n del Paso 1
  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersion) return;
      return updateVersionConfig(activeVersion.id, {
        tipoCambioDolar: dolar ? Number(dolar) : null,
        tipoCambioUF: uf ? Number(uf) : null,
        tipoCambioEuro: euro ? Number(euro) : null,
        estadoAprobacion: activeVersion.estadoAprobacion === 'BORRADOR' ? 'EN_COTIZACION' : activeVersion.estadoAprobacion,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  // MutaciÃ³n para Reimportar desde HETMO
  const reimportMutation = useMutation({
    mutationFn: async () => {
      return triggerManualSync(true);
    },
    onSuccess: () => {
      setShowReimportModal(false);
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });

  if (!proyectoId) return null;

  const ventanas: Ventana[] = activeVersion?.ventanas || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl h-[92vh] bg-[#0A0E17] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* ========================================== */}
        {/* HEADER SUPERIOR */}
        {/* ========================================== */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-slate-900/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  {proyecto?.obra || 'Cargando Obra...'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-300 font-mono">
                  {proyecto?.codigoInterno || `PRJ-${proyecto?.numeroPresupuesto}`}
                </span>
                {activeVersion?.esCongelado ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> APROBADO GERENCIA
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold">
                    {activeVersion?.estadoAprobacion || 'EN COTIZACIÃ“N'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Cliente HETMO: <span className="text-slate-200">{proyecto?.clienteNombreRaw}</span>
                {proyecto?.clienteRutRaw && <span className="ml-2 font-mono text-slate-400">({proyecto.clienteRutRaw})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Selector de versiones de HETMO */}
            {proyecto && proyecto.versiones.length > 1 && (
              <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-white/10">
                {proyecto.versiones.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersionIdx(idx)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      selectedVersionIdx === idx
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Rev {v.versionNumero}
                  </button>
                ))}
              </div>
            )}

            {/* BotÃ³n Reimportar desde HETMO */}
            <button
              onClick={() => setShowReimportModal(true)}
              disabled={activeVersion?.esCongelado}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Restablecer presupuesto leyendo los datos originales de HETMO"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reimportar HETMO</span>
            </button>

            {/* Cerrar modal */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* STEPPER DE NAVEGACIÃ“N (4 PASOS) */}
        {/* ========================================== */}
        <div className="px-6 py-2.5 border-b border-white/[0.06] bg-slate-950/60 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2 sm:gap-6 min-w-max">
            {/* Paso 1 */}
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                currentStep === 1
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === 1 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                1
              </span>
              <span>Datos & Divisas</span>
            </button>

            <span className="text-slate-700 font-bold">âž”</span>

            {/* Paso 2 */}
            <button
              onClick={() => setCurrentStep(2)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                currentStep === 2
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === 2 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                2
              </span>
              <span>Fases de FabricaciÃ³n</span>
            </button>

            <span className="text-slate-700 font-bold">âž”</span>

            {/* Paso 3 */}
            <button
              onClick={() => setCurrentStep(3)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                currentStep === 3
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === 3 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                3
              </span>
              <span>AnalÃ­tica de Materiales</span>
            </button>

            <span className="text-slate-700 font-bold">âž”</span>

            {/* Paso 4 */}
            <button
              onClick={() => setCurrentStep(4)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                currentStep === 4
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === 4 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                4
              </span>
              <span>Fijaciones & ConsolidaciÃ³n</span>
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* CUERPO PRINCIPAL DEL COTIZADOR */}
        {/* ========================================== */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* PASO 1: DATOS GENERALES Y DIVISAS */}
          {currentStep === 1 && (
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
              
              {/* Tarjetas de Resumen TÃ©cnico RÃ¡pido */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Ventanas</div>
                    <div className="text-lg font-bold text-slate-100 font-mono">
                      {activeVersion?.totalVentanas || 0}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Ruler className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Superficie Total</div>
                    <div className="text-lg font-bold text-slate-100 font-mono">
                      {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-xs text-slate-400 font-normal">mÂ²</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">LÃ­neas de Material</div>
                    <div className="text-lg font-bold text-slate-100 font-mono">
                      {activeVersion?.totalMateriales || 0}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Importe Base HETMO</div>
                    <div className="text-lg font-bold text-emerald-400 font-mono">
                      {activeVersion?.monedaSimbolo || '$'} {formatNumber(activeVersion?.importeTotal, 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque 1: AsignaciÃ³n de Cliente */}
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/[0.08] space-y-4">
                <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>1. Cliente y Destino de la CotizaciÃ³n</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">RazÃ³n Social / Nombre en HETMO</label>
                    <input
                      type="text"
                      readOnly
                      value={proyecto?.clienteNombreRaw || ''}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-slate-200 text-xs font-medium focus:outline-none cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">RUT / Identificador Fiscal</label>
                    <input
                      type="text"
                      readOnly
                      value={proyecto?.clienteRutRaw || 'Sin RUT especificado en HETMO'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-slate-200 text-xs font-mono focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-cyan-300 flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
                  <div>
                    El maestro de clientes se vincularÃ¡ formalmente para la emisiÃ³n del presupuesto oficial y facturaciÃ³n. La direcciÃ³n de obra registrada es: <span className="font-semibold text-slate-200">{proyecto?.clienteDireccionRaw || 'No especificada'}</span>.
                  </div>
                </div>
              </div>

              {/* Bloque 2: Divisas de la Obra */}
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                    <Coins className="w-4 h-4 text-cyan-400" />
                    <span>2. Divisas y ParÃ¡metros EconÃ³micos de la Obra</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Valores especÃ­ficos para este proyecto
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Configura los tipos de cambio que se utilizarÃ¡n para convertir los costos de perfiles importados (USD/EUR) y presentar el presupuesto en UF o CLP.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* DÃ³lar */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                    <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                      <span>DÃ³lar Observado (USD)</span>
                      <span className="text-[10px] text-cyan-400 font-mono">$ CLP</span>
                    </label>
                    <input
                      type="number"
                      value={dolar}
                      onChange={(e) => setDolar(e.target.value)}
                      placeholder="950.00"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  {/* UF */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                    <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                      <span>Unidad de Fomento (UF)</span>
                      <span className="text-[10px] text-cyan-400 font-mono">$ CLP</span>
                    </label>
                    <input
                      type="number"
                      value={uf}
                      onChange={(e) => setUf(e.target.value)}
                      placeholder="38500.00"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  {/* Euro */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                    <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                      <span>Euro Oficial (EUR)</span>
                      <span className="text-[10px] text-cyan-400 font-mono">$ CLP</span>
                    </label>
                    <input
                      type="number"
                      value={euro}
                      onChange={(e) => setEuro(e.target.value)}
                      placeholder="1030.00"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 3: Resumen de TipologÃ­as de Ventanas */}
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                    <span>3. TipologÃ­as Importadas ({ventanas.length} modelos)</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Fase Base (Fase 0)
                  </span>
                </div>

                <div className="overflow-x-auto max-h-60 rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">LÃ­nea</th>
                        <th className="px-4 py-2.5 font-semibold">Modelo</th>
                        <th className="px-4 py-2.5 font-semibold text-center">Uds</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Dimensiones (mm)</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Superficie (mÂ²)</th>
                        <th className="px-4 py-2.5 font-semibold">Acabado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {ventanas.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 font-mono text-slate-400">#{v.lineaHetmo}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-200">{v.modelo}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-cyan-400">{v.unidades}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{formatNumber(v.anchoMm, 0)} Ã— {formatNumber(v.altoMm, 0)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-100">{formatNumber(v.m2Ventana, 2)}</td>
                          <td className="px-4 py-2.5 text-slate-400">{v.acabadoCodigo || 'EstÃ¡ndar'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* PASO 2: FASES DE FABRICACIÃ“N (En construcciÃ³n) */}
          {currentStep === 2 && (
            <div className="p-12 text-center space-y-3 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">MÃ³dulo de Fases de FabricaciÃ³n</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                AquÃ­ podrÃ¡s particionar las {activeVersion?.totalVentanas || 0} ventanas en fases (Fase 1, Fase 2, etc.) para calcular requerimientos de compra y producciÃ³n por etapa.
              </p>
            </div>
          )}

          {/* PASO 3: ANALÃTICA DE MATERIALES */}
          {currentStep === 3 && (
            <div className="p-12 text-center space-y-3 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">AnalÃ­tica de Materiales y Ajustes Macro</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Modifica precios de PVC por obra, sustituye manillas por lÃ­nea y excluye vidrios fantasma de HETMO.
              </p>
            </div>
          )}

          {/* PASO 4: FIJACIONES Y EXTRAS */}
          {currentStep === 4 && (
            <div className="p-12 text-center space-y-3 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Hoja de FijaciÃ³n, Extras y AprobaciÃ³n</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                CÃ¡lculo de fijaciones, tornillerÃ­a, sellantes, grÃºas y consolidaciÃ³n final para aprobaciÃ³n de Gerencia.
              </p>
            </div>
          )}

        </div>

        {/* ========================================== */}
        {/* FOOTER INFERIOR DE ACCIONES */}
        {/* ========================================== */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4" /> ParÃ¡metros guardados con Ã©xito
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>

            {currentStep === 1 ? (
              <button
                onClick={() => {
                  updateConfigMutation.mutate();
                  setCurrentStep(2);
                }}
                disabled={updateConfigMutation.isPending}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
              >
                <span>Guardar y Continuar a Fases</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Volver a Paso 1
              </button>
            )}
          </div>
        </div>

      </div>

      {/* MODAL DE CONFIRMACIÃ“N REIMPORTAR HETMO */}
      {showReimportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0F1523] border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-100">Â¿Reimportar desde HETMO?</h3>
              <p className="text-xs text-slate-400">
                Esta acciÃ³n volverÃ¡ a leer los datos crudos desde SQL Server. Si realizaste modificaciones personalizadas de precios o sustituciones, se restablecerÃ¡n a los valores originales de fÃ¡brica.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowReimportModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => reimportMutation.mutate()}
                disabled={reimportMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${reimportMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{reimportMutation.isPending ? 'Reimportando...' : 'SÃ­, Reimportar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};