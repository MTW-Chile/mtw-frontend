import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Check, MoveHorizontal, Maximize2, ArrowLeft, ArrowRight, Minus, EyeOff } from 'lucide-react';
import type { Ventana, CorreccionGeometria, CorreccionHoja, SentidoMovimientoHoja } from '../../../../types';
import * as core from '../../components/drawing/geometryCore';
import { updateVentanaCorreccionGeometria, deleteVentanaCorreccionGeometria } from '../../../../api/client';
import { Aviso } from '../../../../components/ui/Aviso';
import { Button } from '../../../../components/ui/Button';
import { Select } from '../../../../components/ui/Select';
import { InputCompacto } from '../../../../components/ui/Campos';
import { Segmentado } from '../../../../components/ui/Segmentado';
import { useConfirmar } from '../../../../components/ui/Confirmar';

export interface CorrederaDraft {
  apertura: number;
  hojas: CorreccionHoja[];
}

interface CorrederaEditorProps {
  ventana: Ventana;
  /** Borrador vigente (null mientras no se haya tocado nada): el modal lo aplica al dibujo en vivo. */
  onDraftChange: (draft: CorrederaDraft | null) => void;
  onSaved: (updated: Ventana) => void;
}

/** Editor de apertura, carriles y sentidos de las hojas de una corredera (embebido en EditarLineaModal). */
export const CorrederaEditor: React.FC<CorrederaEditorProps> = ({ ventana, onDraftChange, onSaved }) => {
  const { confirmar } = useConfirmar();
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

  // Apertura inicial: si ya tiene corrección guardada, usar esa; si no, el tipo HETMO original
  const initialAperture = (() => {
    if (ventana.correccionGeometria?.apertura) return ventana.correccionGeometria.apertura;
    const defaultCode = ventana.dibujoTipoApertura || 202;
    const exists = slidingApertures.some((a) => a.code === defaultCode);
    return exists ? defaultCode : (slidingApertures[0]?.code || 202);
  })();

  const [selectedAperture, setSelectedAperture] = useState<number>(initialAperture);
  const [dirty, setDirty] = useState(false);

  /**
   * Inicializa las hojas para una apertura dada leyendo directamente del
   * `apertureCatalog`, sin depender de las geometrías HETMO. Esto garantiza que
   * al cambiar el tipo de apertura en el selector, las hojas reflejen el layout
   * del nuevo código, no el original importado.
   */
  const initializeLeaves = (apCode: number): CorreccionHoja[] => {
    // Si ya existe una corrección guardada con esta misma apertura, preservar sus hojas
    if (ventana.correccionGeometria?.apertura === apCode && ventana.correccionGeometria.hojas?.length) {
      return JSON.parse(JSON.stringify(ventana.correccionGeometria.hojas));
    }

    // Leer layout directamente del catálogo (fuente de verdad)
    const catalogEntry = (core.apertureCatalog as any)[apCode];
    const layout: string[] = Array.isArray(catalogEntry?.layout) ? catalogEntry.layout : [];
    const rails: string[] = Array.isArray(catalogEntry?.rails) ? catalogEntry.rails : [];
    const count = layout.length || (catalogEntry?.leafCount as number) || 2;
    const defaultWidth = Math.round(ventana.anchoMm / count);

    if (layout.length > 0) {
      return layout.map((kind: string, idx: number) => {
        let mov: SentidoMovimientoHoja = 'fija';
        if (kind.endsWith(':left')) mov = 'izquierda';
        else if (kind.endsWith(':right')) mov = 'derecha';
        else if (kind.endsWith(':both')) mov = 'ambos';
        else if (kind === 'fijo') mov = 'fija';

        const railStr = rails[idx] || 'int';
        const carril = railStr === 'ext' ? 2 : 1;

        return { indice: idx, ancho: defaultWidth, carril, movimiento: mov };
      });
    }

    // Fallback: apertura sin layout definido (ej. elevadoras de 1 hoja)
    return Array.from({ length: count }, (_, idx) => ({
      indice: idx,
      ancho: defaultWidth,
      carril: 1,
      movimiento: 'fija' as SentidoMovimientoHoja,
    }));
  };

  const [draftHojas, setDraftHojas] = useState<CorreccionHoja[]>(() =>
    initializeLeaves(initialAperture)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Al cambiar apertura, reinicializar hojas
  const handleApertureChange = (newCode: number) => {
    setDirty(true);
    setSelectedAperture(newCode);
    setDraftHojas(initializeLeaves(newCode));
  };

  // Actualizar una hoja individual
  const updateHoja = (index: number, patch: Partial<CorreccionHoja>) => {
    setDirty(true);
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
    setDirty(true);
    const equalWidth = Math.round(ventana.anchoMm / draftHojas.length);
    setDraftHojas((prev) => prev.map((h) => ({ ...h, ancho: equalWidth })));
  };


  useEffect(() => {
    onDraftChange(dirty ? { apertura: selectedAperture, hojas: draftHojas } : null);
  }, [dirty, selectedAperture, draftHojas, onDraftChange]);

  // Guardar corrección
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // Conserva travesaños manuales / mano invertida ya guardados.
      const payload: CorreccionGeometria = {
        ...ventana.correccionGeometria,
        esquema: 2,
        lineaHetmo: ventana.lineaHetmo,
        apertura: selectedAperture,
        hojas: draftHojas,
      };

      const result = await updateVentanaCorreccionGeometria(ventana.id, payload);
      if (result.success && result.data) {
        onSaved(result.data);
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
    const ok = await confirmar({
      titulo: '¿Restablecer la corredera?',
      mensaje: 'Vuelve a la geometría y apertura original importada desde HETMO.',
      confirmar: 'Restablecer',
    });
    if (!ok) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await deleteVentanaCorreccionGeometria(ventana.id);
      if (result.success && result.data) {
        onSaved(result.data);
      }
    } catch (err: any) {
      console.error('Error restableciendo geometría:', err);
      setErrorMessage(err?.response?.data?.error || err.message || 'Error al restablecer la geometría.');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="space-y-4">
      {errorMessage && <Aviso tono="peligro">{errorMessage}</Aviso>}
      {/* 1. Selector de Tipo de Apertura */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2">
              <Select
                label="1. Tipo de apertura (catálogo HETMO)"
                value={String(selectedAperture)}
                onChange={(e) => handleApertureChange(Number(e.target.value))}
                options={slidingApertures.map((ap) => ({ value: String(ap.code), label: `Código ${ap.code} · ${ap.label} (${ap.leafCount} ${ap.leafCount === 1 ? 'hoja' : 'hojas'})` }))}
              />
            </div>

            {/* 2. Configuración de Hojas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Configuración de Hojas ({draftHojas.length})
                </label>
                <Button variant="link" size="sm" onClick={handleEqualizeWidths} leftIcon={<Maximize2 className="w-3 h-3" />}>
                  Repartir anchos iguales
                </Button>
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
                          <InputCompacto
                           aria-label={`Ancho de la hoja ${idx + 1}`}
                           type="number"
                           min={50}
                           max={10000}
                           step={1}
                           value={hoja.ancho || ''}
                           onChange={(e) => updateHoja(idx, { ancho: Number(e.target.value) || 0 })}
                           disabled={isHidden}
                           className="w-full font-bold"
                         />
                        </div>

                        {/* Selector de Carril */}
                        <div className="sm:col-span-8 space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Carril / Riel
                          </label>
                          <Segmentado
                            tamano="xs"
                            etiqueta={`Carril de la hoja ${idx + 1}`}
                            valor={hoja.carril}
                            onChange={(carril) => updateHoja(idx, { carril })}
                            opciones={[
                              { value: 1, label: 'C1 (int)' },
                              { value: 2, label: 'C2' },
                              { value: 3, label: 'C3 (ext)' },
                              { value: 0, label: 'Ocultar', icono: EyeOff },
                            ]}
                          />
                        </div>

                        {/* Sentido de Movimiento */}
                        {!isHidden && (
                          <div className="sm:col-span-12 space-y-1 pt-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Sentido de Movimiento
                            </label>
                            <Segmentado
                              tamano="xs"
                              etiqueta={`Movimiento de la hoja ${idx + 1}`}
                              valor={hoja.movimiento}
                              onChange={(movimiento) => updateHoja(idx, { movimiento })}
                              opciones={[
                                { value: 'fija' as SentidoMovimientoHoja, label: 'Fija', icono: Minus },
                                { value: 'izquierda' as SentidoMovimientoHoja, label: 'Izquierda', icono: ArrowLeft },
                                { value: 'derecha' as SentidoMovimientoHoja, label: 'Derecha', icono: ArrowRight },
                                { value: 'ambos' as SentidoMovimientoHoja, label: 'Ambos lados', icono: MoveHorizontal },
                              ]}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={handleRestoreOriginal} disabled={isSaving || !ventana.correccionGeometria} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
          Restablecer a original HETMO
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!dirty} isLoading={isSaving} leftIcon={<Check className="w-3.5 h-3.5" />}>
          Guardar apertura
        </Button>
      </div>
    </div>
  );
};
