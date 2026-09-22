import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Material } from '../../../../types';
import { MaterialPicker } from './MaterialPicker';

export interface MaterialLineaFormPayload {
  materialId: string;
  cantidad: number;
  piezas: number | null;
  acabado: string | null;
}

interface MaterialLineaFormProps {
  title: string;
  initialCantidad?: number;
  initialPiezas?: number | null;
  initialAcabado?: string | null;
  onCancel: () => void;
  onConfirm: (payload: MaterialLineaFormPayload) => Promise<void>;
}

/**
 * Formulario compartido por "Agregar material" y "Reemplazar material" en el
 * despiece de una línea: buscar en el maestro (MaterialPicker), elegir uno,
 * y cargar cantidad/piezas/acabado. Quien lo usa decide qué hacer con el
 * payload al confirmar (agregar vs. reemplazar son la misma UI, distinta
 * llamada a la API).
 */
export const MaterialLineaForm: React.FC<MaterialLineaFormProps> = ({
  title,
  initialCantidad,
  initialPiezas,
  initialAcabado,
  onCancel,
  onConfirm,
}) => {
  const [selected, setSelected] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState(initialCantidad !== undefined ? String(initialCantidad) : '1');
  const [piezas, setPiezas] = useState(initialPiezas !== undefined && initialPiezas !== null ? String(initialPiezas) : '');
  const [acabado, setAcabado] = useState(initialAcabado || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selected) return;
    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      setError('La cantidad debe ser un número mayor a 0.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onConfirm({
        materialId: selected.id,
        cantidad: cantidadNum,
        piezas: piezas.trim() ? Number(piezas) : null,
        acabado: acabado.trim() || null,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Error al guardar.');
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#E34A26]">{title}</span>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">{error}</div>
      )}

      {!selected ? (
        <MaterialPicker onSelect={setSelected} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <div className="font-mono font-semibold text-[11px] text-slate-900">{selected.skuInterno}</div>
              <div className="text-[11px] text-slate-600 leading-tight">{selected.descripcion}</div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              disabled={isSaving}
              className="text-[10px] font-semibold text-[#E34A26] hover:underline shrink-0 cursor-pointer disabled:opacity-50"
            >
              Cambiar
            </button>
          </div>

          {initialCantidad !== undefined && (
            <div className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="font-bold uppercase tracking-wide text-slate-400">Pendiente por reemplazar: </span>
              {initialCantidad} un
              {initialPiezas != null && ` · ${initialPiezas} ${initialPiezas === 1 ? 'pieza' : 'piezas'}`}
              {initialAcabado && ` · acabado ${initialAcabado}`}
              <span className="block mt-0.5 text-slate-400 normal-case font-normal">
                Los campos de abajo son los valores del material de reemplazo. Si esta línea necesita más de un material distinto
                (ej. una corredera con 2 manillas diferentes), puedes reemplazar solo una parte de la cantidad pendiente y repetir
                la operación con el resto para el otro material.
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 space-y-1 block">
              <span>Cantidad *</span>
              <input
                type="number"
                min={0}
                max={initialCantidad}
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                disabled={isSaving}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#E34A26]/30"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500 space-y-1 block">
              <span>Piezas</span>
              <input
                type="number"
                min={0}
                step="1"
                value={piezas}
                onChange={(e) => setPiezas(e.target.value)}
                disabled={isSaving}
                placeholder="—"
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#E34A26]/30"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500 space-y-1 block">
              <span>Acabado</span>
              <input
                type="text"
                value={acabado}
                onChange={(e) => setAcabado(e.target.value)}
                disabled={isSaving}
                placeholder="—"
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#E34A26]/30"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E34A26] hover:bg-[#c93f1f] text-white transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirmar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
