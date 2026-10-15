import React, { useState } from 'react';
import { AlertCircle, ArrowRightLeft, Loader2, X } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import type { Material } from '../../../../types';
import { MaterialPicker } from '../Step2Lineas/MaterialPicker';
import type { MaterialConsolidado } from '../../lib/materialesConsolidados';

interface ReemplazarMaterialModalProps {
  original: MaterialConsolidado;
  // Líneas de la versión que contienen este material (HETMO o agregado a mano).
  lineasAfectadas: number;
  // Unidad de medida del material original en el maestro: solo se puede reemplazar por otra igual.
  unidadOriginal: string;
  // Categorías ya aprobadas de la versión: ni el material que sale ni el que entra pueden pertenecer a ellas.
  familiasAprobadas: string[];
  isPending: boolean;
  error: string | null;
  onConfirm: (nuevo: Material) => void;
  onClose: () => void;
}

/**
 * Reemplazo de un material en TODA la versión, desde la Analítica. Cada línea
 * que lo contiene cambia su receta por el material elegido, con la misma
 * cantidad pendiente. Ver reemplazarMaterialEnVersion en api/client.ts.
 */
export const ReemplazarMaterialModal: React.FC<ReemplazarMaterialModalProps> = ({
  original,
  lineasAfectadas,
  unidadOriginal,
  familiasAprobadas,
  isPending,
  error,
  onConfirm,
  onClose,
}) => {
  const [selected, setSelected] = useState<Material | null>(null);

  const normalizarUnidad = (unidad: string) => (unidad || '').trim().toUpperCase();
  const normalizarFamilia = (familia: string) => {
    const f = (familia || '').toUpperCase().trim();
    return f === 'JUNTAS' ? 'ACCESORIOS' : f;
  };
  const aprobadas = new Set(familiasAprobadas.map(normalizarFamilia));
  // Solo se ofrecen materiales con la misma unidad y de categorías no aprobadas.
  const filtrar = (m: Material) =>
    normalizarUnidad(m.unidadMedida) === normalizarUnidad(unidadOriginal) && !aprobadas.has(normalizarFamilia(m.familia));

  const cambiaFamilia = selected !== null && normalizarFamilia(selected.familia) !== normalizarFamilia(original.familia);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Reemplazar material</h2>
              <p className="text-[11px] text-slate-500">Cambia el material en todas las líneas de la versión</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Material actual</div>
            <div className="text-[11px] font-semibold text-slate-900">{original.skuInterno}</div>
            <div className="text-xs text-slate-700 leading-snug">{original.descripcion}</div>
            <div className="text-[11px] text-slate-500">
              {original.familia} · {lineasAfectadas} {lineasAfectadas === 1 ? 'línea' : 'líneas'} de la versión
            </div>
          </div>

          {!selected ? (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Nuevo material (maestro)</div>
              <MaterialPicker onSelect={setSelected} filtrar={filtrar} placeholder={`Buscar material en ${unidadOriginal || 'la misma unidad'}…`} />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Nuevo material</div>
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-brand-600/30 bg-brand-600/5">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-[11px] text-slate-900">{selected.skuInterno}</div>
                  <div className="text-xs text-slate-700 leading-snug">{selected.descripcion}</div>
                  <div className="text-[11px] text-slate-500">
                    {selected.familia} · {selected.unidadMedida}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  disabled={isPending}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 shrink-0 disabled:opacity-50"
                >
                  Cambiar
                </button>
              </div>
            </div>
          )}

          {cambiaFamilia && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                El material nuevo es de otra familia ({selected?.familia}). La cantidad se traspasa tal cual: revisa que tenga sentido
                para la unidad del material original ({original.unidadMedida}).
              </span>
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Solo se ofrecen materiales con unidad <strong className="text-slate-700">{unidadOriginal || '—'}</strong> de categorías
            no aprobadas. La cantidad pendiente de cada línea se traspasa al material nuevo, y su precio toma el último precio del maestro.
            Lo que ya se reemplazó en una línea por otro material no cambia.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/70 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selected || isPending}
            onClick={() => selected && onConfirm(selected)}
            leftIcon={isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
          >
            {`Reemplazar en ${lineasAfectadas} ${lineasAfectadas === 1 ? 'línea' : 'líneas'}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
