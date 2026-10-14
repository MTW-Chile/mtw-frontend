import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Check, Loader2, Rows3 } from 'lucide-react';
import type { Ventana, CorreccionTravesano } from '../../../../types';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import * as core from '../../components/drawing/geometryCore';
import { correccionConCambios, guardarCorreccionDibujo } from './correccionDibujo';

interface TravesanosModalProps {
  ventana: Ventana;
  onClose: () => void;
  onSaved: (updated: Ventana) => void;
}

interface PanoOpcion {
  numero: number | null;
  label: string;
  ancho: number;
  alto: number;
}

export const TravesanosModal: React.FC<TravesanosModalProps> = ({ ventana, onClose, onSaved }) => {
  const [draft, setDraft] = useState<CorreccionTravesano[]>(
    () => (ventana.correccionGeometria?.travesanos ?? []).map((t) => ({ ...t }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paños donde se puede poner un travesaño: cada paño de una línea
  // compuesta, o la línea completa si es de un solo paño.
  const { panos, permiteVerticalSinPano } = useMemo(() => {
    const line = toWindowLine(ventana);
    const composite = line ? (core.compositePanels(line) as { panels: { number: number; width: number; height: number }[] } | null) : null;
    if (composite) {
      return {
        permiteVerticalSinPano: true,
        panos: composite.panels.map<PanoOpcion>((p) => ({
          numero: p.number,
          label: `Paño ${Number.isInteger(p.number) ? p.number : 'ciego'} · ${Math.round(p.width)}×${Math.round(p.height)} mm`,
          ancho: p.width,
          alto: p.height,
        })),
      };
    }
    // Sin hojas (ventana fija) el vertical es una división del vidrio; con
    // hojas habría que decidir en cuál va, y HETMO tampoco lo modela así.
    const fija = line
      ? (core.sourceComponents(line) as { apertura: number }[]).every((c) => core.apertureDefinition(line, c.apertura).family === 'fixed')
      : false;
    return {
      permiteVerticalSinPano: fija,
      panos: [{ numero: null, label: `Ventana completa · ${ventana.anchoMm}×${ventana.altoMm} mm`, ancho: ventana.anchoMm, alto: ventana.altoMm }],
    };
  }, [ventana]);

  const panoDe = (t: CorreccionTravesano) => panos.find((p) => p.numero === (t.panel ?? null)) ?? panos[0];
  const errorDe = (t: CorreccionTravesano): string | null => {
    const limite = t.eje === 'horizontal' ? panoDe(t).alto : panoDe(t).ancho;
    if (!(t.cota > 0)) return 'Ingresa una cota mayor a 0';
    if (t.cota >= limite) return `Debe ser menor a ${Math.round(limite)} mm`;
    return null;
  };
  const hayErrores = draft.some((t) => errorDe(t));

  const update = (i: number, patch: Partial<CorreccionTravesano>) =>
    setDraft((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const preview = useMemo<Ventana>(
    () => ({
      ...ventana,
      correccionGeometria: correccionConCambios(ventana, { travesanos: draft.filter((t) => !errorDe(t)) }) ?? undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ventana, draft]
  );

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      onSaved(await guardarCorreccionDibujo(ventana, { travesanos: draft }));
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Error al conectar con la API.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60">
      <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 border border-brand-200 flex items-center justify-center">
              <Rows3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Travesaños · {ventana.modelo}</h3>
              <p className="text-xs text-slate-500">Agrega los que HETMO no comunica. Los que HETMO ya trae no se duplican.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-2 gap-6 p-6">
          <div className="bg-[#f8fafc] rounded-2xl border border-slate-100 p-4 flex items-center justify-center min-h-[240px]">
            <WindowRendererSvg ventana={preview} className="w-full h-64" />
          </div>

          <div className="space-y-3">
            {draft.length === 0 && (
              <p className="text-sm text-slate-500">Sin travesaños manuales. Agrega uno con el botón de abajo.</p>
            )}
            {draft.map((t, i) => {
              const msg = errorDe(t);
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={t.eje}
                      onChange={(e) => update(i, { eje: e.target.value as CorreccionTravesano['eje'] })}
                      className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5"
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical" disabled={!permiteVerticalSinPano}>Vertical</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={t.cota || ''}
                      onChange={(e) => update(i, { cota: Number(e.target.value) })}
                      className="w-28 text-xs font-mono border border-slate-200 rounded-lg px-2 py-1.5"
                      placeholder="mm"
                    />
                    <span className="text-[11px] text-slate-400 flex-1">
                      {t.eje === 'horizontal' ? 'desde arriba' : 'desde la izquierda'}
                    </span>
                    <button
                      onClick={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      aria-label="Quitar travesaño"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {panos.length > 1 && (
                    <select
                      value={t.panel ?? ''}
                      onChange={(e) => update(i, { panel: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                    >
                      {panos.map((p) => (
                        <option key={String(p.numero)} value={p.numero ?? ''}>{p.label}</option>
                      ))}
                    </select>
                  )}
                  {msg && <p className="text-[11px] text-rose-600 font-medium">{msg}</p>}
                </div>
              );
            })}
            <button
              onClick={() => setDraft((prev) => [...prev, { eje: 'horizontal', cota: 0, panel: panos[0].numero }])}
              className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-brand-600 hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar travesaño
            </button>
            {!permiteVerticalSinPano && (
              <p className="text-[11px] text-slate-400">El travesaño vertical solo está disponible en ventanas fijas o compuestas.</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <p className="text-xs text-rose-600 font-medium">{error}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={isSaving || hayErrores}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
