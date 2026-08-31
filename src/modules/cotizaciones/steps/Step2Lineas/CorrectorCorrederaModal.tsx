import React, { useState, useMemo } from 'react';
import {
  X,
  RotateCcw,
  Check,
  MoveHorizontal,
  Sliders,
  Maximize2,
  Info,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Minus,
  EyeOff,
  Sparkles
} from 'lucide-react';
import type { Ventana, CorreccionGeometria, CorreccionHoja, SentidoMovimientoHoja } from '../../../../types';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import * as core from '../../components/drawing/geometryCore';
import { formatNumber } from '../../../../lib/utils';
import { updateVentanaCorreccionGeometria, deleteVentanaCorreccionGeometria } from '../../../../api/client';

interface CorrectorCorrederaModalProps {
  ventana: Ventana;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedVentana: Ventana) => void;
}

export const CorrectorCorrederaModal: React.FC<CorrectorCorrederaModalProps> = ({
  ventana,
  isOpen,
  onClose,
  onSaved,
}) => {
  // Catálogo de aperturas de corredera
  const slidingApertures = useMemo(() => {
    return Object.entries(core.apertureCatalog)
      .filter(([, def]) => (def as any).symbol === 'sliding')
      .map(([code, def]) => ({
        code: Number(code),
        label: (def as any).label || `Apertura ${code}`,
        leafCount: (def as any).leafCount || ((def as any).layout ? (def as any).layout.length : 2),
      }))
      .sort((a, b) => a.code - b.code);
  }, []);

  // Apertura inicial
  const initialAperture = useMemo(() => {
    if (ventana.correccionGeometria?.apertura) {
      return ventana.correccionGeometria.apertura;
    }
    const defaultCode = ventana.dibujoTipoApertura || 202;
    const exists = slidingApertures.some((a) => a.code === defaultCode);
    return exists ? defaultCode : (slidingApertures[0]?.code || 202);
  }, [ventana, slidingApertures]);

  const [selectedAperture, setSelectedAperture] = useState<number>(initialAperture);

  // Inicializar hojas para una apertura dada
  const initializeLeaves = (apCode: number): CorreccionHoja[] => {
    // Si ya existe una corrección con esta misma apertura, usar sus hojas
    if (ventana.correccionGeometria?.apertura === apCode && ventana.correccionGeometria.hojas?.length) {
      return JSON.parse(JSON.stringify(ventana.correccionGeometria.hojas));
    }

    const testLine = toWindowLine({
      ...ventana,
      dibujoTipoApertura: apCode,
      correccionGeometria: null,
    });
    const baseLeaves = testLine ? core.leavesFor(testLine) : [];
    const count = baseLeaves.length || 2;
    const defaultWidth = Math.round(ventana.anchoMm / count);

    return baseLeaves.map((leaf: any, idx: number) => {
      let mov: SentidoMovimientoHoja = 'fija';
      const kindStr = String(leaf.kind || '');
      if (kindStr.endsWith(':left')) mov = 'izquierda';
      else if (kindStr.endsWith(':right')) mov = 'derecha';
      else if (kindStr.endsWith(':both')) mov = 'ambos';
      else if (kindStr === 'fijo') mov = 'fija';
      else if (kindStr === 'oculta' || leaf.oculta) mov = 'oculta';

      return {
        indice: idx,
        ancho: Math.round(Number(leaf.width) || defaultWidth),
        carril: leaf.oculta || mov === 'oculta' ? 0 : (Number(leaf.carril) || 1),
        movimiento: mov,
      };
    });
  };

  const [draftHojas, setDraftHojas] = useState<CorreccionHoja[]>(() =>
    initializeLeaves(initialAperture)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Al cambiar apertura, reinicializar hojas
  const handleApertureChange = (newCode: number) => {
    setSelectedAperture(newCode);
    setDraftHojas(initializeLeaves(newCode));
  };

  // Actualizar una hoja individual
  const updateHoja = (index: number, patch: Partial<CorreccionHoja>) => {
    setDraftHojas((prev) =>
      prev.map((h, i) => {
        if (i !== index) return h;
        const updated = { ...h, ...patch };
        // Si el carril se pone en 0 (oculta), el movimiento pasa a 'oculta'
        if (patch.carril === 0) {
          updated.movimiento = 'oculta';
        } else if (patch.carril !== undefined && patch.carril > 0 && updated.movimiento === 'oculta') {
          updated.movimiento = 'fija';
        }
        return updated;
      })
    );
  };

  // Repartir anchos equitativamente
  const handleEqualizeWidths = () => {
    if (!draftHojas.length) return;
    const equalWidth = Math.round(ventana.anchoMm / draftHojas.length);
    setDraftHojas((prev) => prev.map((h) => ({ ...h, ancho: equalWidth })));
  };

  // Ventana provisional para el renderizador SVG en vivo
  const previewVentana = useMemo<Ventana>(() => {
    const draftCorrection: CorreccionGeometria = {
      esquema: 1,
      lineaHetmo: ventana.lineaHetmo,
      apertura: selectedAperture,
      hojas: draftHojas,
    };
    return {
      ...ventana,
      dibujoTipoApertura: selectedAperture,
      correccionGeometria: draftCorrection,
    };
  }, [ventana, selectedAperture, draftHojas]);

  const previewLine = useMemo(() => toWindowLine(previewVentana), [previewVentana]);
  const previewLabel = previewLine ? core.apertureLabel(previewLine) : 'Corredera';

  // Guardar corrección
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const payload: CorreccionGeometria = {
        esquema: 1,
        lineaHetmo: ventana.lineaHetmo,
        apertura: selectedAperture,
        hojas: draftHojas,
      };

      const result = await updateVentanaCorreccionGeometria(ventana.id, payload);
      if (result.success && result.data) {
        onSaved(result.data);
        onClose();
      } else {
        setErrorMessage('No se pudo guardar la corrección en el servidor.');
      }
    } catch (err: any) {
      console.error('Error guardando corrección de geometría:', err);
      setErrorMessage(err?.response?.data?.error || err.message || 'Error al conectar con la API.');
    } finally {
      setIsSaving(false);
    }
  };

  // Restablecer a original HETMO
  const handleRestoreOriginal = async () => {
    if (!window.confirm('¿Deseas restablecer esta corredera a la geometría y apertura original importada desde HETMO?')) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await deleteVentanaCorreccionGeometria(ventana.id);
      if (result.success && result.data) {
        onSaved(result.data);
        onClose();
      }
    } catch (err: any) {
      console.error('Error restableciendo geometría:', err);
      setErrorMessage(err?.response?.data?.error || err.message || 'Error al restablecer la geometría.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#E34A26] border border-orange-200 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Ajustar Geometría de Corredera:</span>
                <span className="text-[#E34A26]">{ventana.modelo}</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Línea #{ventana.lineaHetmo} · {ventana.unidades} uds ({formatNumber(ventana.anchoMm, 0)} × {formatNumber(ventana.altoMm, 0)} mm)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Cerrar modal de corrección"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de error si ocurre */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cuerpo del Modal: 2 Columnas */}
        <div className="overflow-y-auto flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/30">
          {/* COLUMNA IZQUIERDA: Vista previa interactiva en tiempo real */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vista Previa en Vivo</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {formatNumber(ventana.anchoMm, 0)} × {formatNumber(ventana.altoMm, 0)} mm
                </span>
              </div>

              {/* Contenedor del dibujo SVG en tiempo real */}
              <div className="bg-[#f8fafc] rounded-xl p-4 flex items-center justify-center border border-slate-100 min-h-[240px]">
                <WindowRendererSvg ventana={previewVentana} />
              </div>

              {/* Resumen dinámico */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Apertura Resultante:</span>
                  <p className="font-bold text-slate-900 text-xs mt-0.5">{previewLabel}</p>
                </div>
                <div className="flex items-center justify-between text-slate-600 text-[11px] pt-1">
                  <span>Hojas configuradas: {draftHojas.length}</span>
                  <span>Móviles: {draftHojas.filter((h) => h.carril > 0 && h.movimiento !== 'fija' && h.movimiento !== 'oculta').length}</span>
                  <span>Fijas: {draftHojas.filter((h) => h.carril > 0 && h.movimiento === 'fija').length}</span>
                </div>
              </div>
            </div>

            {/* Aviso de integridad de datos */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-950 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Garantía de Presupuesto</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Este ajuste modifica únicamente la visualización técnica y el sentido de apertura de las hojas. Las medidas totales, materiales, vidrios y precios netos no se alteran.
              </p>
            </div>
          </div>

          {/* COLUMNA DERECHA: Controles de Apertura y Hojas */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Selector de Tipo de Apertura */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Tipo de Apertura (Catálogo HETMO)
              </label>
              <select
                value={selectedAperture}
                onChange={(e) => handleApertureChange(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#E34A26] focus:bg-white transition-colors cursor-pointer"
              >
                {slidingApertures.map((ap) => (
                  <option key={ap.code} value={ap.code}>
                    Código {ap.code} · {ap.label} ({ap.leafCount} {ap.leafCount === 1 ? 'hoja' : 'hojas'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Configuración de Hojas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Configuración de Hojas ({draftHojas.length})
                </label>
                <button
                  type="button"
                  onClick={handleEqualizeWidths}
                  className="text-[11px] font-semibold text-[#E34A26] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Repartir anchos iguales</span>
                </button>
              </div>

              <div className="space-y-3">
                {draftHojas.map((hoja, idx) => {
                  const isHidden = hoja.carril === 0 || hoja.movimiento === 'oculta';

                  return (
                    <div
                      key={hoja.indice}
                      className={`p-4 rounded-2xl border transition-all ${
                        isHidden
                          ? 'bg-slate-100/60 border-slate-200 opacity-70'
                          : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                      }`}
                    >
                      {/* Cabecera de Hoja */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            Hoja {idx + 1}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                            isHidden
                              ? 'bg-slate-200 text-slate-600 border-slate-300'
                              : hoja.carril === 1
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : hoja.carril === 2
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {isHidden ? 'Oculta / No aplica' : `Carril C${hoja.carril}`}
                        </span>
                      </div>

                      {/* Controles de la Hoja */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
                        {/* Ancho del Tramo */}
                        <div className="sm:col-span-4 space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Ancho (mm)
                          </label>
                          <input
                            type="number"
                            min={50}
                            max={10000}
                            step={1}
                            value={hoja.ancho || ''}
                            onChange={(e) => updateHoja(idx, { ancho: Number(e.target.value) || 0 })}
                            disabled={isHidden}
                            className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#E34A26] focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>

                        {/* Selector de Carril */}
                        <div className="sm:col-span-8 space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Carril / Riel
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              { num: 1, label: 'C1 (Int)' },
                              { num: 2, label: 'C2' },
                              { num: 3, label: 'C3 (Ext)' },
                              { num: 0, label: 'Ocultar' },
                            ].map((opt) => (
                              <button
                                key={opt.num}
                                type="button"
                                onClick={() => updateHoja(idx, { carril: opt.num })}
                                className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border text-center ${
                                  hoja.carril === opt.num
                                    ? opt.num === 0
                                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                                      : 'bg-[#E34A26] text-white border-[#E34A26] shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {opt.num === 0 ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <EyeOff className="w-3 h-3" />
                                    <span>Ocultar</span>
                                  </span>
                                ) : (
                                  opt.label
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Sentido de Movimiento */}
                        {!isHidden && (
                          <div className="sm:col-span-12 space-y-1 pt-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Sentido de Movimiento
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { val: 'fija' as SentidoMovimientoHoja, label: 'Fija', icon: Minus },
                                { val: 'izquierda' as SentidoMovimientoHoja, label: 'Izquierda', icon: ArrowLeft },
                                { val: 'derecha' as SentidoMovimientoHoja, label: 'Derecha', icon: ArrowRight },
                                { val: 'ambos' as SentidoMovimientoHoja, label: 'Ambos lados', icon: MoveHorizontal },
                              ].map((opt) => {
                                const Icon = opt.icon;
                                const isActive = hoja.movimiento === opt.val;
                                return (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => updateHoja(idx, { movimiento: opt.val })}
                                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                      isActive
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={handleRestoreOriginal}
            disabled={isSaving || !ventana.correccionGeometria}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer a Original HETMO</span>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-[#E34A26] hover:bg-[#c93f1f] text-white font-bold text-xs transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar Corrección</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
