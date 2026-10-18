import React, { useMemo, useState } from 'react';
import { X, LayoutGrid, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { Proyecto } from '../../../types';

/**
 * Elegir ventanas de la cotización (versión activa) para recotizarlas en un
 * adicional, con cuántas unidades de cada una. Lo elegido reemplaza lo que el
 * adicional tenía.
 */
export const ElegirVentanasModal: React.FC<{
  proyecto: Proyecto;
  pendiente: boolean;
  error: string | null;
  onConfirmar: (ventanas: { ventanaId: string; unidades: number }[]) => void;
  onClose: () => void;
}> = ({ proyecto, pendiente, error, onConfirmar, onClose }) => {
  const version = useMemo(
    () => proyecto.versiones.find((v) => v.hetmoId === proyecto.versionActivaHetmoId) ?? proyecto.versiones[0],
    [proyecto]
  );
  const ventanas = version?.ventanas ?? [];
  const [elegidas, setElegidas] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState('');
  const filtradas = ventanas.filter((v) => !busqueda.trim() || `${v.modelo} ${v.descripcionCorta ?? ''} ${v.lineaHetmo}`.toLowerCase().includes(busqueda.toLowerCase()));
  const total = Object.values(elegidas).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Ventanas a recotizar</h2>
              <p className="text-[11px] text-slate-500">De la cotización (versión activa); se cotizan con precios y divisas vigentes</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por modelo o línea…"
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-600"
          />
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {filtradas.map((v) => {
              const marcada = elegidas[v.id] !== undefined;
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-brand-600"
                      checked={marcada}
                      onChange={(e) =>
                        setElegidas((prev) => {
                          const { [v.id]: _, ...resto } = prev;
                          return e.target.checked ? { ...prev, [v.id]: v.unidades } : resto;
                        })
                      }
                    />
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-800">{v.modelo}</span>
                      <span className="text-slate-400"> · línea {v.lineaHetmo} · {Number(v.anchoMm)} × {Number(v.altoMm)} mm</span>
                    </span>
                  </label>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={v.unidades}
                      disabled={!marcada}
                      value={marcada ? elegidas[v.id] : ''}
                      onChange={(e) => setElegidas((prev) => ({ ...prev, [v.id]: Math.min(v.unidades, Math.max(1, Math.round(Number(e.target.value) || 1))) }))}
                      className="w-16 text-right text-xs border border-slate-200 rounded-lg px-2 py-1 disabled:bg-slate-50"
                    />
                    <span className="text-slate-400">de {v.unidades}</span>
                  </span>
                </li>
              );
            })}
            {filtradas.length === 0 && <li className="px-3 py-6 text-center text-slate-400 text-xs">Sin ventanas.</li>}
          </ul>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2.5 shrink-0">
          <span className="text-[11px] text-slate-500">{total} unidades elegidas</span>
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={total === 0}
              isLoading={pendiente}
              onClick={() => onConfirmar(Object.entries(elegidas).map(([ventanaId, unidades]) => ({ ventanaId, unidades })))}
            >
              Recotizar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
