import React, { useState } from 'react';
import { X, DoorClosed, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { MaterialPicker } from '../cotizaciones/steps/Step2Lineas/MaterialPicker';
import { createPlantillaLinea, updatePlantillaLinea } from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Material, PlantillaLinea } from '../../types';

interface PlantillaLineaEditModalProps {
  plantilla: PlantillaLinea | null; // null = crear nueva
  onClose: () => void;
}

interface ItemDraft {
  material: Material;
  cantidad: string;
}

/**
 * Receta de herrajes de un tipo de puerta Protex ("Puerta Protex 1 Hoja",
 * "Puerta Protex 2 Hojas"...): un nombre + una lista de (material del
 * Maestro, cantidad por puerta). Al agregar una puerta de este tipo a un
 * proyecto (Step2Lineas), cada item se copia como MaterialVentana con
 * cantidad = item.cantidad * unidades de la linea -- ver POST
 * /api/ventanas/manual en mtw-api.
 */
export const PlantillaLineaEditModal: React.FC<PlantillaLineaEditModalProps> = ({ plantilla, onClose }) => {
  const queryClient = useQueryClient();
  const esNueva = !plantilla;

  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [items, setItems] = useState<ItemDraft[]>(
    (plantilla?.items || [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((it) => ({ material: it.material!, cantidad: String(it.cantidad) }))
  );
  const [showPicker, setShowPicker] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const payloadItems = items.map((it) => ({ materialId: it.material.id, cantidad: Number(it.cantidad) }));
      if (esNueva) {
        return createPlantillaLinea({ nombre: nombre.trim(), items: payloadItems });
      }
      return updatePlantillaLinea(plantilla!.id, { nombre: nombre.trim(), items: payloadItems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantillasLinea'] });
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'Error al guardar la plantilla.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!nombre.trim()) {
      setGeneralError('El nombre es obligatorio.');
      return;
    }
    if (items.length === 0) {
      setGeneralError('Agrega al menos un material.');
      return;
    }
    if (items.some((it) => !Number.isFinite(Number(it.cantidad)) || Number(it.cantidad) <= 0)) {
      setGeneralError('Todas las cantidades deben ser números mayores a 0.');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <DoorClosed className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                {esNueva ? 'Nueva Plantilla de Puerta' : plantilla!.nombre}
              </h2>
              <p className="text-[11px] text-slate-500">Herrajes que lleva cada puerta de este tipo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <Input
            label="Nombre de la Plantilla"
            placeholder="Ej: Puerta Protex 2 Hojas - Quicio Sobrepiso"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-500">Materiales (cantidad por puerta)</span>

            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map((it, idx) => (
                  <div
                    key={it.material.id}
                    className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-[11px] text-slate-900">{it.material.skuInterno}</div>
                      <div className="text-[11px] text-slate-600 leading-tight truncate">{it.material.descripcion}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={it.cantidad}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, cantidad: val } : p)));
                      }}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-[#E34A26]/30"
                    />
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showPicker ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3">
                <MaterialPicker
                  onSelect={(material) => {
                    if (!items.some((it) => it.material.id === material.id)) {
                      setItems((prev) => [...prev, { material, cantidad: '1' }]);
                    }
                    setShowPicker(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="mt-2 text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full py-2 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:text-[#E34A26] hover:border-[#E34A26] transition-colors cursor-pointer"
              >
                + Agregar material
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={mutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
